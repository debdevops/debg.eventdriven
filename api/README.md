# Service Bus Inspector API (Scaffold)

Minimal ASP.NET 9 API scaffold with endpoints:

- POST /api/v1/services/register
- POST /api/v1/sessions/connect
- GET /api/v1/session/{id}/entities
- GET /api/v1/stream/{sessionId}/{entityName} (SSE stub)

## Local Run

```bash
cd api/ServiceBusInspectorApi
dotnet run
```

Environment:
- `SERVICEBUS_CONNECTION_STRING` for local dev (optional)

> Note: Replace `KeyVaultService` with Azure SDK for Key Vault in production.
