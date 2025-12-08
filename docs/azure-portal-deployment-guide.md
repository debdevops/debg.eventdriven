# Azure Portal Deployment Guide
## Dynamic Azure Service Bus Inspector - Complete Setup

**Target Environment**: Single Resource Group (MVP)  
**Deployment Method**: Azure Portal UI Only  
**Estimated Time**: 45-60 minutes

---

## 📋 Resource Naming Convention

| Resource Type | Name Pattern | Example |
|--------------|--------------|---------|
| Resource Group | `rg-{project}-{env}` | `rg-servicebus-inspector-dev` |
| Service Bus | `sb-{project}-{unique}` | `sb-inspector-2025` |
| Key Vault | `kv-{project}-{unique}` | `kv-inspector-2025` |
| App Service Plan | `asp-{project}-{env}` | `asp-inspector-dev` |
| App Service | `app-{project}-{env}` | `app-inspector-dev` |
| Application Insights | `appi-{project}-{env}` | `appi-inspector-dev` |
| Static Web App | `stapp-{project}` | `stapp-inspector` |

**Recommended Region**: `East US` or `Central India` (for latency and cost)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Static Web App                      │
│                  (React + TypeScript Frontend)               │
│                    https://app-inspector.web.app             │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS/REST + SSE
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Azure App Service (Linux, .NET 9)              │
│                   ASP.NET Core Backend API                   │
│            • System-Assigned Managed Identity               │
│            • CORS: Static Web App origin                    │
└────┬─────────────────┬──────────────────┬───────────────────┘
     │                 │                  │
     │ Managed         │ Connection       │ OpenTelemetry
     │ Identity        │ String           │ Traces
     ▼                 ▼                  ▼
┌──────────────┐  ┌─────────────┐  ┌───────────────────┐
│ Key Vault    │  │ Service Bus │  │ App Insights      │
│ • RBAC Mode  │  │ • Standard  │  │ • 90-day logs     │
│ • Secret:    │  │ • test-queue│  │ • Distributed     │
│   ServiceBus │  │             │  │   tracing         │
│   ConnString │  │             │  │                   │
└──────────────┘  └─────────────┘  └───────────────────┘
```

## 🔄 Runtime Data Flow

```
1. User → Frontend: Enter "ServiceBusConnectionString"
   ↓
2. Frontend → Backend: POST /api/namespace/connect
   Body: { "secretName": "ServiceBusConnectionString" }
   ↓
3. Backend → Key Vault: Retrieve secret (via Managed Identity)
   ↓
4. Backend: Create ephemeral SessionId (10-min TTL)
   ↓
5. Backend → Frontend: { "sessionId": "abc123..." }
   ↓
6. Frontend → Backend: GET /api/namespace/{sessionId}/entities
   ↓
7. Backend → Service Bus: List queues/topics
   ↓
8. Backend → Frontend: [{ "name": "test-queue", ... }]
   ↓
9. User selects queue → Peek/Receive mode
   ↓
10. Frontend: EventSource("/api/stream/{sessionId}/test-queue?mode=peek")
    ↓
11. Backend → Service Bus: PeekMessagesAsync() every 2s
    ↓
12. Backend → Frontend: SSE events with message data
```

---

## 🚀 Step-by-Step Deployment

### 1️⃣ Create Resource Group

1. Navigate to **Azure Portal** → Search **"Resource groups"** → Click **+ Create**
2. **Subscription**: Select your subscription
3. **Resource group**: `rg-servicebus-inspector-dev`
4. **Region**: `East US`
5. Click **Review + create** → **Create**

**✅ Validation**: Resource group appears in the list

---

### 2️⃣ Create Service Bus Namespace

1. Search **"Service Bus"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Namespace name**: `sb-inspector-2025` (must be globally unique)
   - **Location**: `East US`
   - **Pricing tier**: **Standard** (required for topics/subscriptions)
3. Click **Review + create** → **Create** (deployment takes 2-3 minutes)

#### Create a Test Queue

4. Navigate to the created Service Bus namespace
5. Left menu → **Queues** → Click **+ Queue**
6. **Name**: `test-queue`
7. **Max queue size**: 1 GB
8. **Message time to live**: 14 days (default)
9. **Lock duration**: 30 seconds
10. **Enable dead lettering on message expiration**: ✅ (checked)
11. Click **Create**

#### Get Connection String

12. Left menu → **Shared access policies** → Click **RootManageSharedAccessKey**
13. Copy **Primary Connection String** (save for step 3)
14. Example format: `Endpoint=sb://sb-inspector-2025.servicebus.windows.net/;SharedAccessKeyName=...`

**✅ Validation**: 
- Click **Service Bus Explorer** (left menu) → Select `test-queue`
- Click **Send message** → Enter test data → Send
- Verify message appears in **Active messages**

---

### 3️⃣ Create Key Vault

1. Search **"Key vaults"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Key vault name**: `kv-inspector-2025` (must be globally unique)
   - **Region**: `East US`
   - **Pricing tier**: **Standard**
3. **Access configuration** tab:
   - **Permission model**: Select **Azure role-based access control (RBAC)**
   - ⚠️ **Important**: Do NOT use "Vault access policy" (legacy)
4. **Networking** tab:
   - **Connectivity method**: **Public endpoint (all networks)**
5. Click **Review + create** → **Create**

#### Grant Yourself Access (for secret creation)

6. Navigate to the created Key Vault
7. Left menu → **Access control (IAM)** → Click **+ Add** → **Add role assignment**
8. **Role** tab: Search **"Key Vault Secrets Officer"** → Select → **Next**
9. **Members** tab: Click **+ Select members** → Search your email → Select → **Next**
10. Click **Review + assign**
11. Wait 2-3 minutes for propagation

#### Add Service Bus Secret

12. Left menu → **Secrets** → Click **+ Generate/Import**
13. **Upload options**: **Manual**
14. **Name**: `ServiceBusConnectionString`
15. **Value**: Paste the connection string from step 2.13
16. **Content type**: (leave blank)
17. **Enabled**: ✅ Yes
18. Click **Create**

**✅ Validation**: 
- Click on the secret → Click current version
- Verify you can see **Show Secret Value** (don't click yet)

**📌 Soft Delete Note**: 
- Soft delete is enabled by default (90-day retention)
- Deleted secrets can be recovered within 90 days
- Purge protection can be enabled for compliance (prevents immediate deletion)

---

### 4️⃣ Create Application Insights

1. Search **"Application Insights"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Name**: `appi-inspector-dev`
   - **Region**: `East US`
   - **Resource Mode**: **Workspace-based** (recommended)
   - **Log Analytics Workspace**: Click **Create new** → Name: `law-inspector-dev` → OK
3. Click **Review + create** → **Create**

#### Get Connection String

4. Navigate to the created Application Insights resource
5. Left menu → **Overview** → Copy **Connection String**
6. Example: `InstrumentationKey=abc123...;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;...`
7. Save for step 5

**✅ Validation**: 
- Left menu → **Live Metrics** → Should show "Waiting for data..."

---

### 5️⃣ Create App Service Plan

1. Search **"App Service plans"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Name**: `asp-inspector-dev`
   - **Operating System**: **Linux**
   - **Region**: `East US`
   - **Pricing tier**: Click **Explore pricing plans** → Select **Basic B1** (₹1,100/month)
3. Click **Review + create** → **Create**

---

### 6️⃣ Create App Service (Backend API)

1. Search **"App Services"** → Click **+ Create** → **Web App**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Name**: `app-inspector-dev` (becomes `app-inspector-dev.azurewebsites.net`)
   - **Publish**: **Code**
   - **Runtime stack**: **.NET** → **9 (STS)** (or .NET 8 LTS if 9 unavailable)
   - **Operating System**: **Linux**
   - **Region**: `East US`
   - **App Service Plan**: Select `asp-inspector-dev`
3. **Monitoring** tab:
   - **Enable Application Insights**: **Yes**
   - **Application Insights**: Select `appi-inspector-dev`
4. Click **Review + create** → **Create**

#### Enable Managed Identity

5. Navigate to the created App Service
6. Left menu → **Identity** → **System assigned** tab
7. **Status**: Toggle to **On** → Click **Save** → Click **Yes** in confirmation
8. ⚠️ **Copy the Object (principal) ID** shown after enabling (needed for step 7)

#### Configure App Settings

9. Left menu → **Environment variables** → **App settings** tab → Click **+ Add**

Add these settings one by one (click **+ Add** for each):

| Name | Value | Notes |
|------|-------|-------|
| `KeyVaultName` | `kv-inspector-2025` | Your Key Vault name |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Paste from step 4.6 | Full connection string |
| `SessionTimeoutMinutes` | `10` | Session expiry duration |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Or `Development` for testing |

10. Click **Apply** → Click **Confirm** in the popup

#### Configure CORS (will update after frontend URL is known)

11. Left menu → **CORS** → Enter `*` temporarily (wildcard - will restrict later)
12. Click **Save**

#### Configure Additional Settings

13. Left menu → **Configuration** → **General settings** tab
14. Update these settings:
    - **Platform**: 64 Bit
    - **HTTP version**: 2.0
    - **ARR affinity**: Off
    - **Always On**: On (prevents cold starts)
15. Click **Save** → **Continue**

**✅ Validation**: 
- Left menu → **Overview** → Click the **URL** (e.g., `https://app-inspector-dev.azurewebsites.net`)
- Should see "Hello World!" or default .NET page (we haven't deployed yet)

---

### 7️⃣ Grant App Service Access to Key Vault

1. Navigate to **Key Vault** (`kv-inspector-2025`)
2. Left menu → **Access control (IAM)** → Click **+ Add** → **Add role assignment**
3. **Role** tab:
   - Search: **"Key Vault Secrets User"**
   - Select the role → Click **Next**
4. **Members** tab:
   - **Assign access to**: **Managed identity**
   - Click **+ Select members**
   - **Managed identity**: Select **App Service**
   - Select: `app-inspector-dev`
   - Click **Select** → Click **Next**
5. Click **Review + assign**

**✅ Validation**:
- In Key Vault → **Access control (IAM)** → **Role assignments** tab
- Search for `app-inspector-dev` → Should show **Key Vault Secrets User** role

---

### 8️⃣ Deploy Backend Code

#### Option A: VS Code Deployment

1. Open VS Code → Install **Azure App Service** extension
2. Open your backend project folder: `/src/ServiceBusInspectorApi`
3. Right-click on `ServiceBusInspectorApi.csproj` → **Publish to Azure**
4. Select `app-inspector-dev` → Confirm
5. Wait for deployment to complete (2-3 minutes)

#### Option B: ZIP Deploy via Portal

1. Build the project locally:
   ```bash
   cd /Users/debasisghosh/Github/debg.eventdriven/src/ServiceBusInspectorApi
   dotnet publish -c Release -o ./publish
   cd publish
   zip -r ../app.zip .
   ```

2. Navigate to App Service → **Deployment Center** (left menu)
3. **Settings** tab → **FTPS credentials** → Copy username/password
4. Use Azure CLI or Kudu:
   - Navigate to `https://app-inspector-dev.scm.azurewebsites.net/ZipDeployUI`
   - Drag and drop `app.zip` to deploy

**✅ Validation**:
- Navigate to: `https://app-inspector-dev.azurewebsites.net/api/health`
- Should return: `{ "status": "Healthy", "timestamp": "..." }`

---

### 9️⃣ Frontend Hosting - Option A: Azure Static Web Apps (Recommended)

1. Search **"Static Web Apps"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Name**: `stapp-inspector`
   - **Plan type**: **Free** (100 GB bandwidth/month)
   - **Region**: `East US 2` (Static Web Apps regions)
   - **Deployment details**:
     - **Source**: **Other** (we'll upload manually)
3. Click **Review + create** → **Create**

#### Upload Frontend Build

4. Build the frontend locally:
   ```bash
   cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
   npm run build
   ```

5. Navigate to Static Web App → **Configuration** → **General settings**
6. Note the **Static Web Apps URL**: `https://nice-tree-0a1b2c3d4.2.azurestaticapps.net`

7. Deploy using SWA CLI:
   ```bash
   npm install -g @azure/static-web-apps-cli
   swa deploy ./dist --env production --deployment-token <token>
   ```
   
   **Get deployment token**: Static Web App → **Overview** → **Manage deployment token**

**Alternative: Manual Upload via Portal**
- Static Web App → **Configuration** → **Application settings**
- Upload `dist` folder contents via **Files** explorer (if available)

**✅ Validation**:
- Navigate to Static Web App URL
- Should see the React app UI

#### Link Backend API

8. Navigate to Static Web App → **Configuration** → **Application settings**
9. Click **+ Add**
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://app-inspector-dev.azurewebsites.net`
10. Click **OK** → **Save**

#### Update Backend CORS

11. Navigate to App Service → **CORS**
12. Remove `*` → Add Static Web App URL (without trailing slash):
    - `https://nice-tree-0a1b2c3d4.2.azurestaticapps.net`
13. Click **Save**

---

### 🔟 Frontend Hosting - Option B: Storage Static Website

1. Search **"Storage accounts"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-dev`
   - **Storage account name**: `stinspector2025` (lowercase, no hyphens)
   - **Region**: `East US`
   - **Performance**: **Standard**
   - **Redundancy**: **LRS** (Locally-redundant storage)
3. Click **Review + create** → **Create**

#### Enable Static Website

4. Navigate to Storage Account → **Data management** → **Static website**
5. **Static website**: Toggle to **Enabled**
6. **Index document name**: `index.html`
7. **Error document path**: `index.html`
8. Click **Save**
9. Copy **Primary endpoint**: `https://stinspector2025.z13.web.core.windows.net/`

#### Upload Build Files

10. Build frontend (if not already done):
    ```bash
    cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
    npm run build
    ```

11. Navigate to Storage Account → **Data storage** → **Containers**
12. Click **$web** container
13. Click **Upload** → Select all files from `dist` folder → **Upload**
    - Ensure folder structure is preserved (drag `index.html` + `assets` folder)

#### Update Backend CORS

14. Navigate to App Service → **CORS**
15. Remove `*` → Add Storage static website URL:
    - `https://stinspector2025.z13.web.core.windows.net`
16. Click **Save**

**✅ Validation**:
- Navigate to primary endpoint URL
- Should see React app UI

---

## ✅ End-to-End Validation Checklist

### 1. Backend Health Check
- [ ] Navigate to: `https://app-inspector-dev.azurewebsites.net/api/health`
- [ ] Response: `{ "status": "Healthy", "timestamp": "..." }`

### 2. Frontend Loads
- [ ] Navigate to frontend URL (Static Web App or Storage)
- [ ] React app renders with "Connect to Service Bus" form

### 3. Connect Flow
- [ ] Enter secret name: `ServiceBusConnectionString`
- [ ] Click **Connect**
- [ ] Should receive sessionId
- [ ] "Connected" status shown

### 4. List Entities
- [ ] Queue list populates with `test-queue`
- [ ] Click on `test-queue` to select

### 5. Peek Mode
- [ ] Click **Peek Mode**
- [ ] Messages from step 2.14 should appear in table
- [ ] Can sort/filter messages

### 6. Receive Mode
- [ ] Click **Receive Mode**
- [ ] Messages appear with checkboxes
- [ ] Select message → Click **Receive Selected**
- [ ] Confirmation modal appears
- [ ] After confirming, message disappears from queue

### 7. Application Insights
- [ ] Navigate to Application Insights → **Live Metrics**
- [ ] Perform actions in UI → See requests appearing in real-time
- [ ] Navigate to **Logs** → Run query:
   ```kusto
   requests
   | where timestamp > ago(1h)
   | where url contains "/api/"
   | project timestamp, name, resultCode, duration
   | order by timestamp desc
   ```

### 8. Correlation Tracing
- [ ] Open browser DevTools → Network tab
- [ ] Make a request → Check request headers for `X-Correlation-ID`
- [ ] In Application Insights → **Transaction search**
- [ ] Search for correlation ID → See full trace (frontend → backend → Key Vault → Service Bus)

---

## 💰 Cost Estimate (Monthly - INR)

| Service | Configuration | Cost (INR/month) |
|---------|--------------|------------------|
| **Service Bus** | Standard, 1 namespace, 1 queue | ₹600 - ₹800 |
| **Key Vault** | Standard, ~100 operations/day | ₹250 - ₹350 |
| **App Service Plan** | B1 (1 core, 1.75 GB RAM, Linux) | ₹1,000 - ₹1,200 |
| **App Service** | Included in Plan | ₹0 |
| **Application Insights** | 5 GB data/month, 90-day retention | ₹300 - ₹500 |
| **Static Web Apps** | Free tier (100 GB bandwidth) | ₹0 |
| **Storage Account** | LRS, <1 GB, static website | ₹50 - ₹100 |
| **Outbound Bandwidth** | ~5 GB/month | ₹200 - ₹300 |
| **Total (Option A: Static Web Apps)** | | **₹2,350 - ₹3,150** |
| **Total (Option B: Storage Static)** | | **₹2,400 - ₹3,250** |

**💡 Cost Optimization Tips**:
- Use **Consumption** tier for Service Bus if traffic is low (<100 msg/min)
- **App Service B1** can be scaled down to **F1 Free** for dev/testing (limited hours)
- Application Insights: Enable sampling (90% reduction) for high-volume apps
- Static Web Apps Free tier sufficient for MVP (<100K requests/month)

**📊 Production Scale Estimate** (10K sessions/day):
- Upgrade to **S1 App Service Plan**: ₹5,500/month
- Service Bus Standard remains same
- Application Insights: ₹1,500/month (15 GB data)
- **Total**: ₹7,500 - ₹9,000/month

---

## 🔒 Security Hardening (Post-MVP)

### Network Isolation
1. **Key Vault**: Enable Private Endpoint
   - Navigate to Key Vault → **Networking** → **Private endpoint connections**
   - Disable public access after testing

2. **Service Bus**: Enable Private Endpoint
   - Navigate to Service Bus → **Networking** → **Private endpoint connections**

3. **App Service**: VNet Integration
   - Navigate to App Service → **Networking** → **VNet integration**
   - Connect to private subnet

### Access Control
4. **Key Vault**: Audit access logs
   - Navigate to Key Vault → **Diagnostic settings**
   - Send `AuditEvent` logs to Log Analytics

5. **Service Bus**: Use SAS policies with least privilege
   - Instead of `RootManageSharedAccessKey`, create custom policy:
     - Listen + Send only (no Manage)

6. **App Service**: IP Restrictions
   - Navigate to App Service → **Networking** → **Access restriction**
   - Whitelist specific IPs or use Service Tags

---

## 🐛 Troubleshooting

### Issue: "Failed to create session" error
**Solution**:
1. Check App Service logs: App Service → **Log stream**
2. Verify Managed Identity has **Key Vault Secrets User** role
3. Test Key Vault access:
   ```bash
   # In App Service SSH console (Advanced Tools → Kudu → SSH)
   curl "https://kv-inspector-2025.vault.azure.net/secrets/ServiceBusConnectionString?api-version=7.4" \
     -H "Authorization: Bearer $(curl -s 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net' -H Metadata:true | jq -r .access_token)"
   ```

### Issue: CORS error in browser console
**Solution**:
1. Verify App Service → **CORS** includes exact frontend URL (no trailing slash)
2. Check frontend `.env` or `vite.config.ts` has correct API URL
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: SSE stream disconnects immediately
**Solution**:
1. Check App Service → **Configuration** → **General settings** → **Web sockets**: Should be **On** (optional but helps)
2. Verify **Always On**: Should be **On** (prevents app shutdown)
3. Check Application Insights for timeout errors

### Issue: Messages not appearing in Peek mode
**Solution**:
1. Verify Service Bus has messages: Service Bus → **Service Bus Explorer** → Select queue → Check **Active messages** count
2. Check backend logs for Service Bus connection errors
3. Verify connection string in Key Vault is correct (has `EntityPath` if needed)

---

## 📚 Next Steps

1. **Production Readiness**:
   - Replace in-memory session store with **Azure Cache for Redis**
   - Replace file-based audit log with **Cosmos DB**
   - Enable **Private Endpoints** for all Azure services
   - Set up **Azure Front Door** for global CDN + WAF

2. **CI/CD Pipeline**:
   - Set up GitHub Actions for automated deployment
   - Backend: Build → Publish → Deploy to App Service
   - Frontend: Build → Deploy to Static Web Apps (auto via SWA GitHub integration)

3. **Monitoring & Alerts**:
   - Create Azure Monitor alerts for:
     - App Service CPU > 80%
     - Application Insights errors > 10/min
     - Service Bus queue depth > 1000 messages
   - Set up Log Analytics queries for security auditing

4. **Load Testing**:
   - Use Azure Load Testing service
   - Test SSE streaming under concurrent connections (100-500 users)
   - Validate session cleanup and memory usage

---

## 📞 Support & Resources

- **Azure Documentation**: https://docs.microsoft.com/azure
- **Service Bus Pricing**: https://azure.microsoft.com/pricing/details/service-bus/
- **App Service Pricing**: https://azure.microsoft.com/pricing/details/app-service/linux/
- **Static Web Apps Docs**: https://docs.microsoft.com/azure/static-web-apps/

**Author**: Debasis Ghosh  
**Created**: November 2025  
**Version**: 1.0  
**License**: MIT
