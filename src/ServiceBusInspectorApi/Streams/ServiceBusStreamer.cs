using System.Text;
using System.Text.Json;
using Azure.Messaging.ServiceBus;
using ServiceBusInspectorApi.Models;

namespace ServiceBusInspectorApi.Streams;

/// <summary>
/// Handles Server-Sent Events (SSE) streaming of Service Bus messages.
/// Supports both peek mode (non-destructive) and receive mode (with lock tokens).
/// </summary>
public class ServiceBusStreamer
{
    private readonly ILogger<ServiceBusStreamer> _logger;

    public ServiceBusStreamer(ILogger<ServiceBusStreamer> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Streams messages from a Service Bus queue/topic using SSE.
    /// </summary>
    /// <param name="connectionString">Service Bus connection string</param>
    /// <param name="entityName">Queue or topic name</param>
    /// <param name="mode">"peek" or "receive"</param>
    /// <param name="isDLQ">Whether to stream from Dead Letter Queue</param>
    /// <param name="prefetch">Number of messages to prefetch</param>
    /// <param name="batch">Batch size for each iteration</param>
    /// <param name="outputStream">HTTP response stream</param>
    /// <param name="session">Session info for storing token mappings in receive mode</param>
    /// <param name="cancellationToken">Cancellation token</param>
    public async Task StreamMessagesAsync(
        string connectionString,
        string entityName,
        string? subscriptionName,
        string mode,
        bool isDLQ,
        int prefetch,
        int batch,
        Stream outputStream,
        SessionInfo? session,
        CancellationToken cancellationToken)
    {
        // SECURITY: Never log connection string
        // DLQ SEMANTICS (IMPORTANT):
        // Azure Service Bus has NO DLQ at Topic level.
        // DLQ exists only for queues and topic-subscriptions.
        var dlqSuffix = isDLQ ? " (DLQ)" : "";
        var baseEntityPath = string.IsNullOrEmpty(subscriptionName)
            ? entityName
            : $"{entityName}/subscriptions/{subscriptionName}";
        var effectiveEntityPath = isDLQ
            ? (string.IsNullOrEmpty(subscriptionName)
                ? $"{entityName}/$DeadLetterQueue"
                : $"{entityName}/subscriptions/{subscriptionName}/$DeadLetterQueue")
            : baseEntityPath;
        var entityType = string.IsNullOrEmpty(subscriptionName) ? "queue" : "topic-subscription";
        _logger.LogInformation(
            "Starting {Mode} stream: entityType={EntityType} entityPath={EntityPath} isDLQ={IsDLQ} prefetch={Prefetch} batch={Batch}",
            mode,
            entityType,
            effectiveEntityPath,
            isDLQ,
            prefetch,
            batch);

        await using var client = new ServiceBusClient(connectionString);
        
        var receiverOptions = new ServiceBusReceiverOptions
        {
            PrefetchCount = prefetch,
            ReceiveMode = mode == "peek" ? ServiceBusReceiveMode.PeekLock : ServiceBusReceiveMode.PeekLock
        };
        
        if (isDLQ)
        {
            receiverOptions.SubQueue = SubQueue.DeadLetter;
        }
        
        // Guard against invalid topic-level usage:
        // If subscriptionName is absent, this must be a queue receiver.
        await using var receiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(entityName, receiverOptions)
            : client.CreateReceiver(entityName, subscriptionName, receiverOptions);

        var writer = new StreamWriter(outputStream, Encoding.UTF8, leaveOpen: true);

        try
        {
            if (mode == "peek")
            {
                await StreamPeekModeAsync(receiver, writer, batch, cancellationToken);
            }
            else if (mode == "receive")
            {
                await StreamReceiveModeAsync(receiver, writer, batch, session, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Stream cancelled for entity {EntityName}", entityName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stream error for entity {EntityName}", entityName);
            await SendSseEventAsync(writer, "error", new { message = "Stream error occurred" });
        }
        finally
        {
            await writer.DisposeAsync();
        }
    }

    /// <summary>
    /// Peek mode: Periodically peek messages without removing them from the queue.
    /// Messages are sent to client with full content for preview.
    /// </summary>
    private async Task StreamPeekModeAsync(
        ServiceBusReceiver receiver,
        StreamWriter writer,
        int batch,
        CancellationToken cancellationToken)
    {
        long fromSequenceNumber = 0;
        var retryDelay = TimeSpan.FromSeconds(2);
        var maxRetryDelay = TimeSpan.FromSeconds(30);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var messages = await receiver.PeekMessagesAsync(batch, fromSequenceNumber, cancellationToken);

                if (messages.Any())
                {
                    foreach (var msg in messages)
                    {
                        var messageData = new
                        {
                            messageId = msg.MessageId,
                            sequenceNumber = msg.SequenceNumber,
                            enqueuedTimeUtc = msg.EnqueuedTime.UtcDateTime,
                            deliveryCount = msg.DeliveryCount,
                            body = msg.Body.ToString(),
                            applicationProperties = msg.ApplicationProperties,
                            contentType = msg.ContentType,
                            correlationId = msg.CorrelationId,
                            subject = msg.Subject,
                            // DLQ-specific fields (only populated for dead-lettered messages)
                            deadLetterReason = msg.DeadLetterReason,
                            deadLetterErrorDescription = msg.DeadLetterErrorDescription,
                            deadLetterSource = msg.DeadLetterSource
                        };

                        await SendSseEventAsync(writer, "message", messageData);
                        fromSequenceNumber = msg.SequenceNumber + 1;
                    }

                    // Reset retry delay on success
                    retryDelay = TimeSpan.FromSeconds(2);
                }
                else
                {
                    // No messages, send heartbeat and wait
                    await SendSseEventAsync(writer, "heartbeat", new { timestamp = DateTime.UtcNow });
                    await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Error peeking messages, will retry after {Delay}", retryDelay);
                await Task.Delay(retryDelay, cancellationToken);
                
                // Exponential backoff
                retryDelay = TimeSpan.FromMilliseconds(Math.Min(retryDelay.TotalMilliseconds * 2, maxRetryDelay.TotalMilliseconds));
            }
        }
    }

    /// <summary>
    /// Receive mode: Receive messages with lock and send ephemeral tokens to client.
    /// Client must confirm receipt by sending tokens back to complete the messages.
    /// SECURITY: Lock tokens are never sent to client; ephemeral tokens are mapped server-side.
    /// </summary>
    private async Task StreamReceiveModeAsync(
        ServiceBusReceiver receiver,
        StreamWriter writer,
        int batch,
        SessionInfo? session,
        CancellationToken cancellationToken)
    {
        var retryDelay = TimeSpan.FromSeconds(2);
        var maxRetryDelay = TimeSpan.FromSeconds(30);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var messages = await receiver.ReceiveMessagesAsync(batch, TimeSpan.FromSeconds(1), cancellationToken);

                if (messages.Any())
                {
                    foreach (var msg in messages)
                    {
                        try
                        {
                            // Generate ephemeral token (client will use this to confirm receipt)
                            var ephemeralToken = Guid.NewGuid().ToString("N");

                            var messageData = new
                            {
                                token = ephemeralToken,
                                messageId = msg.MessageId,
                                sequenceNumber = msg.SequenceNumber,
                                enqueuedTimeUtc = msg.EnqueuedTime.UtcDateTime,
                                deliveryCount = msg.DeliveryCount,
                                body = msg.Body.ToString(),
                                applicationProperties = msg.ApplicationProperties,
                                contentType = msg.ContentType,
                                correlationId = msg.CorrelationId,
                                subject = msg.Subject,
                                lockedUntilUtc = msg.LockedUntil.UtcDateTime
                            };

                            // SECURITY: Store the mapping of ephemeral token to the received message server-side
                            if (session != null)
                            {
                                var mapping = new TokenMapping
                                {
                                    EphemeralToken = ephemeralToken,
                                    Message = msg,
                                    MessageId = msg.MessageId,
                                    SequenceNumber = msg.SequenceNumber,
                                    CreatedAtUtc = DateTime.UtcNow,
                                    ExpiresAtUtc = msg.LockedUntil.UtcDateTime
                                };
                                session.TokenMappings.TryAdd(ephemeralToken, mapping);
                            }

                            await SendSseEventAsync(writer, "message", messageData);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error processing received message {MessageId}", msg.MessageId);
                            // Continue processing other messages even if one fails
                        }
                    }

                    // Reset retry delay on success
                    retryDelay = TimeSpan.FromSeconds(2);
                }
                else
                {
                    // No messages, send heartbeat
                    await SendSseEventAsync(writer, "heartbeat", new { timestamp = DateTime.UtcNow });
                }

                // Wait before next poll
                await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Error receiving messages, will retry after {Delay}", retryDelay);
                await Task.Delay(retryDelay, cancellationToken);
                
                // Exponential backoff
                retryDelay = TimeSpan.FromMilliseconds(Math.Min(retryDelay.TotalMilliseconds * 2, maxRetryDelay.TotalMilliseconds));
            }
        }
    }

    /// <summary>
    /// Sends an SSE event to the client.
    /// </summary>
    private async Task SendSseEventAsync(StreamWriter writer, string eventType, object data)
    {
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await writer.WriteLineAsync($"event: {eventType}");
        await writer.WriteLineAsync($"data: {json}");
        await writer.WriteLineAsync();
        await writer.FlushAsync(); // Ensure data is sent immediately
    }

    // PRODUCTION HARDENING:
    // 1. Store ephemeral token -> lock token mappings in Redis with TTL
    // 2. Implement message abandonment for expired locks
    // 3. Add metrics for message processing rates and latencies
    // 4. Implement dead-letter queue monitoring
    // 5. Add support for topic subscriptions
    // 6. Implement message filtering based on properties
    // 7. Add compression for large message bodies
    // 8. Implement rate limiting per session
}
