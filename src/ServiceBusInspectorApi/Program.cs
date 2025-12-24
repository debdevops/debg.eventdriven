using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Messaging.ServiceBus.Administration;
using Azure.Monitor.OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using ServiceBusInspectorApi.Models;
using ServiceBusInspectorApi.Services;
using ServiceBusInspectorApi.Streams;

var builder = WebApplication.CreateBuilder(args);

// ============================================================================
// Configuration
// ============================================================================
// SESSION TTL Configuration - TUNE THIS FOR YOUR ENVIRONMENT
// Development: 10 minutes is convenient for testing
// Production: Consider 30-60 minutes depending on your use case
var sessionTimeoutMinutes = builder.Configuration.GetValue<int>("SessionTimeoutMinutes", 10);
var appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];

// ============================================================================
// OpenTelemetry Configuration
// ============================================================================
if (!string.IsNullOrEmpty(appInsightsConnectionString))
{
    builder.Services.AddOpenTelemetry()
        .WithTracing(tracing =>
        {
            tracing
                .AddSource("RegistrationApi")
                .SetResourceBuilder(ResourceBuilder.CreateDefault()
                    .AddService("RegistrationApi", serviceVersion: "1.0.0"))
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddAzureMonitorTraceExporter(options =>
                {
                    options.ConnectionString = appInsightsConnectionString;
                });
        });
}

// ============================================================================
// Dependency Injection
// ============================================================================
builder.Services.AddSingleton<ServiceBusProvisioningService>();
builder.Services.AddSingleton<ServiceBusStreamer>();
builder.Services.AddSingleton<AuditStore>();
builder.Services.AddHttpClient(); // For AI Insights HTTP calls
builder.Services.AddSingleton<AiInsightsService>();

// In-memory session store with TTL
// PRODUCTION: Replace with Redis or Azure Cache for Redis for distributed sessions
builder.Services.AddSingleton<ConcurrentDictionary<string, SessionInfo>>();

// CORS for local development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ============================================================================
// Middleware
// ============================================================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

var sessions = app.Services.GetRequiredService<ConcurrentDictionary<string, SessionInfo>>();
var sbProvisioning = app.Services.GetRequiredService<ServiceBusProvisioningService>();
var streamer = app.Services.GetRequiredService<ServiceBusStreamer>();
var auditStore = app.Services.GetRequiredService<AuditStore>();
var aiInsightsService = app.Services.GetRequiredService<AiInsightsService>();

// ============================================================================
// Helper Functions
// ============================================================================

/// <summary>
/// Extracts the namespace host from a Service Bus connection string.
/// Returns the Endpoint host (e.g., "my-namespace.servicebus.windows.net").
/// Safe to log as it contains no secrets.
/// </summary>
static string ExtractNamespaceHost(string connectionString)
{
    try
    {
        var parts = connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries);
        var endpointPart = parts.FirstOrDefault(p => p.StartsWith("Endpoint=", StringComparison.OrdinalIgnoreCase));
        if (endpointPart != null)
        {
            var endpoint = endpointPart.Substring("Endpoint=".Length);
            if (Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
            {
                return uri.Host;
            }
        }
    }
    catch
    {
        // Fallback if parsing fails
    }
    return "unknown";
}

// ============================================================================
// Background Tasks
// ============================================================================

// Background task to clean up expired sessions and token mappings
_ = Task.Run(async () =>
{
    while (true)
    {
        await Task.Delay(TimeSpan.FromMinutes(1));
        
        // Clean up expired sessions
        var expiredSessions = sessions.Where(kvp => kvp.Value.ExpiresAtUtc < DateTime.UtcNow).ToList();
        foreach (var kvp in expiredSessions)
        {
            sessions.TryRemove(kvp.Key, out _);
            app.Logger.LogInformation("Session {SessionId} expired and removed", kvp.Key);
        }
        
        // Clean up expired token mappings within active sessions
        foreach (var session in sessions.Values)
        {
            var expiredTokens = session.TokenMappings
                .Where(kvp => kvp.Value.ExpiresAtUtc < DateTime.UtcNow)
                .Select(kvp => kvp.Key)
                .ToList();
            
            foreach (var token in expiredTokens)
            {
                session.TokenMappings.TryRemove(token, out _);
                app.Logger.LogInformation("Expired token mapping removed from session {SessionId}", session.SessionId);
            }
        }
    }
});

// ============================================================================
// API Endpoints
// ============================================================================

// Health check
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .WithName("Health")
   .WithOpenApi();

// Connect: Create session with Service Bus connection string
app.MapPost("/api/namespace/connect", async (ConnectRequest request, HttpContext context) =>
{
    if (string.IsNullOrWhiteSpace(request.ConnectionString))
    {
        return Results.BadRequest(new { error = "connectionString is required" });
    }

    // Basic validation: check if it looks like a connection string
    if (!request.ConnectionString.Contains("Endpoint=") || !request.ConnectionString.Contains("SharedAccessKey"))
    {
        return Results.BadRequest(new { error = "Invalid connection string format" });
    }

    try
    {
        // Validate connection by attempting to create a client
        await using var testClient = new ServiceBusClient(request.ConnectionString);
        
        // Extract namespace host (safe to log, no secrets)
        var namespaceHost = ExtractNamespaceHost(request.ConnectionString);
        
        var sessionId = Guid.NewGuid().ToString("N");
        var expiresAt = DateTime.UtcNow.AddMinutes(sessionTimeoutMinutes);

        var session = new SessionInfo
        {
            SessionId = sessionId,
            ConnectionString = request.ConnectionString,
            NamespaceHost = namespaceHost,
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = expiresAt
        };

        sessions[sessionId] = session;

        app.Logger.LogInformation("Session {SessionId} created for namespace {NamespaceHost}, expires at {ExpiresAt:O}",
            sessionId, namespaceHost, expiresAt);

        return Results.Ok(new
        {
            sessionId,
            expiresAtUtc = expiresAt
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to create session - connection string validation failed");
        return ProblemResults.FromException(ex, "Connect");
    }
})
.WithName("Connect")
.WithOpenApi();

// List entities (queues and topics)
app.MapGet("/api/namespace/{sessionId}/entities", async (string sessionId) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var entities = await sbProvisioning.ListEntitiesAsync(session.ConnectionString);

        return Results.Ok(entities);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to list entities for session {SessionId}", sessionId);
        
        // Provide more specific error messages for common issues
        var errorMessage = ex.InnerException?.Message ?? ex.Message;
        if (errorMessage.Contains("No such host is known") || errorMessage.Contains("Name or service not known"))
        {
            return Results.Problem("Unable to connect to Service Bus namespace. Please check the connection string and ensure the namespace exists.");
        }
        else if (errorMessage.Contains("Connection refused") || errorMessage.Contains("actively refused"))
        {
            return Results.Problem("Connection refused by Service Bus. Please check your network connectivity and firewall settings.");
        }
        else if (errorMessage.Contains("401") || errorMessage.Contains("Unauthorized"))
        {
            return Results.Problem("Authentication failed. Please check your connection string credentials.");
        }
        else
        {
            return Results.Problem($"Failed to list entities: {errorMessage}");
        }
    }
})
.WithName("ListEntities")
.WithOpenApi();

// Get metrics for a specific entity (queue or subscription)
app.MapGet("/api/namespace/{sessionId}/{entityName}/metrics", async (
    string sessionId,
    string entityName,
    string? subscriptionName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        
        if (string.IsNullOrEmpty(subscriptionName))
        {
            // Queue metrics
            var queueRuntimeInfo = await adminClient.GetQueueRuntimePropertiesAsync(entityName);
            var queue = queueRuntimeInfo.Value;
            
            return Results.Ok(new
            {
                entityName,
                entityType = "Queue",
                activeMessageCount = queue.ActiveMessageCount,
                deadLetterMessageCount = queue.DeadLetterMessageCount,
                scheduledMessageCount = queue.ScheduledMessageCount,
                transferMessageCount = queue.TransferMessageCount,
                transferDeadLetterMessageCount = queue.TransferDeadLetterMessageCount,
                sizeInBytes = queue.SizeInBytes,
                updatedAt = queue.UpdatedAt,
                accessedAt = queue.AccessedAt
            });
        }
        else
        {
            // Subscription metrics
            var subRuntimeInfo = await adminClient.GetSubscriptionRuntimePropertiesAsync(entityName, subscriptionName);
            var sub = subRuntimeInfo.Value;
            
            return Results.Ok(new
            {
                entityName,
                subscriptionName,
                entityType = "Subscription",
                activeMessageCount = sub.ActiveMessageCount,
                deadLetterMessageCount = sub.DeadLetterMessageCount,
                transferMessageCount = sub.TransferMessageCount,
                transferDeadLetterMessageCount = sub.TransferDeadLetterMessageCount,
                updatedAt = sub.UpdatedAt,
                accessedAt = sub.AccessedAt
            });
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to get metrics for {EntityName}", entityName);
        return Results.Problem("Failed to retrieve metrics");
    }
})
.WithName("GetMetrics")
.WithOpenApi();

// List subscriptions for a topic
app.MapGet("/api/namespace/{sessionId}/topic/{topicName}/subscriptions", async (
    string sessionId,
    string topicName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var subscriptions = await sbProvisioning.ListSubscriptionsAsync(session.ConnectionString, topicName);
        return Results.Ok(new { subscriptions });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to list subscriptions for topic {TopicName}", topicName);
        return ProblemResults.FromException(ex, "List subscriptions", $"{topicName}/subscriptions");
    }
})
.WithName("ListSubscriptions")
.WithOpenApi();

// Create temporary subscription
app.MapPost("/api/namespace/{sessionId}/topic/{topicName}/subscription/temp", async (
    string sessionId,
    string topicName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var subscription = await sbProvisioning.CreateTempSubscriptionAsync(session.ConnectionString, topicName);
        return Results.Ok(subscription);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to create temp subscription for topic {TopicName}", topicName);
        return Results.Problem("Failed to create temp subscription");
    }
})
.WithName("CreateTempSubscription")
.WithOpenApi();

// Delete subscription
app.MapDelete("/api/namespace/{sessionId}/topic/{topicName}/subscription/{subscriptionName}", async (
    string sessionId,
    string topicName,
    string subscriptionName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await sbProvisioning.DeleteSubscriptionAsync(session.ConnectionString, topicName, subscriptionName);
        return Results.Ok(new { success = true, message = "Subscription deleted" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to delete subscription {SubName} from topic {TopicName}",
            subscriptionName, topicName);
        return Results.Problem("Failed to delete subscription");
    }
})
.WithName("DeleteSubscription")
.WithOpenApi();

// Send message to topic or queue
app.MapPost("/api/namespace/{sessionId}/send", async (
    string sessionId,
    SendMessageRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(request.EntityName) || string.IsNullOrWhiteSpace(request.Message))
    {
        return Results.BadRequest(new { error = "EntityName and Message are required" });
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        await using var sender = client.CreateSender(request.EntityName);

        var message = new ServiceBusMessage(request.Message)
        {
            ContentType = "text/plain"
        };

        // Add any additional properties if provided
        if (request.ApplicationProperties != null)
        {
            foreach (var prop in request.ApplicationProperties)
            {
                // Convert JsonElement to appropriate primitive types
                var value = prop.Value switch
                {
                    JsonElement jsonElement => jsonElement.ValueKind switch
                    {
                        JsonValueKind.String => jsonElement.GetString(),
                        JsonValueKind.Number => jsonElement.TryGetInt64(out var l) ? l : jsonElement.GetDouble(),
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.Null => null,
                        _ => jsonElement.ToString()
                    },
                    _ => prop.Value
                };
                
                if (value != null)
                {
                    message.ApplicationProperties[prop.Key] = value;
                }
            }
        }

        await sender.SendMessageAsync(message);

        app.Logger.LogInformation("Message sent to {EntityName} - Session: {SessionId}", 
            request.EntityName, sessionId);

        return Results.Ok(new { success = true, message = "Message sent successfully" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to send message to {EntityName} for session {SessionId}", 
            request.EntityName, sessionId);
        return Results.Problem("Failed to send message");
    }
})
.WithName("SendMessage")
.WithOpenApi();

// ============================================================================
// DLQ semantics enforcement
// ============================================================================
// IMPORTANT: Azure Service Bus has NO DLQ at Topic level.
// DLQ exists only for:
//  1) Queues        -> {queue}/$DeadLetterQueue
//  2) Subscriptions -> {topic}/subscriptions/{subscription}/$DeadLetterQueue
// These guards prevent confusing/invalid "topic DLQ" navigation from ever working.
static async Task<(bool ExistsAsQueue, bool ExistsAsTopic)> ProbeEntityAsync(
    ServiceBusAdministrationClient adminClient,
    string entityName,
    CancellationToken cancellationToken = default)
{
    try
    {
        await adminClient.GetQueueRuntimePropertiesAsync(entityName, cancellationToken);
        return (true, false);
    }
    catch (Azure.RequestFailedException)
    {
        // Not a queue (or not accessible).
    }

    try
    {
        await adminClient.GetTopicRuntimePropertiesAsync(entityName, cancellationToken);
        return (false, true);
    }
    catch (Azure.RequestFailedException)
    {
        // Not a topic (or not accessible).
    }

    return (false, false);
}

static async Task<bool> SubscriptionExistsAsync(
    ServiceBusAdministrationClient adminClient,
    string topicName,
    string subscriptionName,
    CancellationToken cancellationToken = default)
{
    try
    {
        await adminClient.GetSubscriptionRuntimePropertiesAsync(topicName, subscriptionName, cancellationToken);
        return true;
    }
    catch (Azure.RequestFailedException)
    {
        return false;
    }
}

// SSE Stream endpoint for real-time message streaming
// SSE Stream endpoint for real-time message streaming
// Supports both queues and subscriptions
// For subscriptions, pass topicName as entityName and subscriptionName as query param
app.MapGet("/api/stream/{sessionId}/{entityName}", async (
    string sessionId,
    string entityName,
    string? subscriptionName,
    string mode,
    int prefetch,
    int batch,
    HttpContext context,
    bool isDLQ = false) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    var validModes = new[] { "peek", "receive" };
    if (string.IsNullOrEmpty(mode) || !validModes.Contains(mode.ToLowerInvariant()))
    {
        return Results.BadRequest(new { error = "mode must be 'peek' or 'receive'" });
    }

    try
    {
        // DLQ SEMANTICS GUARD:
        // - If subscriptionName is absent, this route is queue-scoped.
        // - If subscriptionName is present, this route is topic-subscription scoped.
        // - Topic-level DLQ must never exist.
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        if (string.IsNullOrWhiteSpace(subscriptionName))
        {
            var probe = await ProbeEntityAsync(adminClient, entityName, context.RequestAborted);
            if (!probe.ExistsAsQueue && probe.ExistsAsTopic)
            {
                return Results.BadRequest(new
                {
                    error = "Topic-level DLQ does not exist. Select a subscription (or subscription DLQ) instead of a topic."
                });
            }
            if (!probe.ExistsAsQueue && !probe.ExistsAsTopic)
            {
                return Results.BadRequest(new { error = $"Entity '{entityName}' was not found as a queue or topic" });
            }
        }
        else
        {
            var exists = await SubscriptionExistsAsync(adminClient, entityName, subscriptionName, context.RequestAborted);
            if (!exists)
            {
                return Results.BadRequest(new
                {
                    error = $"Subscription '{entityName}/subscriptions/{subscriptionName}' was not found"
                });
            }
        }

        // Build entity path - for subscriptions: topicName/subscriptions/subscriptionName
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

        var entityType = string.IsNullOrEmpty(subscriptionName) ? "queue" : "topic-subscription";
        var effectivePath = isDLQ
            ? (string.IsNullOrEmpty(subscriptionName)
                ? $"{entityName}/$DeadLetterQueue"
                : $"{entityName}/subscriptions/{subscriptionName}/$DeadLetterQueue")
            : entityPath;
        app.Logger.LogInformation(
            "Stream request: entityType={EntityType} entityPath={EntityPath} isDLQ={IsDLQ} mode={Mode} prefetch={Prefetch} batch={Batch}",
            entityType,
            effectivePath,
            isDLQ,
            mode,
            prefetch,
            batch);

        // Set SSE headers
        context.Response.Headers["Content-Type"] = "text/event-stream";
        context.Response.Headers["Cache-Control"] = "no-cache";
        context.Response.Headers["Connection"] = "keep-alive";
        context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        context.Response.Headers["Access-Control-Allow-Headers"] = "Cache-Control";
        
        // Disable response buffering for SSE
        context.Response.Headers["X-Accel-Buffering"] = "no"; // For nginx
        await context.Response.Body.FlushAsync(); // Ensure headers are sent immediately

        await streamer.StreamMessagesAsync(
            session.ConnectionString,
            entityName,
            subscriptionName,
            mode.ToLowerInvariant(),
            isDLQ,
            prefetch,
            batch,
            context.Response.Body,
            session,
            context.RequestAborted);

        return Results.Empty;
    }
    catch (Exception ex)
    {
        var dlqSuffix = isDLQ ? " (DLQ)" : "";
        app.Logger.LogError(ex, "Stream failed for session {SessionId}, entity {EntityName}{DLQSuffix}", 
            sessionId, entityName, dlqSuffix);
        return Results.Problem("Stream failed");
    }
})
.WithName("StreamMessages")
.WithOpenApi();

// Peek messages immediately (non-streaming)
// Supports both queues and subscriptions
app.MapPost("/api/queue/{sessionId}/{entityName}/peek", async (
    string sessionId,
    string entityName,
    string? subscriptionName,
    long? fromSequenceNumber,
    PeekRequest request,
    bool isDLQ = false,
    CancellationToken cancellationToken = default) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);

        // DLQ SEMANTICS GUARD (no topic-level DLQ):
        // If subscriptionName is absent, treat entityName as queue.
        // If entityName is actually a topic, return a clear 400.
        if (string.IsNullOrWhiteSpace(subscriptionName))
        {
            var probe = await ProbeEntityAsync(adminClient, entityName);
            if (!probe.ExistsAsQueue && probe.ExistsAsTopic)
            {
                return Results.BadRequest(new
                {
                    error = "Topic-level DLQ does not exist. To view DLQ for a topic, select a subscription DLQ."
                });
            }
            if (!probe.ExistsAsQueue && !probe.ExistsAsTopic)
            {
                return Results.BadRequest(new { error = $"Entity '{entityName}' was not found as a queue or topic" });
            }
        }
        else
        {
            var exists = await SubscriptionExistsAsync(adminClient, entityName, subscriptionName);
            if (!exists)
            {
                return Results.BadRequest(new
                {
                    error = $"Subscription '{entityName}/subscriptions/{subscriptionName}' was not found"
                });
            }
        }
        
        var receiverOptions = new ServiceBusReceiverOptions();
        if (isDLQ)
        {
            receiverOptions.SubQueue = SubQueue.DeadLetter;
        }

        var entityType = string.IsNullOrEmpty(subscriptionName) ? "queue" : "topic-subscription";
        var maxMessages = request.MaxMessages ?? 10;

        // Log the effective entity path (including DLQ suffix) for portal parity.
        var effectiveEntityPath = isDLQ
            ? (string.IsNullOrEmpty(subscriptionName)
                ? $"{entityName}/$DeadLetterQueue"
                : $"{entityName}/subscriptions/{subscriptionName}/$DeadLetterQueue")
            : (string.IsNullOrEmpty(subscriptionName)
                ? entityName
                : $"{entityName}/subscriptions/{subscriptionName}");
        app.Logger.LogInformation(
            "Peek request: entityType={EntityType} entityPath={EntityPath} topicOrQueue={EntityName} subscriptionName={SubscriptionName} isDLQ={IsDLQ} maxMessages={MaxMessages} fromSequenceNumber={FromSequenceNumber}",
            entityType,
            effectiveEntityPath,
            entityName,
            string.IsNullOrEmpty(subscriptionName) ? null : subscriptionName,
            isDLQ,
            maxMessages,
            fromSequenceNumber);

        app.Logger.LogInformation(
            "Creating receiver: entityType={EntityType} createMethod={CreateMethod} subQueue={SubQueue}",
            entityType,
            string.IsNullOrEmpty(subscriptionName) ? "CreateReceiver(queue)" : "CreateReceiver(topic, subscription)",
            isDLQ ? "DeadLetter" : "None");
        
        // For queue DLQ, use the explicit {queue}/$DeadLetterQueue path.
        // For subscription DLQ, use receiverOptions.SubQueue=DeadLetter on (topic, subscription).
        await using var receiver = string.IsNullOrEmpty(subscriptionName)
            ? (isDLQ
                ? client.CreateReceiver($"{entityName}/$DeadLetterQueue")
                : client.CreateReceiver(entityName, receiverOptions))
            : client.CreateReceiver(entityName, subscriptionName, receiverOptions);

        // Peek semantics:
        // - Peek is non-destructive: messages remain in the queue/subscription.
        // - `fromSequenceNumber` is an offset into the sequence-number stream.
        //   Clients MUST treat it as monotonic per selection; moving backwards re-reads old messages.
        // - Counts (messageCount / deadLetterMessageCount) can change concurrently and are approximate.
        // One-shot retry for transient Service Bus failures.
        IReadOnlyList<ServiceBusReceivedMessage> messages;
        try
        {
            messages = fromSequenceNumber.HasValue
                ? await receiver.PeekMessagesAsync(maxMessages, fromSequenceNumber.Value, cancellationToken)
                : await receiver.PeekMessagesAsync(maxMessages, cancellationToken: cancellationToken);
        }
        catch (Exception ex) when (ServiceBusErrorClassifier.IsTransient(ex) && !cancellationToken.IsCancellationRequested)
        {
            app.Logger.LogWarning(ex,
                "Transient peek failure (will retry once): entityType={EntityType} entityPath={EntityPath} isDLQ={IsDLQ}",
                entityType,
                effectiveEntityPath,
                isDLQ);

            await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);
            messages = fromSequenceNumber.HasValue
                ? await receiver.PeekMessagesAsync(maxMessages, fromSequenceNumber.Value, cancellationToken)
                : await receiver.PeekMessagesAsync(maxMessages, cancellationToken: cancellationToken);
        }

        var result = messages.Select(msg => new
        {
            messageId = msg.MessageId,
            sequenceNumber = msg.SequenceNumber,
            enqueuedTimeUtc = msg.EnqueuedTime.UtcDateTime,
            deliveryCount = msg.DeliveryCount,
            body = msg.Body.ToString(),
            applicationProperties = msg.ApplicationProperties,
            // DLQ-specific fields (only populated for dead-lettered messages)
            deadLetterReason = msg.DeadLetterReason,
            deadLetterErrorDescription = msg.DeadLetterErrorDescription,
            deadLetterSource = msg.DeadLetterSource
        }).ToList();

        app.Logger.LogInformation(
            "Peek result: entityType={EntityType} topicOrQueue={EntityName} subscriptionName={SubscriptionName} isDLQ={IsDLQ} peekedCount={PeekedCount}",
            entityType,
            entityName,
            string.IsNullOrEmpty(subscriptionName) ? null : subscriptionName,
            isDLQ,
            result.Count);

        if (isDLQ)
        {
            app.Logger.LogInformation(
                "[DLQ Peek] entityType={EntityType} topicName={TopicName} subscriptionName={SubscriptionName} isDLQ=true peekedCount={PeekedCount}",
                entityType,
                entityName,
                string.IsNullOrEmpty(subscriptionName) ? null : subscriptionName,
                result.Count);
        }

        return Results.Ok(new { messages = result, peekedCount = result.Count });
    }
    catch (Exception ex)
    {
        var entityType = string.IsNullOrEmpty(subscriptionName) ? "queue" : "topic-subscription";
        app.Logger.LogError(
            ex,
            "Peek failed: sessionId={SessionId} entityType={EntityType} topicOrQueue={EntityName} subscriptionName={SubscriptionName} isDLQ={IsDLQ}",
            sessionId,
            entityType,
            entityName,
            string.IsNullOrEmpty(subscriptionName) ? null : subscriptionName,
            isDLQ);
        var entityPathForProblem = isDLQ
            ? (string.IsNullOrEmpty(subscriptionName)
                ? $"{entityName}/$DeadLetterQueue"
                : $"{entityName}/subscriptions/{subscriptionName}/$DeadLetterQueue")
            : (string.IsNullOrEmpty(subscriptionName)
                ? entityName
                : $"{entityName}/subscriptions/{subscriptionName}");
        return ProblemResults.FromException(ex, "Peek", entityPathForProblem);
    }
})
.WithName("PeekMessages")
.WithOpenApi();

// Receive and complete messages (with ephemeral token mapping)
// Supports both queues and subscriptions
app.MapPost("/api/queue/{sessionId}/{entityName}/receive", async (
    string sessionId,
    string entityName,
    string? subscriptionName,
    ReceiveRequest request,
    bool isDLQ = false) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    if (request.Tokens == null || !request.Tokens.Any())
    {
        return Results.BadRequest(new { error = "tokens array is required" });
    }

    try
    {
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

        // Retrieve token mappings from session
        var completedMessages = new List<string>();
        var failedMessages = new List<string>();

        await using var client = new ServiceBusClient(session.ConnectionString);
        
        var receiverOptions = new ServiceBusReceiverOptions();
        if (isDLQ)
        {
            receiverOptions.SubQueue = SubQueue.DeadLetter;
        }
        
        await using var receiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(entityName, receiverOptions)
            : client.CreateReceiver(entityName, subscriptionName, receiverOptions);

        foreach (var token in request.Tokens)
        {
            if (session.TokenMappings.TryGetValue(token, out var mapping))
            {
                try
                {
                    // Complete the message using the stored ServiceBusReceivedMessage
                    await receiver.CompleteMessageAsync(mapping.Message);
                    completedMessages.Add(token);

                    // Audit the receive operation
                    await auditStore.LogAsync(new AuditEntry
                    {
                        Timestamp = DateTime.UtcNow,
                        SessionId = sessionId,
                        EntityName = entityPath,
                        Operation = "Receive",
                        MessageId = mapping.MessageId,
                        SequenceNumber = mapping.SequenceNumber
                    });

                    // Remove token mapping after completion
                    session.TokenMappings.TryRemove(token, out _);

                    app.Logger.LogInformation(
                        "Message completed - Session: {SessionId}, Entity: {EntityPath}, MessageId: {MessageId}",
                        sessionId, entityPath, mapping.MessageId);
                }
                catch (Exception ex)
                {
                    app.Logger.LogError(ex, "Failed to complete message with token {Token}", token);
                    failedMessages.Add(token);
                }
            }
            else
            {
                failedMessages.Add(token);
            }
        }

        return Results.Ok(new
        {
            completed = completedMessages,
            failed = failedMessages
        });
    }
    catch (Exception ex)
    {
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";
        app.Logger.LogError(ex, "Receive failed for session {SessionId}, entity {EntityPath}", 
            sessionId, entityPath);
        return Results.Problem("Receive operation failed");
    }
})
.WithName("ReceiveMessages")
.WithOpenApi();

// Replay DLQ messages back to main queue (selected messages)
app.MapPost("/api/queue/{sessionId}/{entityName}/dlq/replay", async (
    string sessionId,
    string entityName,
    string? subscriptionName,
    ReplayRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

        // Create DLQ receiver with SubQueue.DeadLetter
        var receiverOptions = new ServiceBusReceiverOptions 
        { 
            SubQueue = SubQueue.DeadLetter,
            ReceiveMode = ServiceBusReceiveMode.PeekLock
        };
        
        await using var dlqReceiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(entityName, receiverOptions)
            : client.CreateReceiver(entityName, subscriptionName, receiverOptions);

        // Create sender for main queue/subscription
        await using var sender = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateSender(entityName)
            : client.CreateSender(entityName); // Topics use topic name as sender

        var replayed = new List<object>();
        var failed = new List<object>();

        // Receive messages from DLQ by sequence numbers
        foreach (var seqNum in request.SequenceNumbers)
        {
            try
            {
                var message = await dlqReceiver.ReceiveMessageAsync(TimeSpan.FromSeconds(5));
                
                if (message != null && message.SequenceNumber == seqNum)
                {
                    // Create new message with original properties
                    var newMessage = new ServiceBusMessage(message.Body)
                    {
                        MessageId = message.MessageId,
                        CorrelationId = message.CorrelationId,
                        Subject = message.Subject,
                        ContentType = message.ContentType,
                        SessionId = message.SessionId,
                        ReplyTo = message.ReplyTo,
                        ReplyToSessionId = message.ReplyToSessionId,
                        TimeToLive = message.TimeToLive
                    };

                    // Copy application properties
                    foreach (var prop in message.ApplicationProperties)
                    {
                        newMessage.ApplicationProperties[prop.Key] = prop.Value;
                    }

                    // Add replay metadata
                    newMessage.ApplicationProperties["ReplayedFromDLQ"] = true;
                    newMessage.ApplicationProperties["OriginalDeadLetterReason"] = message.DeadLetterReason ?? "Unknown";
                    newMessage.ApplicationProperties["ReplayedAt"] = DateTime.UtcNow.ToString("o");

                    // Send to main queue/topic
                    await sender.SendMessageAsync(newMessage);

                    // Complete DLQ message
                    await dlqReceiver.CompleteMessageAsync(message);

                    replayed.Add(new { sequenceNumber = seqNum, messageId = message.MessageId });
                    
                    app.Logger.LogInformation("Replayed message {MessageId} from DLQ to {EntityPath}",
                        message.MessageId, entityPath);
                }
                else
                {
                    failed.Add(new { sequenceNumber = seqNum, reason = "Message not found or sequence mismatch" });
                }
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "Failed to replay message with sequence {SeqNum}", seqNum);
                failed.Add(new { sequenceNumber = seqNum, reason = ex.Message });
            }
        }

        return Results.Ok(new
        {
            replayed,
            failed,
            totalRequested = request.SequenceNumbers.Count,
            successCount = replayed.Count,
            failCount = failed.Count
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "DLQ replay failed for {EntityName}", entityName);
        return Results.Problem("DLQ replay operation failed");
    }
})
.WithName("ReplayDLQMessages")
.WithOpenApi();

// Replay ALL DLQ messages back to main queue
app.MapPost("/api/queue/{sessionId}/{entityName}/dlq/replay-all", async (
    string sessionId,
    string entityName,
    string? subscriptionName,
    ReplayAllRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

        var receiverOptions = new ServiceBusReceiverOptions 
        { 
            SubQueue = SubQueue.DeadLetter,
            ReceiveMode = ServiceBusReceiveMode.PeekLock
        };
        
        await using var dlqReceiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(entityName, receiverOptions)
            : client.CreateReceiver(entityName, subscriptionName, receiverOptions);

        await using var sender = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateSender(entityName)
            : client.CreateSender(entityName);

        var maxMessages = request.MaxMessages ?? 100;
        var replayed = 0;
        var failed = 0;

        while (replayed + failed < maxMessages)
        {
            var message = await dlqReceiver.ReceiveMessageAsync(TimeSpan.FromSeconds(2));
            
            if (message == null)
                break; // No more messages

            try
            {
                var newMessage = new ServiceBusMessage(message.Body)
                {
                    MessageId = message.MessageId,
                    CorrelationId = message.CorrelationId,
                    Subject = message.Subject,
                    ContentType = message.ContentType
                };

                foreach (var prop in message.ApplicationProperties)
                {
                    newMessage.ApplicationProperties[prop.Key] = prop.Value;
                }

                newMessage.ApplicationProperties["ReplayedFromDLQ"] = true;
                newMessage.ApplicationProperties["OriginalDeadLetterReason"] = message.DeadLetterReason ?? "Unknown";
                newMessage.ApplicationProperties["ReplayedAt"] = DateTime.UtcNow.ToString("o");

                await sender.SendMessageAsync(newMessage);
                await dlqReceiver.CompleteMessageAsync(message);
                
                replayed++;
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "Failed to replay message {MessageId}", message.MessageId);
                failed++;
                // Abandon the message so it stays in DLQ
                await dlqReceiver.AbandonMessageAsync(message);
            }
        }

        return Results.Ok(new
        {
            replayed,
            failed,
            message = $"Replayed {replayed} messages from DLQ to {entityPath}"
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "DLQ replay-all failed for {EntityName}", entityName);
        return Results.Problem("DLQ replay-all operation failed");
    }
})
.WithName("ReplayAllDLQMessages")
.WithOpenApi();

// Send scheduled message
app.MapPost("/api/namespace/{sessionId}/{entityName}/send-scheduled", async (
    string sessionId,
    string entityName,
    SendScheduledMessageRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        await using var sender = client.CreateSender(entityName);

        var message = new ServiceBusMessage(request.Message)
        {
            MessageId = Guid.NewGuid().ToString(),
            ContentType = "application/json"
        };

        if (request.ApplicationProperties != null)
        {
            foreach (var prop in request.ApplicationProperties)
            {
                message.ApplicationProperties[prop.Key] = prop.Value;
            }
        }

        var scheduleTime = DateTime.UtcNow.AddSeconds(request.DelaySeconds);
        var sequenceNumber = await sender.ScheduleMessageAsync(message, scheduleTime);

        app.Logger.LogInformation("Scheduled message to {EntityName} with delay {Delay}s, SequenceNumber: {SeqNum}", 
            entityName, request.DelaySeconds, sequenceNumber);

        return Results.Ok(new 
        { 
            success = true, 
            sequenceNumber,
            scheduledEnqueueTime = scheduleTime,
            messageId = message.MessageId
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to schedule message to {EntityName}", entityName);
        return Results.Problem("Failed to schedule message");
    }
})
.WithName("SendScheduledMessage")
.WithOpenApi();

// Cancel scheduled message
app.MapPost("/api/namespace/{sessionId}/{entityName}/cancel-scheduled", async (
    string sessionId,
    string entityName,
    CancelScheduledRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        await using var sender = client.CreateSender(entityName);

        await sender.CancelScheduledMessageAsync(request.SequenceNumber);

        app.Logger.LogInformation("Canceled scheduled message {SeqNum} from {EntityName}", 
            request.SequenceNumber, entityName);

        return Results.Ok(new { success = true, message = "Scheduled message canceled" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to cancel scheduled message {SeqNum} from {EntityName}", 
            request.SequenceNumber, entityName);
        return Results.Problem("Failed to cancel scheduled message");
    }
})
.WithName("CancelScheduledMessage")
.WithOpenApi();

// ============================================================================
// Subscription Rules Management
// ============================================================================

// Get all rules for a subscription
app.MapGet("/api/subscription/{sessionId}/{topicName}/{subscriptionName}/rules", async (
    string sessionId,
    string topicName,
    string subscriptionName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        var rules = new List<object>();

        await foreach (var rule in adminClient.GetRulesAsync(topicName, subscriptionName))
        {
            var ruleInfo = new
            {
                name = rule.Name,
                filter = rule.Filter switch
                {
                    SqlRuleFilter sqlFilter => (object)new
                    {
                        type = "SqlFilter",
                        sqlExpression = sqlFilter.SqlExpression,
                        parameters = sqlFilter.Parameters.ToDictionary(p => p.Key, p => p.Value)
                    },
                    CorrelationRuleFilter corrFilter => (object)new
                    {
                        type = "CorrelationFilter",
                        correlationId = corrFilter.CorrelationId,
                        messageId = corrFilter.MessageId,
                        to = corrFilter.To,
                        replyTo = corrFilter.ReplyTo,
                        subject = corrFilter.Subject,
                        sessionId = corrFilter.SessionId,
                        replyToSessionId = corrFilter.ReplyToSessionId,
                        contentType = corrFilter.ContentType,
                        properties = corrFilter.ApplicationProperties.ToDictionary(p => p.Key, p => p.Value)
                    },
                    _ => (object)new { type = "TrueFilter" }
                },
                action = rule.Action is SqlRuleAction sqlAction ? new
                {
                    type = "SqlAction",
                    sqlExpression = sqlAction.SqlExpression,
                    parameters = sqlAction.Parameters.ToDictionary(p => p.Key, p => p.Value)
                } : null
            };
            rules.Add(ruleInfo);
        }

        app.Logger.LogInformation("Retrieved {Count} rules for {Topic}/{Subscription}",
            rules.Count, topicName, subscriptionName);

        return Results.Ok(new { topicName, subscriptionName, rules, count = rules.Count });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to get rules for {Topic}/{Subscription}",
            topicName, subscriptionName);
        return Results.Problem($"Failed to retrieve rules: {ex.Message}");
    }
})
.WithName("GetSubscriptionRules")
.WithOpenApi();

// Create a new rule
app.MapPost("/api/subscription/{sessionId}/{topicName}/{subscriptionName}/rules", async (
    string sessionId,
    string topicName,
    string subscriptionName,
    CreateRuleRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    if (string.IsNullOrWhiteSpace(request.RuleName))
    {
        return Results.BadRequest(new { error = "Rule name is required" });
    }

    try
    {
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        
        RuleFilter filter;
        if (request.FilterType == "Sql" && !string.IsNullOrWhiteSpace(request.SqlExpression))
        {
            var sqlFilter = new SqlRuleFilter(request.SqlExpression);
            if (request.Parameters != null)
            {
                foreach (var param in request.Parameters)
                {
                    sqlFilter.Parameters.Add(param.Key, param.Value);
                }
            }
            filter = sqlFilter;
        }
        else if (request.FilterType == "Correlation")
        {
            var corrFilter = new CorrelationRuleFilter();
            if (!string.IsNullOrWhiteSpace(request.CorrelationId))
                corrFilter.CorrelationId = request.CorrelationId;
            if (!string.IsNullOrWhiteSpace(request.MessageId))
                corrFilter.MessageId = request.MessageId;
            if (!string.IsNullOrWhiteSpace(request.Subject))
                corrFilter.Subject = request.Subject;
            if (!string.IsNullOrWhiteSpace(request.To))
                corrFilter.To = request.To;
            if (!string.IsNullOrWhiteSpace(request.ReplyTo))
                corrFilter.ReplyTo = request.ReplyTo;
            if (!string.IsNullOrWhiteSpace(request.SessionId))
                corrFilter.SessionId = request.SessionId;
            if (!string.IsNullOrWhiteSpace(request.ContentType))
                corrFilter.ContentType = request.ContentType;
            if (request.Properties != null)
            {
                foreach (var prop in request.Properties)
                {
                    corrFilter.ApplicationProperties.Add(prop.Key, prop.Value);
                }
            }
            filter = corrFilter;
        }
        else
        {
            filter = new TrueRuleFilter();
        }

        RuleAction? action = null;
        if (!string.IsNullOrWhiteSpace(request.ActionSqlExpression))
        {
            var sqlAction = new SqlRuleAction(request.ActionSqlExpression);
            if (request.ActionParameters != null)
            {
                foreach (var param in request.ActionParameters)
                {
                    sqlAction.Parameters.Add(param.Key, param.Value);
                }
            }
            action = sqlAction;
        }

        var ruleProperties = action != null
            ? new CreateRuleOptions(request.RuleName, filter) { Action = action }
            : new CreateRuleOptions(request.RuleName, filter);

        await adminClient.CreateRuleAsync(topicName, subscriptionName, ruleProperties);

        app.Logger.LogInformation("Created rule {RuleName} for {Topic}/{Subscription}",
            request.RuleName, topicName, subscriptionName);

        return Results.Ok(new
        {
            message = $"Rule '{request.RuleName}' created successfully",
            ruleName = request.RuleName,
            filterType = request.FilterType
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to create rule {RuleName} for {Topic}/{Subscription}",
            request.RuleName, topicName, subscriptionName);
        return Results.Problem($"Failed to create rule: {ex.Message}");
    }
})
.WithName("CreateSubscriptionRule")
.WithOpenApi();

// Delete a rule
app.MapDelete("/api/subscription/{sessionId}/{topicName}/{subscriptionName}/rules/{ruleName}", async (
    string sessionId,
    string topicName,
    string subscriptionName,
    string ruleName) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    // Prevent deletion of default rule
    if (ruleName.Equals("$Default", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { error = "Cannot delete the $Default rule" });
    }

    try
    {
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        await adminClient.DeleteRuleAsync(topicName, subscriptionName, ruleName);

        app.Logger.LogInformation("Deleted rule {RuleName} from {Topic}/{Subscription}",
            ruleName, topicName, subscriptionName);

        return Results.Ok(new
        {
            message = $"Rule '{ruleName}' deleted successfully",
            ruleName
        });
    }
    catch (ServiceBusException ex) when (ex.Reason == ServiceBusFailureReason.MessagingEntityNotFound)
    {
        return Results.NotFound(new { error = $"Rule '{ruleName}' not found" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to delete rule {RuleName} from {Topic}/{Subscription}",
            ruleName, topicName, subscriptionName);
        return Results.Problem($"Failed to delete rule: {ex.Message}");
    }
})
.WithName("DeleteSubscriptionRule")
.WithOpenApi();

// ============================================================================
// Message Import/Upload
// ============================================================================

// Import/upload multiple messages from JSON array
app.MapPost("/api/namespace/{sessionId}/{entityName}/import", async (
    string sessionId,
    string entityName,
    ImportMessagesRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    if (request.Messages == null || request.Messages.Count == 0)
    {
        return Results.BadRequest(new { error = "No messages provided" });
    }

    if (request.Messages.Count > 1000)
    {
        return Results.BadRequest(new { error = "Cannot import more than 1000 messages at once" });
    }

    try
    {
        await using var client = new ServiceBusClient(session.ConnectionString);
        await using var sender = client.CreateSender(entityName);

        int successCount = 0;
        int failCount = 0;
        var errors = new List<string>();

        using var messageBatch = await sender.CreateMessageBatchAsync();

        foreach (var msg in request.Messages)
        {
            try
            {
                var sbMessage = new ServiceBusMessage(msg.Body ?? string.Empty);

                // Set message properties
                if (!string.IsNullOrEmpty(msg.MessageId))
                    sbMessage.MessageId = msg.MessageId;
                if (!string.IsNullOrEmpty(msg.CorrelationId))
                    sbMessage.CorrelationId = msg.CorrelationId;
                if (!string.IsNullOrEmpty(msg.Subject))
                    sbMessage.Subject = msg.Subject;
                if (!string.IsNullOrEmpty(msg.ContentType))
                    sbMessage.ContentType = msg.ContentType;
                if (!string.IsNullOrEmpty(msg.SessionId))
                    sbMessage.SessionId = msg.SessionId;
                if (!string.IsNullOrEmpty(msg.ReplyTo))
                    sbMessage.ReplyTo = msg.ReplyTo;
                if (!string.IsNullOrEmpty(msg.To))
                    sbMessage.To = msg.To;
                if (msg.TimeToLive.HasValue && msg.TimeToLive.Value > 0)
                    sbMessage.TimeToLive = TimeSpan.FromSeconds(msg.TimeToLive.Value);
                if (msg.ScheduledEnqueueTime.HasValue)
                    sbMessage.ScheduledEnqueueTime = msg.ScheduledEnqueueTime.Value;

                // Add application properties
                if (msg.ApplicationProperties != null)
                {
                    foreach (var prop in msg.ApplicationProperties)
                    {
                        sbMessage.ApplicationProperties[prop.Key] = prop.Value;
                    }
                }

                // Add import metadata
                sbMessage.ApplicationProperties["ImportedAt"] = DateTime.UtcNow.ToString("o");
                sbMessage.ApplicationProperties["ImportSource"] = "ServiceBusInspector";

                // Try to add to batch
                if (!messageBatch.TryAddMessage(sbMessage))
                {
                    // Batch is full, send it
                    if (messageBatch.Count > 0)
                    {
                        await sender.SendMessagesAsync(messageBatch);
                        successCount += messageBatch.Count;
                    }

                    // Create a new batch and add the message
                    using var newBatch = await sender.CreateMessageBatchAsync();
                    if (!newBatch.TryAddMessage(sbMessage))
                    {
                        failCount++;
                        errors.Add($"Message too large to fit in batch: {msg.MessageId ?? "unknown"}");
                        continue;
                    }
                    
                    await sender.SendMessagesAsync(newBatch);
                    successCount++;
                }
            }
            catch (Exception ex)
            {
                failCount++;
                errors.Add($"Failed to process message {msg.MessageId ?? "unknown"}: {ex.Message}");
            }
        }

        // Send remaining messages in the batch
        if (messageBatch.Count > 0)
        {
            await sender.SendMessagesAsync(messageBatch);
            successCount += messageBatch.Count;
        }

        app.Logger.LogInformation("Imported {SuccessCount}/{Total} messages to {EntityName}",
            successCount, request.Messages.Count, entityName);

        return Results.Ok(new
        {
            message = $"Imported {successCount} messages successfully",
            successCount,
            failCount,
            totalMessages = request.Messages.Count,
            errors = errors.Take(10).ToList() // Return first 10 errors
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to import messages to {EntityName}", entityName);
        return Results.Problem($"Failed to import messages: {ex.Message}");
    }
})
.WithName("ImportMessages")
.WithOpenApi();

// ============================================================================
// Debug/Diagnostics Endpoints (Read-only, no secrets)
// ============================================================================

// Compare queue vs DLQ metadata (headers only, no message bodies)
app.MapGet("/api/debug/{sessionId}/peek-compare", async (
    HttpContext context,
    string sessionId) =>
{
    var queue = context.Request.Query["queue"].ToString();
    var subscriptionName = context.Request.Query["subscriptionName"].ToString();
    
    if (string.IsNullOrEmpty(queue))
    {
        return Results.BadRequest(new { error = "queue parameter is required" });
    }

    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }

    if (session.ExpiresAtUtc < DateTime.UtcNow)
    {
        sessions.TryRemove(sessionId, out _);
        return Results.Unauthorized();
    }

    try
    {
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? queue 
            : $"{queue}/subscriptions/{subscriptionName}";

        await using var client = new ServiceBusClient(session.ConnectionString);
        
        // Peek from main queue
        var mainReceiverOptions = new ServiceBusReceiverOptions();
        await using var mainReceiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(queue, mainReceiverOptions)
            : client.CreateReceiver(queue, subscriptionName, mainReceiverOptions);
        var mainMessages = await mainReceiver.PeekMessagesAsync(20);
        
        // Peek from DLQ
        var dlqReceiverOptions = new ServiceBusReceiverOptions { SubQueue = SubQueue.DeadLetter };
        await using var dlqReceiver = string.IsNullOrEmpty(subscriptionName)
            ? client.CreateReceiver(queue, dlqReceiverOptions)
            : client.CreateReceiver(queue, subscriptionName, dlqReceiverOptions);
        var dlqMessages = await dlqReceiver.PeekMessagesAsync(20);

        // Return metadata only (no body for comparison - keeps response small and secure)
        var mainMetadata = mainMessages.Select(m => new
        {
            messageId = m.MessageId,
            sequenceNumber = m.SequenceNumber,
            enqueuedTimeUtc = m.EnqueuedTime.UtcDateTime,
            deliveryCount = m.DeliveryCount,
            subject = m.Subject,
            correlationId = m.CorrelationId
        }).ToList();

        var dlqMetadata = dlqMessages.Select(m => new
        {
            messageId = m.MessageId,
            sequenceNumber = m.SequenceNumber,
            enqueuedTimeUtc = m.EnqueuedTime.UtcDateTime,
            deliveryCount = m.DeliveryCount,
            subject = m.Subject,
            correlationId = m.CorrelationId,
            deadLetterReason = m.DeadLetterReason,
            deadLetterErrorDescription = m.DeadLetterErrorDescription
        }).ToList();

        app.Logger.LogInformation("Peek-compare for {EntityPath}: main={MainCount}, dlq={DLQCount}", 
            entityPath, mainMetadata.Count, dlqMetadata.Count);

        return Results.Ok(new 
        { 
            queue = entityPath,
            mainQueue = new { count = mainMetadata.Count, messages = mainMetadata },
            deadLetterQueue = new { count = dlqMetadata.Count, messages = dlqMetadata }
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Peek-compare failed for session {SessionId}, queue {Queue}", sessionId, queue);
        return Results.Problem("Peek-compare failed");
    }
})
.WithName("PeekCompare")
.WithOpenApi();

// ============================================================================
// AI Insights Endpoints
// ============================================================================

/// <summary>
/// Generate test messages with controlled anomalies for AI analysis.
/// Sends messages to active queues/topics and optionally creates DLQ candidates.
/// </summary>
app.MapPost("/api/messages/generate", async (
    string sessionId,
    GenerateMessagesRequest request) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }
    
    try
    {
        // Validate request
        if (request.Count < 10 || request.Count > 300)
        {
            return Results.BadRequest("Count must be between 10 and 300");
        }
        
        if (string.IsNullOrEmpty(request.QueueName) && string.IsNullOrEmpty(request.TopicName))
        {
            return Results.BadRequest("Must specify QueueName or TopicName");
        }
        
        // Generate messages
        var messages = aiInsightsService.GenerateTestMessages(
            request.Count,
            request.IncludeDlqTestCases,
            out int anomalousCount,
            out int dlqCount
        );

        static bool IsDlqCandidate(ServiceBusMessage message)
        {
            if (!message.ApplicationProperties.TryGetValue("ForceDlq", out var value))
            {
                return false;
            }

            return value switch
            {
                bool b => b,
                string s => string.Equals(s, "true", StringComparison.OrdinalIgnoreCase),
                _ => false
            };
        }

        static async Task<int> DeadLetterByMessageIdAsync(
            ServiceBusReceiver receiver,
            HashSet<string> targetMessageIds,
            string deadLetterReason,
            string deadLetterErrorDescription,
            TimeSpan maxDuration)
        {
            if (targetMessageIds.Count == 0)
            {
                return 0;
            }

            var deadline = DateTime.UtcNow.Add(maxDuration);
            var deadLettered = 0;
            var consecutiveEmptyReceives = 0;

            while (targetMessageIds.Count > 0 && DateTime.UtcNow < deadline)
            {
                var batchSize = Math.Min(20, Math.Max(1, targetMessageIds.Count));
                var received = await receiver.ReceiveMessagesAsync(batchSize, TimeSpan.FromSeconds(1));

                if (received.Count == 0)
                {
                    consecutiveEmptyReceives++;
                    if (consecutiveEmptyReceives >= 5)
                    {
                        break;
                    }
                    continue;
                }

                consecutiveEmptyReceives = 0;

                foreach (var message in received)
                {
                    if (targetMessageIds.Contains(message.MessageId))
                    {
                        await receiver.DeadLetterMessageAsync(
                            message,
                            deadLetterReason: deadLetterReason,
                            deadLetterErrorDescription: deadLetterErrorDescription);
                        targetMessageIds.Remove(message.MessageId);
                        deadLettered++;
                    }
                    else
                    {
                        // Not one of the requested DLQ candidates; release lock without removing from the queue.
                        await receiver.AbandonMessageAsync(message);
                    }
                }
            }

            return deadLettered;
        }

        var generationId = Guid.NewGuid().ToString("N");
        foreach (var message in messages)
        {
            message.ApplicationProperties["GenerationId"] = generationId;
        }

        var dlqCandidateMessageIds = messages
            .Where(IsDlqCandidate)
            .Select(m => m.MessageId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.Ordinal);

        var dlqCandidateMessages = messages.Where(IsDlqCandidate).ToList();
        var nonDlqMessages = messages.Where(m => !IsDlqCandidate(m)).ToList();

        var deadLetterReasonText = "Generated DLQ test case";
        var deadLetterDescriptionText = $"GenerationId={generationId}";
        
        var client = new ServiceBusClient(session.ConnectionString);
        var adminClient = new ServiceBusAdministrationClient(session.ConnectionString);
        var errors = new List<string>();
        int totalSent = 0;
        int queueDeadLettered = 0;
        int subscriptionDeadLettered = 0;
        var fatalSendErrors = 0;
        
        // Send to queue if specified
        if (!string.IsNullOrEmpty(request.QueueName) && 
            (request.TargetType == "Queue" || request.TargetType == "Both"))
        {
            try
            {
                await using var sender = client.CreateSender(request.QueueName);
                
                // Send DLQ candidates first to reduce race/ordering issues during the dead-letter pass.
                if (dlqCandidateMessages.Count > 0)
                {
                    await sender.SendMessagesAsync(dlqCandidateMessages);
                    totalSent += dlqCandidateMessages.Count;
                }
                if (nonDlqMessages.Count > 0)
                {
                    await sender.SendMessagesAsync(nonDlqMessages);
                    totalSent += nonDlqMessages.Count;
                }

                // Force a subset into the real DLQ by receiving + dead-lettering them.
                if (request.IncludeDlqTestCases && dlqCandidateMessageIds.Count > 0)
                {
                    var receiverOptions = new ServiceBusReceiverOptions
                    {
                        ReceiveMode = ServiceBusReceiveMode.PeekLock,
                        PrefetchCount = Math.Min(200, Math.Max(20, request.Count))
                    };
                    await using var receiver = client.CreateReceiver(request.QueueName, receiverOptions);

                    // Deterministic retry window: bounded and proportional to candidate count.
                    var maxDuration = TimeSpan.FromSeconds(Math.Min(30, Math.Max(8, dlqCandidateMessageIds.Count * 2)));
                    queueDeadLettered = await DeadLetterByMessageIdAsync(
                        receiver,
                        new HashSet<string>(dlqCandidateMessageIds, StringComparer.Ordinal),
                        deadLetterReasonText,
                        deadLetterDescriptionText,
                        maxDuration);
                }
            }
            catch (Exception ex)
            {
                errors.Add($"Queue send error: {ex.Message}");
                fatalSendErrors++;
                app.Logger.LogError(ex, "Failed to send messages to queue {Queue}", request.QueueName);
            }
        }
        
        // Send to topic if specified
        if (!string.IsNullOrEmpty(request.TopicName) && 
            (request.TargetType == "Topic" || request.TargetType == "Both"))
        {
            try
            {
                await using var sender = client.CreateSender(request.TopicName);
                
                // Send DLQ candidates first for consistency (DLQ for topics is subscription-scoped).
                if (dlqCandidateMessages.Count > 0)
                {
                    await sender.SendMessagesAsync(dlqCandidateMessages);
                    totalSent += dlqCandidateMessages.Count;
                }
                if (nonDlqMessages.Count > 0)
                {
                    await sender.SendMessagesAsync(nonDlqMessages);
                    totalSent += nonDlqMessages.Count;
                }

                // Topic DLQ is subscription-scoped. To keep DLQ generation verifiable and UI-friendly,
                // dead-letter into a single explicit subscription.
                if (request.IncludeDlqTestCases && dlqCandidateMessageIds.Count > 0)
                {
                    string? targetSubscriptionName = null;

                    if (!string.IsNullOrWhiteSpace(request.SubscriptionName))
                    {
                        targetSubscriptionName = request.SubscriptionName;
                    }
                    else
                    {
                        var subscriptionNames = new List<string>();
                        await foreach (var subProperties in adminClient.GetSubscriptionsAsync(request.TopicName))
                        {
                            if (!string.IsNullOrWhiteSpace(subProperties.SubscriptionName))
                            {
                                subscriptionNames.Add(subProperties.SubscriptionName);
                            }
                        }
                        targetSubscriptionName = subscriptionNames
                            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                            .FirstOrDefault();
                    }

                    if (string.IsNullOrWhiteSpace(targetSubscriptionName))
                    {
                        errors.Add($"Cannot DLQ topic messages for '{request.TopicName}': no subscriptions exist");
                    }
                    else
                    {
                        var receiverOptions = new ServiceBusReceiverOptions { ReceiveMode = ServiceBusReceiveMode.PeekLock };
                        await using var receiver = client.CreateReceiver(request.TopicName, targetSubscriptionName, receiverOptions);

                        var maxDuration = TimeSpan.FromSeconds(Math.Min(20, Math.Max(5, dlqCandidateMessageIds.Count)));
                        subscriptionDeadLettered = await DeadLetterByMessageIdAsync(
                            receiver,
                            new HashSet<string>(dlqCandidateMessageIds, StringComparer.Ordinal),
                            deadLetterReasonText,
                            deadLetterDescriptionText,
                            maxDuration);

                        app.Logger.LogInformation(
                            "DLQ generation (topic): topicName={TopicName} subscriptionName={SubscriptionName} dlqCandidates={DlqCandidates} deadLettered={DeadLettered} generationId={GenerationId}",
                            request.TopicName,
                            targetSubscriptionName,
                            dlqCandidateMessageIds.Count,
                            subscriptionDeadLettered,
                            generationId);

                        // Persist for response
                        request = request with { SubscriptionName = targetSubscriptionName };
                    }
                }
            }
            catch (Exception ex)
            {
                errors.Add($"Topic send error: {ex.Message}");
                fatalSendErrors++;
                app.Logger.LogError(ex, "Failed to send messages to topic {Topic}", request.TopicName);
            }
        }
        
        await client.DisposeAsync();
        
        var response = new GenerateMessagesResponse
        {
            TotalGenerated = totalSent,
            AnomalousCount = anomalousCount,
            DlqCandidates = dlqCount,
            DlqDeadLettered = queueDeadLettered + subscriptionDeadLettered,
            DlqDeadLetteredQueue = queueDeadLettered,
            DlqDeadLetteredSubscriptions = subscriptionDeadLettered,
            DlqTopicName = request.TopicName,
            DlqSubscriptionName = request.SubscriptionName,
            Errors = errors,
            Success = fatalSendErrors == 0
        };
        
        app.Logger.LogInformation(
            "Generated {Count} messages for session {SessionId}: {Anomalous} anomalous, {DLQ} DLQ candidates",
            totalSent, sessionId, anomalousCount, dlqCount
        );

        if (request.IncludeDlqTestCases && dlqCandidateMessageIds.Count > 0)
        {
            app.Logger.LogInformation(
                "DLQ generation summary for session {SessionId}: queueDeadLettered={QueueDLQ}, subscriptionDeadLettered={SubDLQ}, generationId={GenerationId}",
                sessionId,
                queueDeadLettered,
                subscriptionDeadLettered,
                generationId);
        }
        
        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Message generation failed for session {SessionId}", sessionId);
        return Results.Problem("Message generation failed");
    }
})
.WithName("GenerateTestMessages")
.WithOpenApi();

/// <summary>
/// Analyze messages using AI Insights service.
/// Samples messages from active queue and optionally DLQ, then calls FastAPI service.
/// </summary>
app.MapPost("/api/messages/analyze", async (
    string sessionId,
    AnalyzeMessagesRequest request,
    CancellationToken cancellationToken) =>
{
    if (!sessions.TryGetValue(sessionId, out var session))
    {
        return Results.Unauthorized();
    }
    
    try
    {
        var client = new ServiceBusClient(session.ConnectionString);
        var activeMessages = new List<object>();
        var dlqMessages = new List<object>();
        
        // Sample messages from active queue
        try
        {
            var receiver = client.CreateReceiver(request.QueueName);
            var peeked = await receiver.PeekMessagesAsync(request.MaxSampleSize, cancellationToken: cancellationToken);
            
            foreach (var msg in peeked)
            {
                try
                {
                    var body = msg.Body.ToString();
                    var messageData = JsonSerializer.Deserialize<Dictionary<string, object>>(body);
                    
                    if (messageData != null)
                    {
                        // Ensure required fields for AI service
                        if (!messageData.ContainsKey("message_id"))
                            messageData["message_id"] = msg.MessageId;
                        if (!messageData.ContainsKey("event_type"))
                            messageData["event_type"] = msg.Subject ?? "Unknown";
                        if (!messageData.ContainsKey("correlation_id"))
                            messageData["correlation_id"] = msg.CorrelationId;
                        if (!messageData.ContainsKey("timestamp"))
                            messageData["timestamp"] = msg.EnqueuedTime.UtcDateTime.ToString("O");
                        if (!messageData.ContainsKey("payload"))
                            messageData["payload"] = new Dictionary<string, object>();
                        
                        activeMessages.Add(messageData);
                    }
                }
                catch
                {
                    // Skip malformed messages
                }
            }
            
            await receiver.CloseAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Failed to peek active queue messages");
        }
        
        // Sample messages from DLQ if requested
        if (request.IncludeDlq)
        {
            try
            {
                var dlqPath = $"{request.QueueName}/$DeadLetterQueue";
                var dlqReceiver = client.CreateReceiver(dlqPath);
                var peekedDlq = await dlqReceiver.PeekMessagesAsync(
                    request.MaxSampleSize / 2, 
                    cancellationToken: cancellationToken
                );
                
                foreach (var msg in peekedDlq)
                {
                    try
                    {
                        var body = msg.Body.ToString();
                        var messageData = JsonSerializer.Deserialize<Dictionary<string, object>>(body);
                        
                        if (messageData != null)
                        {
                            if (!messageData.ContainsKey("message_id"))
                                messageData["message_id"] = msg.MessageId;
                            if (!messageData.ContainsKey("event_type"))
                                messageData["event_type"] = msg.Subject ?? "Unknown";
                            if (!messageData.ContainsKey("correlation_id"))
                                messageData["correlation_id"] = msg.CorrelationId;
                            if (!messageData.ContainsKey("timestamp"))
                                messageData["timestamp"] = msg.EnqueuedTime.UtcDateTime.ToString("O");
                            if (!messageData.ContainsKey("payload"))
                                messageData["payload"] = new Dictionary<string, object>();
                            
                            dlqMessages.Add(messageData);
                        }
                    }
                    catch
                    {
                        // Skip malformed messages
                    }
                }
                
                await dlqReceiver.CloseAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "Failed to peek DLQ messages");
            }
        }
        
        await client.DisposeAsync();
        
        // Call AI Insights service for active queue
        AiInsightsAnalysis? activeAnalysis = null;
        if (activeMessages.Count > 0)
        {
            var result = await aiInsightsService.AnalyzeMessagesAsync(activeMessages, cancellationToken);
            if (result != null)
            {
                activeAnalysis = new AiInsightsAnalysis
                {
                    Source = "ActiveQueue",
                    TotalMessages = result.TotalMessages,
                    Clusters = result.Clusters.Select(c => c with { }).ToList(),
                    Outliers = result.Outliers.Select(o => o with { Source = "ActiveQueue" }).ToList(),
                    ProcessingTimeMs = result.ProcessingTimeMs
                };
            }
        }
        
        // Call AI Insights service for DLQ
        AiInsightsAnalysis? dlqAnalysis = null;
        if (dlqMessages.Count > 0)
        {
            var result = await aiInsightsService.AnalyzeMessagesAsync(dlqMessages, cancellationToken);
            if (result != null)
            {
                dlqAnalysis = new AiInsightsAnalysis
                {
                    Source = "DeadLetterQueue",
                    TotalMessages = result.TotalMessages,
                    Clusters = result.Clusters.Select(c => c with { }).ToList(),
                    Outliers = result.Outliers.Select(o => o with { Source = "DeadLetterQueue" }).ToList(),
                    ProcessingTimeMs = result.ProcessingTimeMs
                };
            }
        }
        
        // Generate summary
        var summary = $"Analyzed {activeMessages.Count} active messages";
        if (dlqMessages.Count > 0)
        {
            summary += $" and {dlqMessages.Count} DLQ messages";
        }
        
        var totalClusters = (activeAnalysis?.Clusters.Count ?? 0) + (dlqAnalysis?.Clusters.Count ?? 0);
        var totalOutliers = (activeAnalysis?.Outliers.Count ?? 0) + (dlqAnalysis?.Outliers.Count ?? 0);
        summary += $". Found {totalClusters} patterns and {totalOutliers} anomalies.";
        
        var response = new CombinedAiInsightsResponse
        {
            ActiveQueueAnalysis = activeAnalysis,
            DlqAnalysis = dlqAnalysis,
            Summary = summary,
            AnalyzedAt = DateTime.UtcNow
        };
        
        app.Logger.LogInformation(
            "AI analysis for {Queue}: {ActiveCount} active, {DlqCount} DLQ, {Clusters} clusters, {Outliers} outliers",
            request.QueueName, activeMessages.Count, dlqMessages.Count, totalClusters, totalOutliers
        );
        
        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "AI analysis failed for session {SessionId}, queue {Queue}", sessionId, request.QueueName);
        return Results.Problem($"AI analysis failed: {ex.Message}");
    }
})
.WithName("AnalyzeMessages")
.WithOpenApi();

app.Run();

// ============================================================================
// Request/Response Models
// ============================================================================
record ConnectRequest(string ConnectionString);
record PeekRequest(int? MaxMessages);
record ReceiveRequest(string[] Tokens);
record SendMessageRequest(string EntityName, string Message, Dictionary<string, object>? ApplicationProperties = null);
record ReplayRequest(List<long> SequenceNumbers);
record ReplayAllRequest(int? MaxMessages = 100);
record SendScheduledMessageRequest(string Message, int DelaySeconds, Dictionary<string, object>? ApplicationProperties = null);
record CancelScheduledRequest(long SequenceNumber);
record CreateRuleRequest(
    string RuleName,
    string FilterType,
    string? SqlExpression = null,
    Dictionary<string, object>? Parameters = null,
    string? CorrelationId = null,
    string? MessageId = null,
    string? Subject = null,
    string? To = null,
    string? ReplyTo = null,
    string? SessionId = null,
    string? ContentType = null,
    Dictionary<string, object>? Properties = null,
    string? ActionSqlExpression = null,
    Dictionary<string, object>? ActionParameters = null
);

record ImportMessagesRequest(List<ImportMessage> Messages);

record ImportMessage(
    string? Body,
    string? MessageId = null,
    string? CorrelationId = null,
    string? Subject = null,
    string? ContentType = null,
    string? SessionId = null,
    string? ReplyTo = null,
    string? To = null,
    int? TimeToLive = null,
    DateTimeOffset? ScheduledEnqueueTime = null,
    Dictionary<string, object>? ApplicationProperties = null
);
