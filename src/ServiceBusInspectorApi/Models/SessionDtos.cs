namespace ServiceBusInspectorApi.Models;

public class SessionConnectRequest
{
    public string? SecretName { get; set; }
    public string? Raw { get; set; }
}

public class SessionConnectResponse
{
    public string SessionId { get; set; } = string.Empty;
}

public class EntityListResponse
{
    public IEnumerable<object> Queues { get; set; } = Array.Empty<object>();
    public IEnumerable<object> Topics { get; set; } = Array.Empty<object>();
}