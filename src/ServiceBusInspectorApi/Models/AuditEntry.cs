namespace ServiceBusInspectorApi.Models;

/// <summary>
/// Audit entry for tracking all message receive operations.
/// Stored as newline-delimited JSON in file system (POC) or Cosmos DB (production).
/// </summary>
public class AuditEntry
{
    public DateTime Timestamp { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public string MessageId { get; set; } = string.Empty;
    public long SequenceNumber { get; set; }
    public string? UserId { get; set; }
    public string? CorrelationId { get; set; }
}
