# Minimal Azure PaaS Setup for Local Development

This guide provides **three methods** to create the bare minimum Azure resources needed to run the Service Bus Inspector application locally with enterprise-grade security using Azure Key Vault and RBAC best practices.

**Choose your preferred setup method:**
- 🤖 **Automated CLI Script** (10-15 minutes, fully automated)
- 🌐 **Azure Portal UI** (15-20 minutes, step-by-step web interface)
- 💻 **Manual CLI Commands** (Advanced users, full control)

| Method | Time | Experience | Best For |
|--------|------|------------|----------|
| **CLI Script** | 10-15 min | Beginner | Quick setup, automation |
| **Portal UI** | 15-20 min | All levels | Visual interface, learning Azure |
| **Manual CLI** | 15-25 min | Advanced | Custom configs, troubleshooting |

## 🎯 What Gets Created

| Resource | SKU/Tier | Purpose | Monthly Cost (INR) |
|----------|----------|---------|-------------------|
| **Resource Group** | N/A | Container for all resources | Free |
| **Service Bus Namespace** | Standard | Message broker | ₹500-700 |
| **Queue** (`test-queue`) | N/A | Test message queue | Included |
| **Key Vault** | Standard | Secure secret storage | ₹350-400 |
| **RBAC Roles** | Key Vault Secrets Officer | Secure access permissions | Free |
| | | **Total** | **₹850-1,100** |

## ⚡ Quick Setup Options

Choose your preferred method:

### Option 1: Automated CLI Script (Fastest)
```bash
cd scripts
chmod +x setup-azure-minimal.sh
./setup-azure-minimal.sh
```

### Option 2: Azure Portal UI (Step-by-Step)
Follow the detailed Portal UI guide below for full control.

### Option 3: Manual CLI Commands (Advanced)
For custom configurations or troubleshooting.

**Time**: 10-15 minutes (includes waiting for Azure provisioning)

The script will:
1. ✅ Verify Azure CLI authentication
2. 📦 Create resource group `rg-servicebus-inspector-local`
3. 🚌 Create Service Bus namespace ` ` (Standard tier)
4. 📥 Create queue `test-queue` with dead-lettering enabled
5. 🔐 Create Key Vault `kv-inspector-local-dg` with **RBAC authorization** (best practice)
6. 🔑 Grant you **"Key Vault Secrets Officer"** RBAC role
7. 💾 Store Service Bus connection string as secret `ServiceBusConnectionString`

---

## 🌐 Azure Portal UI Setup (Step-by-Step)

**For users who prefer the web interface over CLI commands.**

### Prerequisites
- ✅ Azure subscription with Contributor access
- ✅ Azure account logged in to [portal.azure.com](https://portal.azure.com)
- ✅ Your user account has RBAC permissions

---

### Step 1: Create Resource Group

1. Go to **portal.azure.com** and sign in
2. Search **"Resource groups"** in the top search bar
3. Click **+ Create**
4. Fill in the **Basics** tab:
   - **Subscription**: Select your Azure subscription
   - **Resource group**: `rg-servicebus-inspector-local`
   - **Region**: `Central India` (or your preferred region)
5. Click **Review + create** → **Create**
6. **Wait for deployment** (usually 30 seconds)

**✅ Verify**: Resource group appears in the list

---

### Step 2: Create Service Bus Namespace

1. Search **"Service Bus"** in the top search bar
2. Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-local`
   - **Namespace name**: `sb-inspector-local-dg`
     - Must be globally unique (add your initials if needed)
   - **Location**: `Central India`
   - **Pricing tier**: **Standard** (₹500-700/month)
4. Click **Review + create** → **Create**
5. **Wait 2-3 minutes** for provisioning

**✅ Verify**: Status shows "Active"

#### Create Test Queue

1. In your Service Bus namespace → Left menu → **Queues**
2. Click **+ Queue**
3. Configure:
   - **Name**: `test-queue`
   - **Max queue size**: 1 GB
   - **Message TTL**: 14 days
   - **Lock duration**: 30 seconds
   - **Enable dead lettering**: ✅ Checked
4. Click **Create**

**✅ Verify**: Queue appears in the list

#### Get Connection String

1. Left menu → **Shared access policies**
2. Click **RootManageSharedAccessKey**
3. Click the **copy button** next to **Primary Connection String**
4. **Save this securely** - you'll need it for Key Vault

---

### Step 3: Create Key Vault

1. Search **"Key Vault"** in the top search bar
2. Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-servicebus-inspector-local`
   - **Key vault name**: `kv-inspector-local-dg`
     - Must be globally unique
   - **Region**: `Central India`
   - **Pricing tier**: **Standard** (₹350-400/month)
4. **Access configuration** tab:
   - **Permission model**: **Azure role-based access control (recommended)**
   - **Enable Azure Virtual Machines for deployment**: ❌ Unchecked
   - **Enable Azure Resource Manager for template deployment**: ❌ Unchecked
5. **Networking** tab:
   - **Connectivity method**: **Public endpoint** (OK for local development)
6. **Security** tab:
   - **Soft delete**: ✅ **Enabled** (recommended)
   - **Purge protection**: ✅ **Enabled** (recommended)
   - **Deployment**: ❌ Disabled
7. Click **Review + create** → **Create**
8. **Wait 1-2 minutes** for provisioning

**✅ Verify**: Key Vault appears in the list

---

### Step 4: Grant RBAC Permissions

1. Go to your Key Vault: `kv-inspector-local-dg`
2. Left menu → **Access control (IAM)**
3. Click **+ Add** → **Add role assignment**
4. **Role** tab:
   - Search: **"Key Vault Secrets Officer"**
   - Select **Key Vault Secrets Officer**
5. **Members** tab:
   - **Assign access to**: **User, group, or service principal**
   - Click **+ Select members**
   - Search for your email/name
   - Select your account → **Select**
6. **Review + assign** tab:
   - Review the assignment
   - Click **Review + assign**

**✅ Verify**: Your user appears in the **Role assignments** list

---

### Step 5: Create Secret

1. In Key Vault → Left menu → **Secrets**
2. Click **+ Generate/Import**
3. **Create a secret** panel:
   - **Name**: `ServiceBusConnectionString`
   - **Secret value**: Paste the Service Bus connection string you copied earlier
   - **Content type**: `text/plain`
   - **Enabled**: ✅ **Yes**
4. Click **Create**

**✅ Verify**: Secret appears in the list with status "Enabled"

---

## ✅ Portal UI Setup Verification

After completing all steps, verify your setup:

### In Azure Portal:
1. **Resource Group** `rg-servicebus-inspector-local` contains all resources
2. **Service Bus** `sb-inspector-local-dg` shows "Active" status
3. **Queue** `test-queue` exists with correct settings
4. **Key Vault** `kv-inspector-local-dg` exists
5. **Secret** `ServiceBusConnectionString` is "Enabled"
6. **RBAC Role** "Key Vault Secrets Officer" assigned to your user

### Test Locally:
```bash
# Update backend config
echo '{
  "KeyVaultName": "kv-inspector-local-dg",
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "SessionTimeoutMinutes": 10
}' > src/RegistrationApi/appsettings.Development.json

# Run application (see Running Locally section below)
```

---

## 📝 Manual CLI Setup (Alternative)

---

### Step 6: Verify All Resources

Use the Azure Portal to verify:

1. **Resource Group** `rg-servicebus-inspector-local` exists
2. **Service Bus** `sb-inspector-local-dg` shows "Active"
3. **Queue** `test-queue` exists under Queues
4. **Key Vault** `kv-inspector-local-dg` exists
5. **Secret** `ServiceBusConnectionString` exists and is "Enabled"
6. **RBAC Role** "Key Vault Secrets Officer" assigned to your user

---

## 📝 Manual CLI Setup (Alternative)

<details>
<summary>Click to expand manual steps</summary>

### Step 1: Create Resource Group

```bash
az group create \
  --name rg-servicebus-inspector-local \
  --location centralindia
```

### Step 2: Create Service Bus Namespace

```bash
az servicebus namespace create \
  --name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --location centralindia \
  --sku Standard
```

⏳ Wait 60 seconds for provisioning

### Step 3: Create Queue

```bash
az servicebus queue create \
  --name test-queue \
  --namespace-name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --enable-dead-lettering-on-message-expiration true \
  --default-message-time-to-live P14D \
  --lock-duration PT30S
```

### Step 4: Get Connection String

```bash
az servicebus namespace authorization-rule keys list \
  --name RootManageSharedAccessKey \
  --namespace-name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --query primaryConnectionString \
  --output tsv
```

**Save this output** - you'll need it in Step 7.

### Step 5: Create Key Vault (RBAC Best Practice)

```bash
az keyvault create \
  --name kv-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --location centralindia \
  --sku Standard \
  --enable-rbac-authorization true \
  --enabled-for-deployment false \
  --enabled-for-template-deployment false \
  --enable-soft-delete true \
  --enable-purge-protection true
```

**Security Features Enabled:**
- ✅ **RBAC Authorization** (modern, not legacy access policies)
- ✅ **Soft Delete** (90-day recovery period)
- ✅ **Purge Protection** (prevents permanent deletion)

### Step 6: Grant RBAC Permissions

Grant yourself "Key Vault Secrets Officer" role for local development:

```bash
# Get your user object ID
USER_ID=$(az ad signed-in-user show --query id --output tsv)

# Assign Key Vault Secrets Officer role
az role assignment create \
  --assignee $USER_ID \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/$(az account show --query id --output tsv)/resourceGroups/rg-servicebus-inspector-local/providers/Microsoft.KeyVault/vaults/kv-inspector-local-dg
```

**Why RBAC?**
- Modern Azure-wide permissions (consistent with other services)
- Better audit logging and compliance
- Least privilege access (read-only for secrets)

### Step 7: Store Connection String Secret

```bash
# Get Service Bus connection string
CONNECTION_STRING=$(az servicebus namespace authorization-rule keys list \
  --name RootManageSharedAccessKey \
  --namespace-name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --query primaryConnectionString \
  --output tsv)

# Store as secret in Key Vault
az keyvault secret set \
  --vault-name kv-inspector-local-dg \
  --name ServiceBusConnectionString \
  --value "$CONNECTION_STRING"
```

**Best Practices:**
- Descriptive secret name (not generic like "conn-string")
- Automatic versioning handled by Key Vault
- Never commit connection strings to source control

</details>

---

## 🔧 Configuration

### Update Backend Config

Edit `src/RegistrationApi/appsettings.Development.json`:

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

---

## 🔐 Key Vault Security Best Practices

### ✅ **What This Setup Provides:**

- **RBAC Authorization**: Modern Azure role-based access control
- **Soft Delete**: 90-day recovery period for accidentally deleted secrets
- **Purge Protection**: Prevents permanent deletion during retention period
- **Least Privilege**: Read-only access for local development
- **Audit Logging**: All Key Vault operations are logged
- **Enterprise Security**: Industry-standard secret management

### ✅ **How It Works:**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐
│  ASP.NET Core   │────▶│  Key Vault      │────▶│  Secrets    │
│  (localhost)    │    │  (RBAC)         │    │  (Encrypted) │
│                 │    │                 │    │             │
└─────────────────┘    └─────────────────┘    └─────────────┘
         │
         ▼
┌─────────────────┐
│  Service Bus    │
│  (Azure)        │
└─────────────────┘
```

**Security Flow:**
1. ASP.NET Core uses `DefaultAzureCredential`
2. Authenticates via Azure CLI (`az login`)
3. Key Vault validates RBAC permissions
4. Returns encrypted secret value

### ✅ **Key Security Features:**

- **No Secrets in Code**: Connection strings never stored in source code
- **RBAC vs Access Policies**: Modern, consistent permissions across Azure
- **Soft Delete Protection**: Recover accidentally deleted secrets
- **Purge Protection**: Ransomware and permanent deletion protection
- **Automatic Encryption**: Secrets encrypted at rest and in transit

### Terminal 1: Backend

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/RegistrationApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

**Expected output**:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7001
```

### Terminal 2: Frontend

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
npm run dev
```

**Expected output**:
```
VITE v5.4.21  ready in 176 ms
➜  Local:   http://localhost:5173/
```

### Terminal 3: Send Test Messages

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/scripts
npm install  # First time only
node send-sample-messages.js test-queue 10
```

**Expected output**:
```
✅ Sent 10 messages to test-queue
```

---

## ✅ Verification

### Check All Resources Exist

```bash
# Resource group
az group show --name rg-servicebus-inspector-local --output table

# Service Bus namespace
az servicebus namespace show \
  --name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --output table

# Queue details
az servicebus queue show \
  --name test-queue \
  --namespace-name sb-inspector-local-dg \
  --resource-group rg-servicebus-inspector-local \
  --output table

# Key Vault
az keyvault show --name kv-inspector-local-dg --output table

# Secret exists
az keyvault secret show \
  --vault-name kv-inspector-local-dg \
  --name ServiceBusConnectionString \
  --query "{Name:name, Enabled:attributes.enabled}" \
  --output table

# RBAC role assignment
az role assignment list \
  --scope /subscriptions/$(az account show --query id --output tsv)/resourceGroups/rg-servicebus-inspector-local/providers/Microsoft.KeyVault/vaults/kv-inspector-local-dg \
  --query "[?roleDefinitionName=='Key Vault Secrets Officer']" \
  --output table
```

### Test Connection

```bash
# Test backend health
curl https://localhost:7001/health

# Expected: {"status":"healthy","timestamp":"..."}
```

---

## 🔐 How Authentication Works

```
┌──────────────────────────────────────────────────┐
│  Your Local Machine                              │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │  az login                              │     │
│  │  (Azure CLI credentials cached)        │     │
│  └────────────┬───────────────────────────┘     │
│               │                                  │
│  ┌────────────▼───────────────────────────┐     │
│  │  DefaultAzureCredential                │     │
│  │  (ASP.NET Backend)                     │     │
│  │                                        │     │
│  │  1. Checks Azure CLI token first       │     │
│  │  2. Falls back to Managed Identity     │     │
│  │     (for Azure deployments)            │     │
│  └────────────┬───────────────────────────┘     │
└───────────────┼──────────────────────────────────┘
                │
                │ Uses cached Azure CLI token
                │
        ┌───────▼────────────────────────────┐
        │  Azure Cloud                       │
        │                                    │
        │  ┌──────────────┐  ┌─────────────┐│
        │  │  Key Vault   │  │ Service Bus ││
        │  │              │  │             ││
        │  │  RBAC checks:│  │             ││
        │  │  • Secrets   │  │             ││
        │  │    User role │  │             ││
        │  └──────────────┘  └─────────────┘│
        └────────────────────────────────────┘
```

**Key Points**:
- ✅ **No connection strings in code**
- ✅ **No credentials in appsettings.json**
- ✅ **Uses your `az login` identity locally** (temporary access)
- ✅ **Uses Managed Identity in Azure** (production-ready)
- ✅ **Same code works in both environments**
- ✅ **Secure by default with identity-based access**

**Migration Path**:
1. **Local Dev**: Use `az login` (temporary access policy)
2. **Azure Deploy**: Assign Managed Identity to App Service, remove temporary policy
3. **Zero code changes** - `DefaultAzureCredential` handles everything!

---

## 🧹 Cleanup (When Done)

### Delete All Resources

```bash
az group delete --name rg-servicebus-inspector-local --yes --no-wait
```

This deletes:
- Service Bus namespace
- All queues
- Key Vault (soft-deleted for 90 days)
- All secrets

**⚠️ Warning**: This is permanent. Export any data you need first.

### Purge Key Vault (Optional)

If you want to reuse the Key Vault name immediately:

```bash
az keyvault purge --name kv-inspector-local-dg
```

---

## 🐛 Troubleshooting

### Issue: "Key Vault access denied"

**Symptom**: Backend throws `Azure.RequestFailedException: Forbidden`

**Solution**:
1. Verify RBAC role assignment:
   ```bash
   az role assignment list \
     --scope /subscriptions/$(az account show --query id --output tsv)/resourceGroups/rg-servicebus-inspector-local/providers/Microsoft.KeyVault/vaults/kv-inspector-local-dg \
     --query "[?roleDefinitionName=='Key Vault Secrets User']"
   ```
2. Check if your user has the role:
   ```bash
   USER_ID=$(az ad signed-in-user show --query id --output tsv)
   az role assignment list \
     --assignee $USER_ID \
     --scope /subscriptions/$(az account show --query id --output tsv)/resourceGroups/rg-servicebus-inspector-local/providers/Microsoft.KeyVault/vaults/kv-inspector-local-dg
   ```
3. Reassign role if missing:
   ```bash
   az role assignment create \
     --assignee $USER_ID \
     --role "Key Vault Secrets Officer" \
     --scope /subscriptions/$(az account show --query id --output tsv)/resourceGroups/rg-servicebus-inspector-local/providers/Microsoft.KeyVault/vaults/kv-inspector-local-dg
   ```
3. Re-login to Azure CLI:
   ```bash
   az logout
   az login
   ```

### Issue: "Service Bus namespace name already taken"

**Symptom**: `The namespace name is not available`

**Solution**: Change namespace name in script (line 11):
```bash
SERVICE_BUS_NAMESPACE="sb-inspector-local-<your-initials>"
```

### Issue: "DefaultAzureCredential failed to retrieve a token"

**Symptom**: Backend can't authenticate

**Solution**:
```bash
# Check if logged in
az account show

# If not, login
az login

# Verify correct subscription
az account list --output table
az account set --subscription "<your-subscription-id>"
```

### Issue: Backend crashes with "PlatformNotSupportedException"

**Symptom**: `System.PlatformNotSupportedException: System.Security.Cryptography.ProtectedData is only supported on Windows`

**Solution**: This is expected on macOS/Linux. The backend uses an in-memory token store as fallback (check logs for "Using in-memory token mapping"). This is fine for local dev but won't persist across restarts.

---

## 📊 Monitoring Costs

### View Current Month Costs

```bash
# Install cost management extension (first time only)
az extension add --name costmanagement

# View costs by resource group
az costmanagement query \
  --type ActualCost \
  --dataset-filter "{\"dimensions\":{\"name\":\"ResourceGroup\",\"operator\":\"In\",\"values\":[\"rg-servicebus-inspector-local\"]}}" \
  --timeframe MonthToDate
```

### Set Budget Alert

```bash
# Create budget alert at ₹1500/month
az consumption budget create \
  --budget-name sb-inspector-local-budget \
  --resource-group rg-servicebus-inspector-local \
  --amount 1500 \
  --category Cost \
  --time-grain Monthly \
  --start-date $(date -u +"%Y-%m-01T00:00:00Z") \
  --end-date "2025-12-31T23:59:59Z"
```

---

## 🔗 Related Documentation

- [Local Development Setup](local-development-setup.md) - Full setup guide with detailed explanations
- [Azure Portal Deployment Guide](azure-portal-deployment-guide.md) - Production deployment to Azure App Service
- [Security Guidance](security-guidance.md) - Best practices for securing the application
- [Architecture](architecture.txt) - System design and component interactions

---

## 📌 Quick Reference

| Component | Value |
|-----------|-------|
| **Resource Group** | `rg-servicebus-inspector-local` |
| **Service Bus Namespace** | `sb-inspector-local-dg` |
| **Queue** | `test-queue` |
| **Key Vault** | `kv-inspector-local-dg` |
| **Secret Name** | `ServiceBusConnectionString` |
| **Backend URL** | `https://localhost:7001` |
| **Frontend URL** | `http://localhost:5173` |
| **Health Check** | `https://localhost:7001/health` |

---

**Last Updated**: November 2025  
**Version**: 2.0 (Multi-Method Setup)  
**Tested On**: macOS 14 (Sonnet), .NET 9, Node.js 20  
**Security**: Azure Key Vault with RBAC (Microsoft Best Practices)  
**Setup Methods**: CLI Script, Portal UI, Manual CLI
