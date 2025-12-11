using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<KeyVaultService>();
builder.Services.AddSingleton<ServiceBusProxy>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapPost("/api/v1/services/register", (HttpContext ctx) => Results.Ok(new { ok = true }));

app.MapPost("/api/v1/sessions/connect", async (KeyVaultService kv, ServiceBusProxy sb, HttpContext ctx) =>
{
    // Stub: read JSON body { secretName?: string, raw?: string }
    var req = await System.Text.Json.JsonSerializer.DeserializeAsync<Credentials>(ctx.Request.Body, new System.Text.Json.JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    });

    var connStr = req?.Raw ?? (req?.SecretName is not null ? kv.GetSecret(req.SecretName) : null);
    // Stub: create session id
    var sessionId = Guid.NewGuid().ToString("N");
    return Results.Ok(new { sessionId });
});

app.MapGet("/api/v1/session/{id}/entities", (string id) =>
{
    // Stub: return synthetic entities
    var entities = new
    {
        queues = new[] { new { name = "test-queue" } },
        topics = new[] { new { name = "test-topic", subscriptions = new[] { "sub-a" } } }
    };
    return Results.Ok(entities);
});

app.MapGet("/api/v1/stream/{sessionId}/{entityName}", async (string sessionId, string entityName, HttpContext ctx) =>
{
    ctx.Response.Headers.Add("Content-Type", "text/event-stream");
    for (var i = 0; i < 5; i++)
    {
        await ctx.Response.WriteAsync($"data: {{\\"sequence\\":{i}, \\"entity\\":\\"{entityName}\\"}}\n\n");
        await ctx.Response.Body.FlushAsync();
        await Task.Delay(1000);
    }
});

app.Run();

public record Credentials(string? SecretName, string? Raw);

public class KeyVaultService
{
    private readonly IConfiguration _cfg;
    public KeyVaultService(IConfiguration cfg) => _cfg = cfg;

    public string? GetSecret(string secretName)
    {
        // TODO: Replace with Azure SDK (DefaultAzureCredential + SecretClient)
        // For local dev, read from environment: SERVICEBUS_CONNECTION_STRING
        return Environment.GetEnvironmentVariable("SERVICEBUS_CONNECTION_STRING");
    }
}

public class ServiceBusProxy
{
    // TODO: Replace with Azure.Messaging.ServiceBus usage
    public IEnumerable<string> PeekMessages(string entityName)
    {
        return new[] { "sample-1", "sample-2" };
    }
}
