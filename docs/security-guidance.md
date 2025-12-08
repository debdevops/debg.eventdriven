# Security Guidance for Azure Service Bus Inspector

## Overview

This document provides security best practices and hardening recommendations for deploying the Service Bus Inspector in production environments. The architecture follows a **zero-trust model** where connection strings never leave the backend and all operations are audited.

---

## 1. Azure Role-Based Access Control (RBAC)

### Key Vault Access

**For Local Development (Developer Accounts):**
```bash
# Grant your user account access to Key Vault secrets
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <your-user-principal-id> \
  --scope /subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<kv-name>
```

**For Production (Managed Identity):**
```bash
# Grant the App Service Managed Identity access to Key Vault
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <app-service-managed-identity-principal-id> \
  --scope /subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<kv-name>
```

**Recommended Roles:**
- **Key Vault Secrets User**: Read-only access to secrets (preferred for least privilege)
- **DO NOT USE**: Key Vault Secrets Officer, Key Vault Administrator (too broad)

### Service Bus Access

The application uses connection strings retrieved from Key Vault, which contain embedded SAS tokens. For enhanced security:

**Option 1: Use Managed Identity for Service Bus (Recommended)**
Modify the backend to use `DefaultAzureCredential` directly for Service Bus instead of connection strings:

```csharp
var client = new ServiceBusClient(
    fullyQualifiedNamespace: "sb-namespace.servicebus.windows.net",
    credential: new DefaultAzureCredential()
);
```

**Required RBAC Roles:**
- **Azure Service Bus Data Receiver**: Read messages
- **Azure Service Bus Data Sender**: Send messages (if replay feature added)

```bash
az role assignment create \
  --role "Azure Service Bus Data Receiver" \
  --assignee <managed-identity-principal-id> \
  --scope /subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.ServiceBus/namespaces/<sb-namespace>
```

---

## 2. Azure Key Vault Configuration

### Enable Azure RBAC for Key Vault

```bash
# Switch from access policies to RBAC (more granular)
az keyvault update \
  --name <kv-name> \
  --resource-group <rg> \
  --enable-rbac-authorization true
```

### Enable Key Vault Firewall and Private Link

**Restrict network access:**
```bash
# Allow only specific VNet/subnet
az keyvault network-rule add \
  --name <kv-name> \
  --resource-group <rg> \
  --vnet-name <vnet-name> \
  --subnet <subnet-name>

# Deny public access by default
az keyvault update \
  --name <kv-name> \
  --resource-group <rg> \
  --default-action Deny
```

**Enable Private Link:**
```bash
# Create private endpoint
az network private-endpoint create \
  --name pe-keyvault \
  --resource-group <rg> \
  --vnet-name <vnet-name> \
  --subnet <subnet-name> \
  --private-connection-resource-id <kv-resource-id> \
  --group-id vault \
  --connection-name keyvault-connection
```

### Enable Audit Logging

```bash
# Send Key Vault logs to Log Analytics
az monitor diagnostic-settings create \
  --name keyvault-diagnostics \
  --resource <kv-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"category":"AuditEvent","enabled":true}]'
```

**Key metrics to monitor:**
- Secret access frequency (detect unusual spikes)
- Failed authentication attempts
- Secrets nearing expiration

---

## 3. Service Bus Security

### Use Premium Tier for Production

**Benefits:**
- VNet integration (private connectivity)
- Encryption at rest with customer-managed keys
- Better isolation

### Enable Service Bus Private Link

```bash
# Create private endpoint for Service Bus
az network private-endpoint create \
  --name pe-servicebus \
  --resource-group <rg> \
  --vnet-name <vnet-name> \
  --subnet <subnet-name> \
  --private-connection-resource-id <sb-resource-id> \
  --group-id namespace \
  --connection-name servicebus-connection
```

### Rotate SAS Keys Regularly

If using connection strings (not Managed Identity):
```bash
# Rotate primary key
az servicebus namespace authorization-rule keys renew \
  --resource-group <rg> \
  --namespace-name <sb-namespace> \
  --name RootManageSharedAccessKey \
  --key PrimaryKey

# Update Key Vault secret with new connection string
az keyvault secret set \
  --vault-name <kv-name> \
  --name ServiceBusConnectionString \
  --value "<new-connection-string>"
```

**Rotation schedule:** Every 90 days or on security incident.

---

## 4. Application Security

### Environment Variables

**Never commit secrets to code or config files.**

Use Azure App Service Configuration:
```bash
az webapp config appsettings set \
  --name <app-name> \
  --resource-group <rg> \
  --settings \
    KeyVaultName="<kv-name>" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="<app-insights-conn-string>" \
    SessionTimeoutMinutes="10"
```

### CORS Configuration

**Production CORS:**
```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "https://your-frontend.azurewebsites.net",
                "https://your-custom-domain.com"
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
```

**DO NOT** use `AllowAnyOrigin()` in production.

### Session Management

**In-Memory (Development Only):**
Current implementation uses `ConcurrentDictionary<string, SessionInfo>`.

**Redis (Production):**
Replace with Azure Cache for Redis:

```csharp
services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = Configuration.GetConnectionString("Redis");
    options.InstanceName = "ServiceBusInspector:";
});
```

**Benefits:**
- Distributed session storage (works with multiple API instances)
- Automatic TTL expiration
- Better scalability

### Audit Store Security

**File-Based (POC):**
Current implementation writes to `data/audit.log`.

**Security concerns:**
- File permissions: Ensure only app user can read/write
- Disk space: No automatic cleanup
- Query performance: Poor for large logs

**Cosmos DB (Production):**

```csharp
// Replace file I/O with Cosmos DB
private readonly Container _container;

public async Task LogAsync(AuditEntry entry)
{
    await _container.CreateItemAsync(entry, new PartitionKey(entry.SessionId));
}
```

**Cosmos DB Security:**
- Use Managed Identity for access (no connection strings)
- Enable RBAC: "Cosmos DB Built-in Data Contributor"
- Enable Cosmos DB audit logging
- Set TTL (Time-to-Live) for automatic data expiration

```bash
az cosmosdb sql container create \
  --account-name <cosmos-account> \
  --database-name AuditDB \
  --name AuditEntries \
  --partition-key-path "/sessionId" \
  --default-ttl 7776000  # 90 days
```

---

## 5. Network Security

### App Service Configuration

**Enable HTTPS only:**
```bash
az webapp update \
  --name <app-name> \
  --resource-group <rg> \
  --https-only true
```

**Minimum TLS version:**
```bash
az webapp config set \
  --name <app-name> \
  --resource-group <rg> \
  --min-tls-version 1.2
```

**Enable VNet integration:**
```bash
az webapp vnet-integration add \
  --name <app-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --subnet <subnet-name>
```

### Firewall Rules

**App Service Access Restriction:**
```bash
# Allow only from specific IP ranges (e.g., corporate VPN)
az webapp config access-restriction add \
  --name <app-name> \
  --resource-group <rg> \
  --rule-name AllowCorporateVPN \
  --action Allow \
  --ip-address <ip-range> \
  --priority 100
```

---

## 6. Secrets Management Best Practices

### Do's ✅
- ✅ Store all secrets in Azure Key Vault
- ✅ Use Managed Identity for authentication
- ✅ Enable Key Vault audit logging
- ✅ Rotate secrets regularly (90-day schedule)
- ✅ Use separate Key Vaults per environment (dev, staging, prod)
- ✅ Tag secrets with expiration dates and owners
- ✅ Use RBAC instead of access policies

### Don'ts ❌
- ❌ Never log connection strings or lock tokens
- ❌ Never commit secrets to Git (even in .env files)
- ❌ Never pass secrets via URL query parameters
- ❌ Never share connection strings via email, Slack, or wiki
- ❌ Never use `*` wildcards in RBAC assignments
- ❌ Never disable HTTPS or TLS 1.2

---

## 7. Audit and Compliance

### What to Audit

**Current implementation audits:**
- Who (SessionId as proxy for user; add user identity if using AAD)
- What (Operation: Peek, Receive, Complete)
- When (Timestamp)
- Where (EntityName: queue/topic)
- Which (MessageId, SequenceNumber)

**Recommended enhancements:**
- Add user identity (via Azure AD/MSAL integration)
- Add source IP address
- Add correlation ID for distributed tracing
- Add operation status (success/failure)

### Retention Policy

**File-based (POC):**
No automatic cleanup—implement log rotation:
```bash
# Rotate logs daily (example cron job)
0 0 * * * mv /app/data/audit.log /app/data/audit.$(date +\%Y\%m\%d).log && gzip /app/data/audit.$(date +\%Y\%m\%d).log
```

**Cosmos DB (Production):**
- Use TTL to auto-delete old entries (recommended: 90 days)
- Export to cold storage (Azure Blob) for long-term retention
- Query performance: partition by `sessionId` or date

### Compliance Standards

**GDPR:**
- Ensure audit logs don't contain PII in message bodies
- Provide data export capability (download audit log)
- Implement right-to-erasure (delete user sessions)

**HIPAA/SOC 2:**
- Enable encryption at rest (Cosmos DB, Key Vault, Service Bus)
- Encrypt audit logs in transit (HTTPS)
- Implement role-based access (RBAC)
- Maintain audit trail for 7 years (adjust TTL accordingly)

---

## 8. Monitoring and Alerting

### Application Insights Queries

**Failed Key Vault access:**
```kusto
traces
| where message contains "Failed to retrieve secret"
| summarize count() by bin(timestamp, 5m)
| where count_ > 5
```

**Session expiry rate:**
```kusto
traces
| where message contains "Session expired"
| summarize count() by bin(timestamp, 1h)
```

**Unusual message receive volume:**
```kusto
customEvents
| where name == "MessageReceived"
| summarize count() by bin(timestamp, 5m)
| where count_ > 100  // Threshold
```

### Recommended Alerts

**Key Vault:**
- Alert on 5+ failed secret access attempts in 5 minutes
- Alert on secrets nearing expiration (30 days)

**Service Bus:**
- Alert on dead-letter queue depth > 100
- Alert on message age > 1 hour (indicates backlog)

**Application:**
- Alert on API error rate > 5%
- Alert on session creation rate spike (potential abuse)

---

## 9. Incident Response Plan

### Security Incident Procedures

**Step 1: Identify**
- Monitor Application Insights for anomalies
- Check Key Vault audit logs for unauthorized access
- Review audit log for unusual message receive patterns

**Step 2: Contain**
- Revoke compromised Managed Identity (if applicable)
- Rotate SAS keys immediately
- Disable affected sessions (clear in-memory/Redis store)

**Step 3: Investigate**
- Query audit logs by correlation ID
- Review Application Insights distributed traces
- Check network flow logs for unauthorized access

**Step 4: Remediate**
- Patch vulnerabilities
- Update RBAC assignments
- Re-deploy application with security fixes

**Step 5: Recover**
- Restore from known-good state
- Verify Key Vault and Service Bus configurations
- Run security scan

**Step 6: Post-Incident**
- Document findings in incident report
- Update runbooks and alerts
- Conduct team retrospective

---

## 10. Checklist: Production Readiness

### Pre-Deployment
- [ ] Managed Identity enabled on App Service
- [ ] Key Vault RBAC configured (Secrets User role)
- [ ] Service Bus RBAC configured (Data Receiver role)
- [ ] CORS restricted to specific origins
- [ ] HTTPS enforced, TLS 1.2 minimum
- [ ] Secrets stored in Key Vault (not config files)
- [ ] Application Insights connection string configured
- [ ] Environment variables set (KeyVaultName, etc.)

### Post-Deployment
- [ ] Private endpoints enabled (Key Vault, Service Bus)
- [ ] Network security rules configured (VNet integration)
- [ ] Audit logging enabled (Key Vault, Service Bus, App Service)
- [ ] Application Insights alerts configured
- [ ] Cosmos DB or Redis configured for session/audit storage
- [ ] Secret rotation schedule documented (90 days)
- [ ] Incident response plan reviewed with team

### Operational
- [ ] Monitor Application Insights daily for errors
- [ ] Review audit logs weekly for anomalies
- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly (check for CVEs)
- [ ] Conduct security review annually

---

## 11. References

- [Azure Key Vault Security Baseline](https://docs.microsoft.com/azure/key-vault/general/security-baseline)
- [Azure Service Bus Security Controls](https://docs.microsoft.com/azure/service-bus-messaging/service-bus-security-controls)
- [Azure Managed Identity Best Practices](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/managed-identity-best-practice-recommendations)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Author**: Debasis Ghosh  
**Created**: November 2025  
**Version**: 1.0  
**Review Cycle**: Quarterly
