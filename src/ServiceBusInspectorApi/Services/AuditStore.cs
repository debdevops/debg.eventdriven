using System.Text.Json;

namespace ServiceBusInspectorApi.Services;

/// <summary>
/// File-based audit store for POC purposes.
/// Records all message receive operations for compliance and troubleshooting.
/// PRODUCTION: Migrate to Cosmos DB or Azure Table Storage for scalability and queryability.
/// </summary>
public class AuditStore
{
    private readonly string _auditLogPath;
    private readonly ILogger<AuditStore> _logger;
    private readonly SemaphoreSlim _writeLock = new(1, 1);

    public AuditStore(ILogger<AuditStore> logger, IConfiguration configuration)
    {
        _logger = logger;
        
        // Default to data/audit.log relative to the application directory
        var dataDirectory = Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(dataDirectory);
        
        _auditLogPath = Path.Combine(dataDirectory, "audit.log");
        
        _logger.LogInformation("Audit store initialized at {Path}", _auditLogPath);
    }

    /// <summary>
    /// Logs an audit entry to the file-based store.
    /// Each entry is a single-line JSON document (newline-delimited JSON).
    /// </summary>
    public async Task LogAsync(Models.AuditEntry entry)
    {
        try
        {
            await _writeLock.WaitAsync();

            var json = JsonSerializer.Serialize(entry, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await File.AppendAllTextAsync(_auditLogPath, json + Environment.NewLine);

            _logger.LogInformation("Audit entry recorded for MessageId: {MessageId}, Operation: {Operation}",
                entry.MessageId, entry.Operation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write audit entry");
            // Don't throw - auditing failure shouldn't break the main operation
        }
        finally
        {
            _writeLock.Release();
        }
    }

    /// <summary>
    /// Retrieves recent audit entries (for debugging/monitoring).
    /// PRODUCTION: Replace with Cosmos DB query.
    /// </summary>
    public async Task<List<Models.AuditEntry>> GetRecentEntriesAsync(int count = 100)
    {
        try
        {
            if (!File.Exists(_auditLogPath))
            {
                return new List<Models.AuditEntry>();
            }

            var lines = await File.ReadAllLinesAsync(_auditLogPath);
            var entries = new List<Models.AuditEntry>();

            // Read last N lines
            var startIndex = Math.Max(0, lines.Length - count);
            for (int i = startIndex; i < lines.Length; i++)
            {
                try
                {
                    var entry = JsonSerializer.Deserialize<Models.AuditEntry>(lines[i]);
                    if (entry != null)
                    {
                        entries.Add(entry);
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Failed to parse audit entry at line {LineNumber}", i);
                }
            }

            return entries;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read audit entries");
            return new List<Models.AuditEntry>();
        }
    }

    // PRODUCTION MIGRATION TO COSMOS DB:
    // 
    // 1. Replace file I/O with Cosmos DB SDK:
    //    - Install: Azure.Cosmos package
    //    - Create CosmosClient with connection string from Key Vault
    //    - Use container.CreateItemAsync() instead of file append
    //
    // 2. Schema for Cosmos DB:
    //    {
    //      "id": "guid",
    //      "partitionKey": "sessionId",  // or date-based for time-series
    //      "timestamp": "2025-11-14T10:30:00Z",
    //      "sessionId": "abc123",
    //      "entityName": "test-queue",
    //      "operation": "Receive",
    //      "messageId": "msg-001",
    //      "sequenceNumber": 12345,
    //      "userId": "optional-user-identity",
    //      "correlationId": "optional-correlation-id"
    //    }
    //
    // 3. Indexing strategy:
    //    - Partition by sessionId or date (YYYY-MM-DD) for time-series queries
    //    - Index on timestamp, operation, messageId
    //
    // 4. Retention policy:
    //    - Enable Cosmos DB TTL to auto-delete old audit entries
    //    - Or implement archive to cold storage (Azure Blob)
    //
    // 5. Security:
    //    - Use Managed Identity for Cosmos DB access
    //    - Grant "Cosmos DB Built-in Data Contributor" role
    //    - Enable Cosmos DB audit logging
    //
    // 6. Example migration code:
    //    
    //    private readonly CosmosClient _cosmosClient;
    //    private readonly Container _container;
    //    
    //    public AuditStore(CosmosClient cosmosClient)
    //    {
    //        _cosmosClient = cosmosClient;
    //        _container = cosmosClient.GetContainer("AuditDB", "AuditEntries");
    //    }
    //    
    //    public async Task LogAsync(AuditEntry entry)
    //    {
    //        var document = new
    //        {
    //            id = Guid.NewGuid().ToString(),
    //            partitionKey = entry.SessionId,
    //            timestamp = entry.Timestamp,
    //            sessionId = entry.SessionId,
    //            entityName = entry.EntityName,
    //            operation = entry.Operation,
    //            messageId = entry.MessageId,
    //            sequenceNumber = entry.SequenceNumber
    //        };
    //        
    //        await _container.CreateItemAsync(document, 
    //            new PartitionKey(entry.SessionId));
    //    }
}
