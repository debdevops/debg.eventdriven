using System.Collections.Concurrent;

namespace ServiceBusInspectorApi.Models;

/// <summary>
/// Represents an ephemeral session created when a user connects with a Service Bus connection string.
/// Sessions expire after a configured timeout (default 10 minutes for development).
/// The connection string is stored in memory only and never persisted or logged.
/// PRODUCTION: Replace in-memory store with Redis or Azure Cache for Redis for distributed deployments.
/// </summary>
public class SessionInfo
{
    public string SessionId { get; set; } = string.Empty;
    
    /// <summary>
    /// Service Bus connection string stored in memory.
    /// SECURITY: Never log, persist, or return this value to clients.
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;
    
    /// <summary>
    /// Service Bus namespace host (e.g., "my-namespace.servicebus.windows.net").
    /// Safe to log as it does not contain secrets.
    /// </summary>
    public string NamespaceHost { get; set; } = string.Empty;
    
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    
    /// <summary>
    /// Maps ephemeral tokens (sent to client) to lock tokens (kept server-side).
    /// This ensures lock tokens never leave the backend.
    /// </summary>
    public ConcurrentDictionary<string, TokenMapping> TokenMappings { get; set; } = new();
}
