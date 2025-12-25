using System.Text;
using System.Text.Json;
using Azure.Messaging.ServiceBus;
using ServiceBusInspectorApi.Models;

namespace ServiceBusInspectorApi.Services;

/// <summary>
/// Service for generating realistic test messages with controlled anomalies.
/// Self-contained anomaly detection without external Python service dependency.
/// </summary>
public class AiInsightsService
{
    private readonly ILogger<AiInsightsService> _logger;
    private static readonly string[] EventTypes = 
    {
        "PaymentProcessed", "OrderCreated", "InventoryUpdated",
        "PaymentFailed", "OrderCancelled", "ShipmentDispatched"
    };
    
    /// <summary>
    /// Anomaly types for easy UI detection and display
    /// </summary>
    public static readonly string[] AnomalyTypes = 
    {
        "SUSPICIOUS_AMOUNT",      // Unusually high transaction amount
        "INVALID_CURRENCY",       // Invalid currency code
        "MISSING_REQUIRED_FIELD", // Required field missing
        "DUPLICATE_FLAG",         // Potential duplicate message
        "SCHEMA_VIOLATION",       // Invalid data type
        "TIMESTAMP_ANOMALY",      // Future or very old timestamp
        "HIGH_RETRY_COUNT",       // Message appears to be retrying
        "MALFORMED_PAYLOAD"       // Invalid JSON structure
    };
    
    private static readonly Random Random = new();
    
    public AiInsightsService(ILogger<AiInsightsService> logger)
    {
        _logger = logger;
    }
    
    /// <summary>
    /// Generates realistic test messages with controlled anomalies.
    /// Returns message payloads ready to be sent to Service Bus.
    /// Anomalies are marked with 'AnomalyType' and 'IsAnomaly' properties for UI display.
    /// </summary>
    public List<ServiceBusMessage> GenerateTestMessages(int count, bool includeDlqCandidates, out int anomalousCount, out int dlqCount)
    {
        var messages = new List<ServiceBusMessage>();
        anomalousCount = 0;
        dlqCount = 0;
        
        // Calculate anomaly percentage (15-25% for more visible testing)
        var anomalyPercentage = Random.Next(15, 26);
        var anomalyTargetCount = (int)Math.Ceiling(count * anomalyPercentage / 100.0);
        
        // Calculate DLQ candidates if requested (5-10%)
        var dlqTargetCount = includeDlqCandidates ? (int)Math.Ceiling(count * Random.Next(5, 11) / 100.0) : 0;
        
        _logger.LogInformation("Generating {Count} messages: {AnomalyTarget} anomalies ({AnomalyPct}%), {DlqTarget} DLQ candidates",
            count, anomalyTargetCount, anomalyPercentage, dlqTargetCount);
        
        for (int i = 0; i < count; i++)
        {
            var messageId = $"msg-{Guid.NewGuid():N}";
            var correlationId = $"corr-{Random.Next(1, count / 2)}"; // Reuse some correlation IDs
            var eventType = EventTypes[Random.Next(EventTypes.Length)];
            var timestamp = DateTime.UtcNow.AddSeconds(-Random.Next(0, 3600)); // Last hour
            
            // Decide if this message should be anomalous (distribute evenly)
            bool isAnomaly = anomalousCount < anomalyTargetCount && (i % (count / Math.Max(1, anomalyTargetCount)) == 0 || Random.Next(100) < 20);
            bool isDlqCandidate = !isAnomaly && dlqCount < dlqTargetCount && Random.Next(100) < 15;
            
            // Pick a specific anomaly type for this message
            string? anomalyType = null;
            if (isAnomaly)
            {
                anomalyType = AnomalyTypes[Random.Next(AnomalyTypes.Length)];
            }
            
            var payload = GeneratePayload(eventType, isAnomaly, isDlqCandidate, anomalyType);
            
            var message = new ServiceBusMessage(JsonSerializer.Serialize(new
            {
                message_id = messageId,
                event_type = eventType,
                correlation_id = isAnomaly && anomalyType == "MISSING_REQUIRED_FIELD" ? null : correlationId,
                timestamp = anomalyType == "TIMESTAMP_ANOMALY" 
                    ? DateTime.UtcNow.AddDays(Random.Next(1, 30)).ToString("O") // Future date!
                    : timestamp.ToString("O"),
                payload = payload,
                properties = new
                {
                    source = $"{eventType.ToLower()}-service",
                    version = "1.0",
                    generated = true
                }
            }))
            {
                MessageId = messageId,
                CorrelationId = correlationId,
                ContentType = "application/json"
            };
            
            // Add application properties for UI detection
            message.ApplicationProperties["EventType"] = eventType;
            message.ApplicationProperties["Generated"] = true;
            message.ApplicationProperties["GeneratedAt"] = DateTime.UtcNow.ToString("O");
            
            if (isAnomaly && anomalyType != null)
            {
                // CRITICAL: These properties allow UI to highlight anomalies
                message.ApplicationProperties["IsAnomaly"] = true;
                message.ApplicationProperties["AnomalyType"] = anomalyType;
                message.ApplicationProperties["AnomalySeverity"] = GetAnomalySeverity(anomalyType);
                message.ApplicationProperties["AnomalyDescription"] = GetAnomalyDescription(anomalyType);
                anomalousCount++;
            }
            
            if (isDlqCandidate)
            {
                message.ApplicationProperties["ForceDlq"] = true;
                message.ApplicationProperties["DlqReason"] = "TestDlqCandidate";
                dlqCount++;
            }
            
            messages.Add(message);
        }
        
        _logger.LogInformation("Generated {Count} messages: {Anomalies} anomalies, {Dlq} DLQ candidates",
            messages.Count, anomalousCount, dlqCount);
        
        return messages;
    }
    
    private static string GetAnomalySeverity(string anomalyType) => anomalyType switch
    {
        "SUSPICIOUS_AMOUNT" => "HIGH",
        "INVALID_CURRENCY" => "MEDIUM",
        "MISSING_REQUIRED_FIELD" => "HIGH",
        "DUPLICATE_FLAG" => "LOW",
        "SCHEMA_VIOLATION" => "HIGH",
        "TIMESTAMP_ANOMALY" => "MEDIUM",
        "HIGH_RETRY_COUNT" => "MEDIUM",
        "MALFORMED_PAYLOAD" => "CRITICAL",
        _ => "LOW"
    };
    
    private static string GetAnomalyDescription(string? anomalyType) => anomalyType switch
    {
        "SUSPICIOUS_AMOUNT" => "Transaction amount exceeds normal threshold",
        "INVALID_CURRENCY" => "Currency code is not recognized",
        "MISSING_REQUIRED_FIELD" => "Required field is missing or null",
        "DUPLICATE_FLAG" => "Potential duplicate message detected",
        "SCHEMA_VIOLATION" => "Data type does not match expected schema",
        "TIMESTAMP_ANOMALY" => "Timestamp is in the future or unusually old",
        "HIGH_RETRY_COUNT" => "Message has been retried multiple times",
        "MALFORMED_PAYLOAD" => "Message payload is malformed or invalid",
        // UI-generated anomaly types (lowercase with hyphens)
        "out-of-order-timestamp" => "Timestamp indicates out-of-order delivery",
        "negative-amount" => "Transaction amount is negative",
        "unexpected-event-type" => "Unrecognized event type",
        "duplicate-correlation" => "Duplicate correlation ID detected",
        "dlq-candidate" => "Message marked for dead letter queue",
        null => "Unknown anomaly detected",
        _ => $"Anomaly detected: {anomalyType}"
    };
    
    /// <summary>
    /// Generates payload for a specific event type with optional anomalies.
    /// </summary>
    private Dictionary<string, object> GeneratePayload(string eventType, bool isAnomaly, bool isDlqCandidate, string? anomalyType)
    {
        var payload = new Dictionary<string, object>();
        
        switch (eventType)
        {
            case "PaymentProcessed":
                payload["transaction_id"] = $"txn-{Random.Next(1000, 9999)}";
                
                // SUSPICIOUS_AMOUNT: abnormally high transaction
                payload["amount"] = (isAnomaly && anomalyType == "SUSPICIOUS_AMOUNT")
                    ? Random.Next(50000, 999999) // Very high amount!
                    : Math.Round(Random.NextDouble() * 500 + 10, 2);
                
                // INVALID_CURRENCY
                payload["currency"] = (isAnomaly && anomalyType == "INVALID_CURRENCY") 
                    ? "INVALID_XXX" 
                    : "USD";
                
                payload["status"] = isDlqCandidate ? "unknown" : "completed";
                payload["payment_method"] = Random.Next(3) switch
                {
                    0 => "credit_card",
                    1 => "paypal",
                    _ => "debit_card"
                };
                
                // MISSING_REQUIRED_FIELD: omit merchant_id
                if (!(isAnomaly && anomalyType == "MISSING_REQUIRED_FIELD"))
                {
                    payload["merchant_id"] = $"merch-{Random.Next(100, 999)}";
                }
                
                // DUPLICATE_FLAG
                if (isAnomaly && anomalyType == "DUPLICATE_FLAG")
                {
                    payload["duplicate_flag"] = true;
                    payload["original_transaction_id"] = $"txn-{Random.Next(1000, 9999)}";
                }
                
                // SCHEMA_VIOLATION: wrong data type
                if (isAnomaly && anomalyType == "SCHEMA_VIOLATION")
                {
                    payload["amount"] = "NOT_A_NUMBER"; // String instead of number
                }
                break;
            
            case "OrderCreated":
                payload["order_id"] = isDlqCandidate ? null! : $"ord-{Random.Next(2000, 9999)}";
                payload["customer_id"] = $"cust-{Random.Next(5000, 9999)}";
                
                payload["total_amount"] = (isAnomaly && anomalyType == "SUSPICIOUS_AMOUNT")
                    ? Random.Next(100000, 500000) // Huge order
                    : Math.Round(Random.NextDouble() * 1000 + 20, 2);
                
                payload["currency"] = (isAnomaly && anomalyType == "INVALID_CURRENCY") ? "FAKE" : "USD";
                payload["items_count"] = Random.Next(1, 10);
                
                if (!(isAnomaly && anomalyType == "MISSING_REQUIRED_FIELD"))
                {
                    payload["shipping_address"] = new Dictionary<string, object>
                    {
                        ["country"] = "US",
                        ["zip"] = $"{Random.Next(10000, 99999)}"
                    };
                }
                break;
            
            case "InventoryUpdated":
                payload["sku"] = $"PROD-{Random.Next(1000, 9999)}";
                payload["warehouse_id"] = $"WH-{Random.Next(1, 5) switch { 1 => "EAST", 2 => "WEST", 3 => "CENTRAL", _ => "SOUTH" }}";
                
                // SCHEMA_VIOLATION: string instead of number
                payload["quantity_change"] = (isAnomaly && anomalyType == "SCHEMA_VIOLATION")
                    ? "invalid_number" 
                    : Random.Next(-50, 100);
                    
                payload["new_quantity"] = Random.Next(0, 500);
                payload["reason"] = Random.Next(2) == 0 ? "order_fulfillment" : "restock";
                break;
            
            case "PaymentFailed":
                payload["transaction_id"] = $"txn-{Random.Next(9000, 9999)}";
                payload["amount"] = Math.Round(Random.NextDouble() * 300 + 10, 2);
                payload["currency"] = (isAnomaly && anomalyType == "INVALID_CURRENCY") ? "ZZZ" : "USD";
                payload["status"] = "failed";
                payload["error_code"] = Random.Next(3) switch
                {
                    0 => "INSUFFICIENT_FUNDS",
                    1 => "CARD_EXPIRED",
                    _ => "FRAUD_SUSPECTED"
                };
                payload["payment_method"] = Random.Next(2) == 0 ? "credit_card" : "paypal";
                
                // HIGH_RETRY_COUNT indicator
                if (isAnomaly && anomalyType == "HIGH_RETRY_COUNT")
                {
                    payload["retry_count"] = Random.Next(5, 15);
                    payload["last_retry_at"] = DateTime.UtcNow.AddMinutes(-Random.Next(1, 60)).ToString("O");
                }
                break;
            
            case "OrderCancelled":
                payload["order_id"] = $"ord-{Random.Next(3000, 9999)}";
                payload["customer_id"] = $"cust-{Random.Next(6000, 9999)}";
                payload["cancellation_reason"] = Random.Next(2) == 0 ? "customer_request" : "out_of_stock";
                payload["refund_amount"] = Math.Round(Random.NextDouble() * 500 + 20, 2);
                payload["currency"] = "USD";
                break;
            
            case "ShipmentDispatched":
                payload["shipment_id"] = $"ship-{Random.Next(4000, 9999)}";
                payload["order_id"] = $"ord-{Random.Next(2000, 9999)}";
                payload["tracking_number"] = $"TRK{Random.Next(100000000, 999999999)}";
                payload["carrier"] = Random.Next(3) switch
                {
                    0 => "FedEx",
                    1 => "UPS",
                    _ => "USPS"
                };
                payload["estimated_delivery"] = DateTime.UtcNow.AddDays(Random.Next(2, 7)).ToString("yyyy-MM-dd");
                break;
        }
        
        // MALFORMED_PAYLOAD: Add invalid nested structure
        if (isAnomaly && anomalyType == "MALFORMED_PAYLOAD")
        {
            payload["_malformed_data"] = "{ invalid json structure";
            payload["_error_marker"] = true;
        }
        
        return payload;
    }
    
    /// <summary>
    /// Analyzes messages for patterns and anomalies (self-contained, no external service).
    /// Groups messages by event type and detects anomalies based on application properties.
    /// Uses the same detection logic as the frontend for consistency.
    /// </summary>
    public Task<AiInsightsResponse?> AnalyzeMessagesAsync(List<object> messages, CancellationToken cancellationToken = default)
    {
        try
        {
            var startTime = DateTime.UtcNow;
            var clusters = new List<MessageCluster>();
            var outliers = new List<OutlierDetail>();
            
            // Simple clustering by event type from message properties
            var grouped = new Dictionary<string, List<object>>();
            var clusterSampleMessages = new Dictionary<string, object>();
            
            foreach (var msg in messages)
            {
                var json = JsonSerializer.Serialize(msg);
                var doc = JsonDocument.Parse(json);
                
                string eventType = "Unknown";
                string? messageId = null;
                
                // Extract message ID from multiple possible locations
                if (doc.RootElement.TryGetProperty("messageId", out var mid))
                    messageId = mid.GetString();
                else if (doc.RootElement.TryGetProperty("message_id", out var mid2))
                    messageId = mid2.GetString();
                
                // Check for anomaly indicators (same logic as frontend getAnomalyInfo)
                var anomalyInfo = ExtractAnomalyInfo(doc);
                
                if (doc.RootElement.TryGetProperty("applicationProperties", out var props))
                {
                    if (props.TryGetProperty("EventType", out var et))
                        eventType = et.GetString() ?? "Unknown";
                }
                
                // Also try event_type from body
                if (eventType == "Unknown" && doc.RootElement.TryGetProperty("event_type", out var etBody))
                    eventType = etBody.GetString() ?? "Unknown";
                
                if (!grouped.ContainsKey(eventType))
                {
                    grouped[eventType] = new List<object>();
                    clusterSampleMessages[eventType] = msg; // Store first message as sample
                }
                grouped[eventType].Add(msg);
                
                // Track anomalies as outliers - use same detection as frontend
                if (anomalyInfo.IsAnomaly && messageId != null)
                {
                    outliers.Add(new OutlierDetail
                    {
                        MessageId = messageId,
                        Reason = anomalyInfo.AnomalyType ?? "Unknown anomaly",
                        AnomalyScore = anomalyInfo.Severity == "critical" ? 1.0 : 
                                       anomalyInfo.Severity == "high" ? 0.9 : 
                                       anomalyInfo.Severity == "medium" ? 0.7 : 0.5,
                        Source = "ActiveQueue",
                        EventType = eventType,
                        Description = GetAnomalyDescription(anomalyInfo.AnomalyType),
                        SampleMessage = msg
                    });
                }
            }
            
            // Create clusters with sample messages
            int clusterId = 1;
            foreach (var group in grouped)
            {
                clusters.Add(new MessageCluster
                {
                    ClusterId = $"cluster-{clusterId++}",
                    ClusterName = group.Key,
                    MessageCount = group.Value.Count,
                    EventTypes = new List<string> { group.Key },
                    PatternDescription = $"{group.Value.Count} messages of type {group.Key}",
                    Confidence = 0.9,
                    SampleMessageIds = group.Value.Take(5).Select(m => 
                    {
                        var j = JsonSerializer.Serialize(m);
                        var d = JsonDocument.Parse(j);
                        if (d.RootElement.TryGetProperty("messageId", out var id))
                            return id.GetString() ?? "";
                        if (d.RootElement.TryGetProperty("message_id", out var id2))
                            return id2.GetString() ?? "";
                        return "";
                    }).Where(id => !string.IsNullOrEmpty(id)).ToList()
                });
            }
            
            var processingTime = (DateTime.UtcNow - startTime).TotalMilliseconds;
            
            var response = new AiInsightsResponse
            {
                TotalMessages = messages.Count,
                Clusters = clusters,
                Outliers = outliers,
                Summary = $"Analyzed {messages.Count} messages, found {clusters.Count} clusters and {outliers.Count} anomalies",
                ProcessingTimeMs = processingTime,
                AnalyzedAt = DateTime.UtcNow
            };
            
            return Task.FromResult<AiInsightsResponse?>(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to analyze messages");
            return Task.FromResult<AiInsightsResponse?>(null);
        }
    }
    
    /// <summary>
    /// Extract anomaly info from message - mirrors frontend getAnomalyInfo logic
    /// </summary>
    private (bool IsAnomaly, string? AnomalyType, string? Severity) ExtractAnomalyInfo(JsonDocument doc)
    {
        if (!doc.RootElement.TryGetProperty("applicationProperties", out var props))
            return (false, null, null);
        
        // Check for backend-generated anomalies: IsAnomaly === true && AnomalyType
        bool isAnomaly = false;
        string? anomalyType = null;
        string? severity = null;
        
        if (props.TryGetProperty("IsAnomaly", out var ia))
        {
            if (ia.ValueKind == JsonValueKind.True)
                isAnomaly = true;
            else if (ia.ValueKind == JsonValueKind.String && ia.GetString() == "true")
                isAnomaly = true;
        }
        
        if (props.TryGetProperty("AnomalyType", out var at))
            anomalyType = at.GetString();
        
        if (props.TryGetProperty("AnomalySeverity", out var sev))
            severity = sev.GetString();
        
        if (isAnomaly && anomalyType != null)
            return (true, anomalyType, severity);
        
        // Check for UI-generated anomalies: anomalyType (lowercase)
        if (props.TryGetProperty("anomalyType", out var uiAt))
        {
            var uiAnomalyType = uiAt.GetString();
            if (!string.IsNullOrEmpty(uiAnomalyType))
            {
                // Check for ForceDlq to determine severity
                bool forceDlq = false;
                if (props.TryGetProperty("ForceDlq", out var fd))
                {
                    if (fd.ValueKind == JsonValueKind.True)
                        forceDlq = true;
                    else if (fd.ValueKind == JsonValueKind.String && fd.GetString() == "true")
                        forceDlq = true;
                }
                return (true, uiAnomalyType, forceDlq ? "critical" : "medium");
            }
        }
        
        // Check for ForceDlq alone (dlq-candidate)
        if (props.TryGetProperty("ForceDlq", out var forceDlqProp))
        {
            bool isForceDlq = false;
            if (forceDlqProp.ValueKind == JsonValueKind.True)
                isForceDlq = true;
            else if (forceDlqProp.ValueKind == JsonValueKind.String && forceDlqProp.GetString() == "true")
                isForceDlq = true;
            
            if (isForceDlq)
                return (true, "dlq-candidate", "critical");
        }
        
        return (false, null, null);
    }
}
