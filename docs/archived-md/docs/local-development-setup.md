# Local Development Setup Guide
## Azure Service Bus Inspector - Minimal Azure Resources for Local Dev

**Target**: Run backend + frontend locally in VS Code  
**Azure Components**: Service Bus + Key Vault only  
**Cost**: ~₹850-1,100/month  
**Setup Time**: 15-20 minutes

---

## 🎯 What You'll Create

```
┌─────────────────────────────────────────────────────────┐
│         Local Development Machine (VS Code)             │
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │  React Frontend  │      │  ASP.NET Backend │       │
│  │  localhost:5173  │─────▶│  localhost:7001  │       │
│  │  (npm run dev)   │      │  (dotnet run)    │       │
│  └──────────────────┘      └────────┬─────────┘       │
│                                     │                   │
│                        ┌────────────┼─────────┐        │
│                        │ az login   │         │        │
│                        │ (Default   │         │        │
│                        │  Azure     │         │        │
│                        │  Credential)│         │        │
└────────────────────────┴────────────┴─────────┴────────┘
                                      │         │
                           ┌──────────▼─┐   ┌──▼───────────┐
                           │ Key Vault  │   │ Service Bus  │
                           │ (RBAC)     │   │ (Standard)   │
                           │            │   │              │
                           │ Secret:    │   │ test-queue   │
                           │ ServiceBus │   │              │
                           │ ConnString │   │              │
                           └────────────┘   └──────────────┘
                                  ▲               ▲
                                  └───────────────┘
                                    Azure Cloud
```

---

## 📋 Prerequisites

- Azure subscription with contributor access
- Azure CLI installed (`az --version` to verify)
- .NET 9 SDK installed
- Node.js 18+ installed
- VS Code with C# Dev Kit extension

---

## 🚀 Step-by-Step Azure Portal Setup

### 1️⃣ Create Resource Group

1. Navigate to **Azure Portal** (portal.azure.com)
2. Search **"Resource groups"** in top search bar
3. Click **+ Create**
4. Fill in:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-local`
   - **Region**: `Central India` (or `East US`)
5. Click **Review + create** → **Create**

**✅ Verify**: Resource group appears in the list (refresh if needed)

---

### 2️⃣ Create Service Bus Namespace

1. Search **"Service Bus"** in top search bar
2. Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: Select `rg-servicebus-inspector-local`
   - **Namespace name**: `sb-inspector-local-<your-initials>` (e.g., `sb-inspector-local-dg`)
     - Must be globally unique (will show ✅ or ❌)
   - **Location**: `Central India` (same as resource group)
   - **Pricing tier**: **Standard** (required for topics/dead-letter queues)
4. Click **Review + create** → **Create**
   - Wait 2-3 minutes for deployment

**✅ Verify**: Click **Go to resource** when deployment completes

#### Create Test Queue

5. In Service Bus namespace → Left menu → **Queues**
6. Click **+ Queue**
7. Fill in:
   - **Name**: `test-queue`
   - **Max queue size**: 1 GB (default)
   - **Message TTL**: 14 days (default)
   - **Lock duration**: 30 seconds (default)
   - **Enable dead lettering**: ✅ Checked
8. Click **Create**

**✅ Verify**: Queue `test-queue` appears in the list

#### Get Connection String

9. Left menu → **Shared access policies**
10. Click **RootManageSharedAccessKey**
11. Copy **Primary Connection String**
    - Example: `Endpoint=sb://sb-inspector-local-dg.servicebus.windows.net/;SharedAccessKeyName=...`
    - **Save this** - you'll need it in step 3

**💡 Test the Queue** (Optional):
- Left menu → **Service Bus Explorer**
- Select `test-queue`
- Click **Send message** → Enter: `{"test": "Hello from portal"}`
- Click **Send** → Verify "Active messages: 1"

---

### 3️⃣ Create User Assigned Managed Identity

1. Search **"Managed Identities"** in top search bar
2. Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: Select `rg-servicebus-inspector-local`
   - **Region**: `Central India` (same as resource group)
   - **Name**: `mi-servicebus-inspector-local`
4. Click **Review + create** → **Create**

**✅ Verify**: Click **Go to resource** when deployment completes
- Note down the **Client ID** and **Principal ID** from the Overview page (you'll need these later)

---

### 4️⃣ Create Key Vault

1. Search **"Key vaults"** in top search bar
2. Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: Select `rg-servicebus-inspector-local`
   - **Key vault name**: `kv-inspector-local-<your-initials>` (e.g., `kv-inspector-local-dg`)
     - Must be globally unique (3-24 chars, lowercase, numbers, hyphens)
   - **Region**: `Central India` (same as resource group)
   - **Pricing tier**: **Standard** (cheaper than Premium)
4. **Access configuration** tab:
   - **Permission model**: Select **Vault access policy** ⚠️ Important!
   - Leave other settings as default
5. Click **Review + create** → **Create**

**✅ Verify**: Click **Go to resource** when deployment completes

#### Configure Access Policies

1. In Key Vault → Left menu → **Access policies**
2. Click **+ Create**
3. **Configure from template**: Select **Secret Management**
4. **Key permissions**: Leave defaults
5. **Secret permissions**: Check **Get** and **List**
6. **Certificate permissions**: Leave defaults
7. **Select principal**: Search for `mi-servicebus-inspector-local` → Select it
8. Click **Next** → **Next** → **Create**

#### Grant Yourself Temporary Access (for setup)

1. Click **+ Create** again
2. **Configure from template**: Select **Secret Management**
3. **Secret permissions**: Check **Get**, **List**, **Set**, **Delete**
4. **Select principal**: Search for your email address → Select yourself
5. Click **Next** → **Next** → **Create**

**✅ Verify**:
- Access policies → Should show 2 policies
- One for the Managed Identity (Get, List permissions)
- One for you (Get, List, Set, Delete permissions)

#### Add Service Bus Secret

1. Left menu → **Secrets**
2. Click **+ Generate/Import**
3. Fill in:
    - **Upload options**: Manual
    - **Name**: `ServiceBusConnectionString`
    - **Value**: Paste the connection string from step 2.11
    - **Content type**: (leave blank)
    - **Enabled**: Yes (default)
4. Click **Create**

**✅ Verify**:
- Secret appears in the list
- Click the secret → Click current version → Should see "Show Secret Value" button

**✅ Verify**: 
- IAM → Role assignments → Search your email
- Should see both roles: "Key Vault Secrets Officer" and "Key Vault Secrets User"

---

## 💻 Local Development Configuration

### Step 1: Authenticate with Azure

Open terminal in VS Code and run:

```bash
az login
```

- Browser opens → Sign in with your Azure account
- Verify correct subscription is selected:

```bash
az account show --output table
```

**✅ Expected output**: Your subscription name and ID

---

### Step 2: Configure Backend

1. Open `/src/RegistrationApi/appsettings.Development.json`
2. Update `KeyVaultName`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "KeyVaultName": "kv-inspector-local-dg",
  "SessionTimeoutMinutes": 10
}
```

Replace `kv-inspector-local-dg` with your actual Key Vault name from step 3.3.

---

### Step 3: Run Backend Locally

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/RegistrationApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

**✅ Expected output**:
```
info: RegistrationApi.Services.AuditStore[0]
      Audit store initialized at .../data/audit.log
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7001
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5001
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
```

**🔍 How Authentication Works**:

#### For Local Development (Current Setup)
1. Backend code uses `new DefaultAzureCredential()`
2. It tries authentication methods in order:
   - Environment variables (not set)
   - Workload identity (not applicable)
   - Managed identity (not applicable locally)
   - **Azure CLI** (`az login` credentials) ✅ **This works!**
   - Visual Studio (if signed in)
3. Uses your `az login` token to access Key Vault
4. Retrieves `ServiceBusConnectionString` secret
5. Connects to Service Bus

#### For Azure Deployment (Future)
1. Deploy app to Azure App Service/Web App
2. Assign the User Assigned Managed Identity (`mi-servicebus-inspector-local`) to the App Service
3. `DefaultAzureCredential` will automatically use the Managed Identity
4. No code changes needed - same authentication flow works in both environments!

**Key Benefits of Managed Identity Setup**:
- ✅ **Zero secrets in code** - No connection strings or keys
- ✅ **Same code works locally and in Azure**
- ✅ **Automatic token management** - No manual credential handling
- ✅ **Secure by default** - Identity-based access control

---

### Step 4: Run Frontend Locally

Open a **new terminal** in VS Code:

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
npm install  # If not already done
npm run dev
```

**✅ Expected output**:
```
  VITE v5.4.21  ready in 207 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open browser: **http://localhost:5173**

---

## ✅ End-to-End Validation Checklist

### 1. Azure CLI Authentication
```bash
az account show
```
- [ ] Shows your subscription details
- [ ] No error messages

### 2. Key Vault Access Test
```bash
az keyvault secret show \
  --vault-name kv-inspector-local-dg \
  --name ServiceBusConnectionString \
  --query value -o tsv
```
- [ ] Returns the Service Bus connection string
- [ ] No "Forbidden" or "access denied" errors

### 3. Backend Health Check
Navigate to: **https://localhost:7001/api/health**

**Expected response**:
```json
{
  "status": "Healthy",
  "timestamp": "2025-11-14T10:30:00.123Z"
}
```

### 4. Frontend → Backend Connection
In browser (http://localhost:5173):

1. Enter secret name: `ServiceBusConnectionString`
2. Click **Connect**
3. **Expected**: 
   - "Connected!" message
   - Session ID displayed
   - No CORS errors in browser console

### 5. List Service Bus Entities
After connecting:

- [ ] Queue list loads and shows `test-queue`
- [ ] No errors in browser console or backend logs

### 6. Peek Mode Test
1. Select `test-queue`
2. Click **Peek Mode**
3. **Expected**:
   - SSE connection establishes
   - If queue has messages (from step 2), they appear in table
   - If no messages, heartbeat events appear every 2s
   - No disconnection errors

### 7. Send Test Message & Peek
In **new terminal**:

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/scripts
npm install  # If not already done

# Set connection string (paste from step 2.11)
export SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://..."

# Send 5 test messages
node send-sample-messages.js test-queue 5
```

**Expected output**:
```
✅ Successfully sent 5 messages to queue 'test-queue'
```

Back in UI:
- [ ] Messages appear in the table within 2 seconds
- [ ] Can sort by sequence number
- [ ] Can filter messages
- [ ] Message body displays correctly

### 8. Receive Mode Test
1. Click **Receive Mode** (frontend switches from peek)
2. Messages appear with checkboxes and lock timer
3. Select 1-2 messages
4. Click **Receive Selected**
5. Confirmation modal appears
6. Click **Confirm**
7. **Expected**:
   - Selected messages disappear from UI
   - Messages removed from queue (verify in Azure Portal Service Bus Explorer)
   - No errors in backend logs

---

## 💰 Cost Estimate (Monthly - INR)

| Service | Configuration | Cost (INR/month) |
|---------|---------------|------------------|
| **Service Bus** | Standard, 1 namespace, 1 queue, minimal traffic | ₹600 - ₹700 |
| **Key Vault** | Standard, <100 operations/day | ₹250 - ₹350 |
| **Bandwidth** | Negligible (local dev) | ₹50 - ₹100 |
| **Total** | | **₹900 - ₹1,150** |

**💡 Cost Optimization**:
- Delete resources when not developing: `az group delete -n rg-servicebus-inspector-local --yes`
- Recreate in 15 minutes when needed (follow this guide)
- Or keep it - less than a cup of coffee per day ☕

**📊 Zero-Cost Alternative** (for testing only):
- Use **Azure Service Bus Emulator** (preview): Free, runs locally
- Not recommended for this project (lacks full feature parity)

---

## 🐛 Troubleshooting

### Issue: `az login` succeeds but backend can't access Key Vault

**Error in backend logs**:
```
Azure.Identity.CredentialUnavailableException: DefaultAzureCredential failed to retrieve a token
```

**Solutions**:
1. Verify correct subscription is active:
   ```bash
   az account set --subscription "Your Subscription Name"
   ```

2. Clear Azure CLI cache and re-login:
   ```bash
   az account clear
   az login
   ```

3. Check RBAC role assignment:
   - Portal → Key Vault → Access control (IAM)
   - Verify "Key Vault Secrets User" role is assigned to your user
   - **Wait 5 minutes** after assignment before retrying

---

### Issue: "Secret not found" error

**Backend logs**:
```
Azure.RequestFailedException: The specified secret was not found
```

**Solutions**:
1. Verify secret name matches exactly: `ServiceBusConnectionString` (case-sensitive)
2. Check `appsettings.Development.json` has correct `KeyVaultName`
3. Verify secret exists:
   ```bash
   az keyvault secret list --vault-name kv-inspector-local-dg -o table
   ```

---

### Issue: CORS error when frontend calls backend

**Browser console**:
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**:
- Backend `Program.cs` already has CORS configured for `http://localhost:5173`
- Verify frontend is running on port 5173 (check Vite output)
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

---

### Issue: Service Bus connection fails

**Backend logs**:
```
ServiceBusException: The connection string is invalid
```

**Solutions**:
1. Verify connection string in Key Vault has no extra spaces or line breaks
2. Test connection string format:
   ```bash
   # Should start with: Endpoint=sb://
   # Should contain: SharedAccessKeyName=RootManageSharedAccessKey
   # Should contain: SharedAccessKey=...
   ```

3. Regenerate connection string:
   - Portal → Service Bus → Shared access policies
   - Click `RootManageSharedAccessKey` → Regenerate primary key
   - Copy new connection string → Update Key Vault secret

---

## 🎓 How It Works: Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Developer runs `az login` in terminal          │
│ • Azure CLI stores token in ~/.azure/                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Step 2: Developer runs `dotnet run` (backend starts)   │
│ • Backend code: new DefaultAzureCredential()            │
│ • Tries authentication sources in order                 │
│ • Finds Azure CLI token → Uses it! ✅                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Step 3: Backend calls KeyVaultService.GetSecretAsync()  │
│ • Constructs Key Vault URL:                             │
│   https://kv-inspector-local-dg.vault.azure.net         │
│ • Attaches Azure CLI token as Bearer auth               │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Step 4: Azure Key Vault validates token                │
│ • Checks: Is user authenticated? ✅                     │
│ • Checks: Does user have "Key Vault Secrets User"? ✅   │
│ • Returns secret value                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│ Step 5: Backend uses connection string                 │
│ • Creates ServiceBusClient                              │
│ • Lists queues, peeks messages, receives messages       │
└─────────────────────────────────────────────────────────┘
```

**Key Benefits**:
- ✅ No secrets in code or config files
- ✅ No environment variables to manage
- ✅ Same code works in Azure (uses Managed Identity instead of CLI)
- ✅ Audit trail in Azure AD (who accessed what, when)

---

## 📚 Next Steps

### For Production Deployment:
- Follow `/docs/azure-portal-deployment-guide.md` to deploy to Azure
- Backend uses **System-Assigned Managed Identity** (no `az login` needed)
- Frontend hosted on **Azure Static Web Apps** or **App Service**

### For Team Collaboration:
1. Share Key Vault name with team
2. Add team members as "Key Vault Secrets User" (step 3.16-20)
3. Each developer runs `az login` with their own account
4. RBAC enforces individual access control

### For CI/CD Pipeline:
- Use **Service Principal** or **Workload Identity** (GitHub Actions)
- Grant Key Vault access to service principal, not individual users

---

## 📞 Quick Reference

**Backend API Endpoints**:
- Health: `https://localhost:7001/api/health`
- Connect: `POST https://localhost:7001/api/namespace/connect`
- List entities: `GET https://localhost:7001/api/namespace/{sessionId}/entities`
- Stream (SSE): `GET https://localhost:7001/api/stream/{sessionId}/{entityName}?mode=peek`

**Azure Resources**:
- Service Bus: `sb-inspector-local-<initials>.servicebus.windows.net`
- Key Vault: `https://kv-inspector-local-<initials>.vault.azure.net`

**Useful Commands**:
```bash
# Check current Azure account
az account show

# List Key Vault secrets
az keyvault secret list --vault-name kv-inspector-local-dg -o table

# View Service Bus queue details
az servicebus queue show \
  --resource-group rg-servicebus-inspector-local \
  --namespace-name sb-inspector-local-dg \
  --name test-queue \
  -o table

# Delete all resources when done
az group delete -n rg-servicebus-inspector-local --yes --no-wait
```

---

**Author**: Debasis Ghosh  
**Created**: November 2025  
**Version**: 1.0  
**Purpose**: Local development only - minimal Azure resources
