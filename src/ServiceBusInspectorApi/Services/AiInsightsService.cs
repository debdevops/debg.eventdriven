using System.Text;
using System.Text.Json;
using Azure.Messaging.ServiceBus;
using ServiceBusInspectorApi.Models;

namespace ServiceBusInspectorApi.Services;

/// <summary>
/// Service for generating realistic test messages with controlled anomalies
/// and integrating with the AI Insights FastAPI service.
/// </summary>
public class AiInsightsService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiInsightsService> _logger;
    private static readonly string[] EventTypes = 
    {
        "PaymentProcessed", "OrderCreated", "InventoryUpdated",
        "PaymentFailed", "OrderCancelled", "ShipmentDispatched"
    };
    
    private static readonly Random Random = new();
    
    public AiInsightsService(IHttpClientFactory httpClientFactory, ILogger<AiInsightsService> logger)
    {
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.BaseAddress = new Uri("http://localhost:8000"); // AI Insights FastAPI service
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _logger = logger;
    }
    
    /// <summary>
    /// Generates realistic test messages with controlled anomalies.
    /// Returns message payloads ready to be sent to Service Bus.
    /// </summary>
    public List<ServiceBusMessage> GenerateTestMessages(int count, bool includeDlqCandidates, out int anomalousCount, out int dlqCount)
    {
        var messages = new List<ServiceBusMessage>();
        anomalousCount = 0;
        dlqCount = 0;
        
        // Calculate anomaly percentage (5-10%)
        var anomalyPercentage = Random.Next(5, 11);
        var anomalyTargetCount = (int)Math.Ceiling(count * anomalyPercentage / 100.0);
        
        // Calculate DLQ candidates if requested (3-5%)
        var dlqTargetCount = includeDlqCandidates ? (int)Math.Ceiling(count * Random.Next(3, 6) / 100.0) : 0;
        
        for (int i = 0; i < count; i++)
        {
            var messageId = $"msg-{Guid.NewGuid():N}";
            var correlationId = $"corr-{Random.Next(1, count / 2)}"; // Reuse some correlation IDs
            var eventType = EventTypes[Random.Next(EventTypes.Length)];
            var timestamp = DateTime.UtcNow.AddSeconds(-Random.Next(0, 3600)); // Last hour
            
            // Decide if this message should be anomalous
            bool isAnomaly = anomalousCount < anomalyTargetCount && Random.Next(100) < 15;
            bool isDlqCandidate = dlqCount < dlqTargetCount && Random.Next(100) < 10;
            
            var payload = GeneratePayload(eventType, isAnomaly, isDlqCandidate);
            
            var message = new ServiceBusMessage(JsonSerializer.Serialize(new
            {
                message_id = messageId,
                event_type = eventType,
                correlation_id = isAnomaly && Random.Next(100) < 30 ? null : correlationId, // Sometimes missing
                timestamp = timestamp.ToString("O"),
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
            
            // Add application properties
            message.ApplicationProperties["EventType"] = eventType;
            message.ApplicationProperties["Generated"] = true;
            
            if (isDlqCandidate)
            {
                // Make this message likely to fail processing (for DLQ testing)
                message.ApplicationProperties["ForceDlq"] = true;
                dlqCount++;
            }
            
            if (isAnomaly)
            {
                anomalousCount++;
            }
            
            messages.Add(message);
        }
        
        return messages;
    }
    
    /// <summary>
    /// Generates payload for a specific event type with optional anomalies.
    /// </summary>
    private Dictionary<string, object> GeneratePayload(string eventType, bool isAnomaly, bool isDlqCandidate)
    {
        var payload = new Dictionary<string, object>();
        
        switch (eventType)
        {
            case "PaymentProcessed":
                payload["transaction_id"] = $"txn-{Random.Next(1000, 9999)}";
                payload["amount"] = isAnomaly && Random.Next(100) < 50 
                    ? Random.Next(10000, 50000) // Abnormally high
                    : Math.Round(Random.NextDouble() * 500 + 10, 2);
                payload["currency"] = isAnomaly && Random.Next(100) < 30 ? "INVALID" : "USD";
                payload["status"] = isDlqCandidate ? "unknown" : "completed";
                payload["payment_method"] = Random.Next(3) switch
                {
                    0 => "credit_card",
                    1 => "paypal",
                    _ => "debit_card"
                };
                
                // Anomaly: missing required field
                if (!isAnomaly || Random.Next(100) > 40)
                {
                    payload["merchant_id"] = $"merch-{Random.Next(100, 999)}";
                }
                
                if (isAnomaly && Random.Next(100) < 20)
                {
                    payload["duplicate_flag"] = true;
                }
                break;
            
            case "OrderCreated":
                payload["order_id"] = isDlqCandidate ? null! : $"ord-{Random.Next(2000, 9999)}";
                payload["customer_id"] = $"cust-{Random.Next(5000, 9999)}";
                payload["total_amount"] = Math.Round(Random.NextDouble() * 1000 + 20, 2);
                payload["currency"] = "USD";
                payload["items_count"] = Random.Next(1, 10);
                
                if (!isAnomaly || Random.Next(100) > 50)
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
                payload["quantity_change"] = isAnomaly && Random.Next(100) < 30 
                    ? "invalid_number" 
                    : Random.Next(-50, 100);
                payload["new_quantity"] = Random.Next(0, 500);
                payload["reason"] = Random.Next(2) == 0 ? "order_fulfillment" : "restock";
                break;
            
            case "PaymentFailed":
                payload["transaction_id"] = $"txn-{Random.Next(9000, 9999)}";
                payload["amount"] = Math.Round(Random.NextDouble() * 300 + 10, 2);
                payload["currency"] = "USD";
                payload["status"] = "failed";
                payload["error_code"] = Random.Next(3) switch
                {
                    0 => "INSUFFICIENT_FUNDS",
                    1 => "CARD_EXPIRED",
                    _ => "FRAUD_SUSPECTED"
                };
                payload["payment_method"] = Random.Next(2) == 0 ? "credit_card" : "paypal";
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
        
        return payload;
    }
    
    /// <summary>
    /// Calls the AI Insights FastAPI service to analyze messages.
    /// </summary>
    public async Task<AiInsightsResponse?> AnalyzeMessagesAsync(List<object> messages, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new { messages };
            var json = JsonSerializer.Serialize(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            var response = await _httpClient.PostAsync("/api/analyze", content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("AI Insights service returned {StatusCode}: {Error}", response.StatusCode, error);
                return null;
            }
            
            var resultJson = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<AiInsightsResponse>(resultJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call AI Insights service");
            return null;
        }
    }
}
