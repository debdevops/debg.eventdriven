using Azure.Messaging.ServiceBus;
using System.Text.Json.Serialization;

namespace ServiceBusInspectorApi.Models;

/// <summary>
/// Maps an ephemeral token (sent to client) to the actual Service Bus received message.
/// This prevents exposing sensitive lock tokens to the client and keeps the message reference.
/// </summary>
public class TokenMapping
{
    public string EphemeralToken { get; set; } = string.Empty;
    
    /// <summary>
    /// The actual Service Bus message. Excluded from serialization to prevent
    /// accidental exposure of lock tokens and internal message data.
    /// </summary>
    [JsonIgnore]
    public ServiceBusReceivedMessage Message { get; set; } = null!;
    public string MessageId { get; set; } = string.Empty;
    public long SequenceNumber { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
}
