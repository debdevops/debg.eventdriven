namespace ServiceBusInspectorApi.Models;

/// <summary>
/// Request model for generating test messages with controlled anomalies.
/// Used by the AI Insights feature to create realistic test data.
/// </summary>
public record GenerateMessagesRequest
{
    /// <summary>
    /// Number of messages to generate (10-300).
    /// </summary>
    public int Count { get; init; }
    
    /// <summary>
    /// Target entity type: "Queue", "Topic", or "Both".
    /// </summary>
    public string TargetType { get; init; } = "Queue";
    
    /// <summary>
    /// Name of the target queue (required if TargetType is Queue or Both).
    /// </summary>
    public string? QueueName { get; init; }
    
    /// <summary>
    /// Name of the target topic (required if TargetType is Topic or Both).
    /// </summary>
    public string? TopicName { get; init; }

    /// <summary>
    /// Optional: when generating topic DLQ cases, dead-letter only into this subscription.
    /// If omitted, the API selects a deterministic subscription (alphabetically) to keep results verifiable.
    /// </summary>
    public string? SubscriptionName { get; init; }
    
    /// <summary>
    /// Whether to include messages designed to fail and land in DLQ.
    /// </summary>
    public bool IncludeDlqTestCases { get; init; }
}

/// <summary>
/// Response from message generation endpoint.
/// </summary>
public record GenerateMessagesResponse
{
    public int TotalGenerated { get; init; }
    public int AnomalousCount { get; init; }
    public int DlqCandidates { get; init; }
    public int DlqDeadLettered { get; init; }
    public int DlqDeadLetteredQueue { get; init; }
    public int DlqDeadLetteredSubscriptions { get; init; }
    public string? DlqTopicName { get; init; }
    public string? DlqSubscriptionName { get; init; }
    public List<string> Errors { get; init; } = new();
    public bool Success { get; init; }
}

/// <summary>
/// Request to analyze messages using AI Insights service.
/// </summary>
public record AnalyzeMessagesRequest
{
    /// <summary>
    /// Queue name to analyze (required).
    /// </summary>
    public string QueueName { get; init; } = string.Empty;
    
    /// <summary>
    /// Whether to also analyze DLQ messages.
    /// </summary>
    public bool IncludeDlq { get; init; } = true;
    
    /// <summary>
    /// Maximum number of messages to sample for analysis (default 200).
    /// </summary>
    public int MaxSampleSize { get; init; } = 200;
}

/// <summary>
/// AI Insights analysis response (mirrors FastAPI service response).
/// </summary>
public record AiInsightsResponse
{
    public int TotalMessages { get; init; }
    public List<MessageCluster> Clusters { get; init; } = new();
    public List<OutlierDetail> Outliers { get; init; } = new();
    public string Summary { get; init; } = string.Empty;
    public double ProcessingTimeMs { get; init; }
    
    /// <summary>
    /// Cache timestamp for UI refresh logic.
    /// </summary>
    public DateTime AnalyzedAt { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Represents a cluster of similar messages detected by AI.
/// </summary>
public record MessageCluster
{
    public string ClusterId { get; init; } = string.Empty;
    public string ClusterName { get; init; } = string.Empty;
    public int MessageCount { get; init; }
    public List<string> EventTypes { get; init; } = new();
    public string PatternDescription { get; init; } = string.Empty;
    public Dictionary<string, object> CommonFields { get; init; } = new();
    public List<List<string>>? CorrelationGroups { get; init; }
    public List<string> SampleMessageIds { get; init; } = new();
    public double Confidence { get; init; }
}

/// <summary>
/// Represents an outlier/anomalous message detected by AI.
/// </summary>
public record OutlierDetail
{
    public string MessageId { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
    public double AnomalyScore { get; init; }
    
    /// <summary>
    /// "ActiveQueue" or "DeadLetterQueue".
    /// </summary>
    public string Source { get; init; } = "ActiveQueue";
    
    /// <summary>
    /// Event type of the anomalous message.
    /// </summary>
    public string EventType { get; init; } = string.Empty;
    
    /// <summary>
    /// Human-readable description of the anomaly.
    /// </summary>
    public string Description { get; init; } = string.Empty;
    
    /// <summary>
    /// Sample of the message content for display.
    /// </summary>
    public object? SampleMessage { get; init; }
}

/// <summary>
/// Combined analysis response for both active and DLQ messages.
/// </summary>
public record CombinedAiInsightsResponse
{
    public AiInsightsAnalysis? ActiveQueueAnalysis { get; init; }
    public AiInsightsAnalysis? DlqAnalysis { get; init; }
    public string Summary { get; init; } = string.Empty;
    public DateTime AnalyzedAt { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Analysis for a single source (active queue or DLQ).
/// </summary>
public record AiInsightsAnalysis
{
    public string Source { get; init; } = string.Empty;
    public int TotalMessages { get; init; }
    public List<MessageCluster> Clusters { get; init; } = new();
    public List<OutlierDetail> Outliers { get; init; } = new();
    public double ProcessingTimeMs { get; init; }
}
