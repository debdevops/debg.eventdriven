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
        return Results.Problem("Failed to create session. Ensure the connection string is valid.");
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
        return Results.Problem("Failed to list entities");
    }
})
.WithName("ListEntities")
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
        return Results.Problem("Failed to list subscriptions");
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
        // Build entity path - for subscriptions: topicName/subscriptions/subscriptionName
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

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
            entityPath,
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
    PeekRequest request,
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

    try
    {
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";

        await using var client = new ServiceBusClient(session.ConnectionString);
        
        var receiverOptions = new ServiceBusReceiverOptions();
        if (isDLQ)
        {
            receiverOptions.SubQueue = SubQueue.DeadLetter;
            app.Logger.LogInformation("Creating DLQ receiver for {EntityPath} with SubQueue.DeadLetter", entityPath);
        }
        else
        {
            app.Logger.LogInformation("Creating main queue receiver for {EntityPath}", entityPath);
        }
        
        await using var receiver = client.CreateReceiver(entityPath, receiverOptions);

        var messages = await receiver.PeekMessagesAsync(request.MaxMessages ?? 10);

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

        var dlqSuffix = isDLQ ? " (DLQ)" : "";
        app.Logger.LogInformation("Peeked {Count} messages from {EntityPath}{DLQSuffix} - First message DeadLetterReason: {DLR}", 
            result.Count, entityPath, dlqSuffix, result.FirstOrDefault()?.deadLetterReason ?? "null");

        return Results.Ok(new { messages = result, peekedCount = result.Count });
    }
    catch (Exception ex)
    {
        var entityPath = string.IsNullOrEmpty(subscriptionName) 
            ? entityName 
            : $"{entityName}/subscriptions/{subscriptionName}";
        var dlqSuffix = isDLQ ? " (DLQ)" : "";
        app.Logger.LogError(ex, "Peek failed for session {SessionId}, entity {EntityPath}{DLQSuffix}", 
            sessionId, entityPath, dlqSuffix);
        return Results.Problem("Peek failed");
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
        
        await using var receiver = client.CreateReceiver(entityPath, receiverOptions);

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
        await using var mainReceiver = client.CreateReceiver(entityPath, mainReceiverOptions);
        var mainMessages = await mainReceiver.PeekMessagesAsync(20);
        
        // Peek from DLQ
        var dlqReceiverOptions = new ServiceBusReceiverOptions { SubQueue = SubQueue.DeadLetter };
        await using var dlqReceiver = client.CreateReceiver(entityPath, dlqReceiverOptions);
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

app.Run();

// ============================================================================
// Request/Response Models
// ============================================================================
record ConnectRequest(string ConnectionString);
record PeekRequest(int? MaxMessages);
record ReceiveRequest(string[] Tokens);
record SendMessageRequest(string EntityName, string Message, Dictionary<string, object>? ApplicationProperties = null);
