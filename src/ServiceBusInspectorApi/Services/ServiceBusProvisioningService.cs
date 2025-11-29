using Azure.Messaging.ServiceBus.Administration;

namespace ServiceBusInspectorApi.Services;

/// <summary>
/// Service for interacting with Azure Service Bus management operations.
/// Uses ServiceBusAdministrationClient to list queues and topics.
/// </summary>
public class ServiceBusProvisioningService
{
    private readonly ILogger<ServiceBusProvisioningService> _logger;

    public ServiceBusProvisioningService(ILogger<ServiceBusProvisioningService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Lists all queues and topics in the Service Bus namespace.
    /// </summary>
    public async Task<EntityListResponse> ListEntitiesAsync(string connectionString)
    {
        try
        {
            // SECURITY: Connection string is never logged
            var adminClient = new ServiceBusAdministrationClient(connectionString);

            var queues = new List<EntityInfo>();
            var topics = new List<EntityInfo>();

            // List queues
            await foreach (var queueProperties in adminClient.GetQueuesAsync())
            {
                // Get runtime properties for accurate message counts
                var runtimeProps = await adminClient.GetQueueRuntimePropertiesAsync(queueProperties.Name);
                
                queues.Add(new EntityInfo
                {
                    Name = queueProperties.Name,
                    MessageCount = runtimeProps.Value.ActiveMessageCount,
                    DeadLetterMessageCount = runtimeProps.Value.DeadLetterMessageCount,
                    MaxDeliveryCount = queueProperties.MaxDeliveryCount,
                    LockDuration = queueProperties.LockDuration,
                    Type = "Queue"
                });
            }

            // List topics
            await foreach (var topicProperties in adminClient.GetTopicsAsync())
            {
                // Aggregate message counts from all subscriptions
                long totalActiveMessages = 0;
                long totalDeadLetterMessages = 0;
                
                await foreach (var subProperties in adminClient.GetSubscriptionsAsync(topicProperties.Name))
                {
                    var runtimeProps = await adminClient.GetSubscriptionRuntimePropertiesAsync(topicProperties.Name, subProperties.SubscriptionName);
                    totalActiveMessages += runtimeProps.Value.ActiveMessageCount;
                    totalDeadLetterMessages += runtimeProps.Value.DeadLetterMessageCount;
                }
                
                topics.Add(new EntityInfo
                {
                    Name = topicProperties.Name,
                    MessageCount = (int)totalActiveMessages,
                    DeadLetterMessageCount = (int)totalDeadLetterMessages,
                    Type = "Topic"
                });
            }

            _logger.LogInformation("Listed {QueueCount} queues and {TopicCount} topics",
                queues.Count, topics.Count);

            return new EntityListResponse
            {
                Queues = queues,
                Topics = topics
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list Service Bus entities");
            throw;
        }
    }

    /// <summary>
    /// Lists all subscriptions for a given topic.
    /// </summary>
    public async Task<List<SubscriptionInfo>> ListSubscriptionsAsync(string connectionString, string topicName)
    {
        try
        {
            var adminClient = new ServiceBusAdministrationClient(connectionString);
            var subscriptions = new List<SubscriptionInfo>();

            await foreach (var subProperties in adminClient.GetSubscriptionsAsync(topicName))
            {
                // Get runtime properties for accurate message counts
                var runtimeProps = await adminClient.GetSubscriptionRuntimePropertiesAsync(topicName, subProperties.SubscriptionName);

                subscriptions.Add(new SubscriptionInfo
                {
                    Name = subProperties.SubscriptionName,
                    TopicName = topicName,
                    MessageCount = runtimeProps.Value.ActiveMessageCount,
                    DeadLetterMessageCount = runtimeProps.Value.DeadLetterMessageCount,
                    MaxDeliveryCount = subProperties.MaxDeliveryCount,
                    LockDuration = subProperties.LockDuration,
                    Status = subProperties.Status.ToString()
                });
            }

            _logger.LogInformation("Listed {SubCount} subscriptions for topic {TopicName}",
                subscriptions.Count, topicName);

            return subscriptions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list subscriptions for topic {TopicName}", topicName);
            throw;
        }
    }

    /// <summary>
    /// Creates a temporary subscription for debugging purposes.
    /// </summary>
    public async Task<SubscriptionInfo> CreateTempSubscriptionAsync(string connectionString, string topicName)
    {
        try
        {
            var adminClient = new ServiceBusAdministrationClient(connectionString);
            var subscriptionName = $"temp-sub-{Guid.NewGuid().ToString("N")[..8]}";

            var options = new CreateSubscriptionOptions(topicName, subscriptionName)
            {
                AutoDeleteOnIdle = TimeSpan.FromMinutes(15), // Auto-delete after 15 minutes
                MaxDeliveryCount = 10,
                LockDuration = TimeSpan.FromMinutes(5)
            };

            var subscription = await adminClient.CreateSubscriptionAsync(options);

            _logger.LogInformation("Created temporary subscription {SubName} for topic {TopicName}",
                subscriptionName, topicName);

            return new SubscriptionInfo
            {
                Name = subscriptionName,
                TopicName = topicName,
                MessageCount = 0,
                DeadLetterMessageCount = 0,
                MaxDeliveryCount = options.MaxDeliveryCount,
                LockDuration = options.LockDuration,
                Status = "Active"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create temporary subscription for topic {TopicName}", topicName);
            throw;
        }
    }

    /// <summary>
    /// Deletes a subscription from a topic.
    /// </summary>
    public async Task DeleteSubscriptionAsync(string connectionString, string topicName, string subscriptionName)
    {
        try
        {
            var adminClient = new ServiceBusAdministrationClient(connectionString);
            await adminClient.DeleteSubscriptionAsync(topicName, subscriptionName);

            _logger.LogInformation("Deleted subscription {SubName} from topic {TopicName}",
                subscriptionName, topicName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete subscription {SubName} from topic {TopicName}",
                subscriptionName, topicName);
            throw;
        }
    }

    // PRODUCTION HARDENING:
    // 1. Implement caching for entity lists (refresh every 1-5 minutes)
    // 2. Add support for dead-letter queue inspection
    // 3. Implement pagination for large numbers of entities
    // 4. Add filtering and sorting options
}

public record EntityListResponse
{
    public List<EntityInfo> Queues { get; init; } = new();
    public List<EntityInfo> Topics { get; init; } = new();
}

public record EntityInfo
{
    public string Name { get; init; } = string.Empty;
    public long MessageCount { get; init; }
    public long DeadLetterMessageCount { get; init; }
    public int? MaxDeliveryCount { get; init; }
    public TimeSpan? LockDuration { get; init; }
    public string Type { get; init; } = string.Empty;
}

public record SubscriptionInfo
{
    public string Name { get; init; } = string.Empty;
    public string TopicName { get; init; } = string.Empty;
    public long MessageCount { get; init; }
    public long DeadLetterMessageCount { get; init; }
    public int? MaxDeliveryCount { get; init; }
    public TimeSpan? LockDuration { get; init; }
    public string Status { get; init; } = string.Empty;
}
