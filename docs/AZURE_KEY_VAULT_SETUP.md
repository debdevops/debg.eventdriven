# 🚀 Azure Key Vault Setup Guide - Microsoft Best Practices

**Goal**: Create and configure Azure Key Vault for secure secret management in ASP.NET Core applications.

**Audience**: Developers setting up secure local development with Azure Key Vault
**Security Level**: Enterprise-grade with RBAC and modern authentication
**Date**: November 2025

---

## ⚡ Quick Start - Minimal Setup

**Want to get started immediately?** Use our automated script to create the minimal Azure resources needed to run the application locally.

### What Gets Created (Minimal Resources)

| Resource | Name | Purpose | Cost |
|----------|------|---------|------|
| **Resource Group** | `rg-servicebus-inspector-local` | Resource container | Free |
| **Service Bus** | `sb-inspector-local-dg` | Message broker | ₹500-700/month |
| **Queue** | `test-queue` | Test messages | Included |
| **Key Vault** | `kv-inspector-local-dg` | Secret storage | ₹350-400/month |
| **Secret** | `ServiceBusConnectionString` | Connection string | Free |
| | | **Total** | **₹850-1,100/month** |

### Automated Setup (Recommended)

#### Prerequisites
- ✅ Azure subscription with Contributor access
- ✅ Azure CLI installed (`az --version`)
- ✅ Logged in to Azure (`az login`)

#### Run the Setup Script

```bash
cd scripts
chmod +x setup-azure-minimal.sh
./setup-azure-minimal.sh
```

**Time**: 10-15 minutes (includes Azure provisioning)

The script automatically:
1. ✅ Creates resource group `rg-servicebus-inspector-local`
2. 🚌 Creates Service Bus namespace `sb-inspector-local-dg` (Standard tier)
3. 📥 Creates queue `test-queue` with dead-lettering
4. 🔐 Creates Key Vault `kv-inspector-local-dg` with RBAC
5. 🔑 Grants you "Key Vault Secrets User" role
6. 💾 Stores Service Bus connection string as `ServiceBusConnectionString` secret

### Manual Setup (If Script Fails)

If the automated script fails, follow the detailed manual steps in `docs/AZURE_MINIMAL_SETUP.md`.

### Local Configuration

After setup, update your backend config:

**`src/ServiceBusInspectorApi/appsettings.Development.json`:**
```json
{
  "KeyVaultName": "kv-inspector-local-dg",
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "SessionTimeoutMinutes": 10
}
```

### Test the Setup

#### Terminal 1: Backend
```bash
cd src/ServiceBusInspectorApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

#### Terminal 2: Frontend
```bash
cd src/ui
npm run dev
```

#### Terminal 3: Send Test Messages
```bash
cd scripts
npm install
node send-sample-messages.js test-queue 10
```

**Expected**: You can now connect to Service Bus through the UI and see messages!

---

## 📋 Prerequisites

- ✅ Azure subscription with Owner/Contributor access
- ✅ Azure account logged in to portal.azure.com
- ✅ Entra ID (Azure AD) user account
- ✅ Existing Service Bus namespace (for connection string)

---

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐
│  ASP.NET Core   │────▶│  Key Vault     │────▶│  Secrets    │
│  (localhost)    │    │  (Azure)       │    │  (Encrypted)│
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
2. Authenticates via Azure CLI (`az login`) or Visual Studio
3. Key Vault validates RBAC permissions
4. Returns encrypted secret value

---

## 1. 🏗️ Create Resource Group (Best Practice)

### Recommended Naming Convention

Use the format: `rg-<environment>-<application>-<region>`

**Examples:**
- `rg-sbx-dev-eastus` (Sandbox/Development)
- `rg-dev-myapp-eastus` (Development)
- `rg-stg-myapp-eastus` (Staging)
- `rg-prd-myapp-eastus` (Production)

### Step-by-Step Creation

1. Go to **portal.azure.com**
2. Search **"Resource groups"** → Click **+ Create**
3. **Basics** tab:
   - **Subscription**: Select your subscription
   - **Resource group**: `rg-sbx-dev-eastus`
   - **Region**: `East US` (recommended for development)
4. **Tags** tab (add these tags):
   - `Environment: Development`
   - `Application: ServiceBusInspector`
   - `Owner: YourName`
   - `CostCenter: IT-Dev`
   - `Project: EventDriven`
5. Click **Review + create** → **Create**

### Best Practices

- **Regions**: Use `East US` for development, match production regions for staging/prod
- **Tagging Strategy**:
  - `Environment`: dev/stg/prd
  - `Application`: descriptive name
  - `Owner`: team or individual responsible
  - `CostCenter`: for billing tracking
  - `Project`: overarching project name
- **Resource Group Isolation**: Keep related resources together for easier management and cleanup

---

## 2. 🔐 Create Azure Key Vault (Portal UI)

### Recommended Naming Convention

Use the format: `kv-<environment>-<application>-<unique>`

**Examples:**
- `kv-sbx-dev-servicebus-001`
- `kv-dev-myapp-secrets`
- `kv-prd-myapp-secrets`

### Step-by-Step Creation

1. Search **"Key Vault"** → Click **+ Create**
2. **Basics** tab:
   - **Subscription**: Your subscription
   - **Resource group**: `rg-sbx-dev-eastus`
   - **Key vault name**: `kv-sbx-dev-servicebus-001`
     - Must be globally unique (3-24 characters)
   - **Region**: `East US` (same as resource group)
   - **Pricing tier**: **Standard** (sufficient for development)
3. **Access configuration** tab:
   - **Permission model**: **Azure role-based access control (recommended)**
   - **Enable Azure Virtual Machines for deployment**: ❌ Unchecked (not needed for local dev)
   - **Enable Azure Resource Manager for template deployment**: ❌ Unchecked
4. **Networking** tab:
   - **Connectivity method**: **Public endpoint** (OK for development)
5. **Security** tab:
   - **Soft delete**: ✅ **Enabled** (recommended)
   - **Purge protection**: ✅ **Enabled** (recommended)
   - **Deployment**: ❌ Disabled (not needed)
6. Click **Review + create** → **Create**

### Security Best Practices Explained

#### RBAC Authorization (vs Access Policies)
- **RBAC**: Modern, Azure-wide permissions using roles
- **Access Policies**: Legacy, Key Vault-specific (deprecated for new vaults)
- **Why RBAC?**: Consistent with other Azure services, better audit logging

#### Soft Delete & Purge Protection
- **Soft Delete**: Deleted secrets are recoverable for 90 days
- **Purge Protection**: Prevents permanent deletion during retention period
- **Why?**: Protects against accidental deletion and ransomware attacks

#### Additional Best Practices
- **Never store secrets in code or UI**: Always use Key Vault references
- **Protect tenant/subscription boundaries**: Use separate vaults per environment
- **Regional proximity**: Keep Key Vault in same region as your application
- **Network security**: Use private endpoints in production

---

## 3. 👥 RBAC Permissions (IAM)

### Assign "Key Vault Secrets User" Role

This role allows reading secrets but not creating/modifying them - perfect for local development.

#### Step-by-Step Assignment

1. Go to your Key Vault: `kv-sbx-dev-servicebus-001`
2. Left menu → **Access control (IAM)**
3. Click **+ Add** → **Add role assignment**
4. **Role** tab:
   - **Job function roles**: Search for **"Key Vault Secrets User"**
   - Select **Key Vault Secrets User**
5. **Members** tab:
   - **Assign access to**: **User, group, or service principal**
   - Click **+ Select members**
   - Search for your Entra ID username/email
   - Select your account → Click **Select**
6. **Review + assign** tab:
   - Review the assignment
   - Click **Review + assign**

### Verification

- Go back to **Access control (IAM)** → **Role assignments**
- You should see your user with "Key Vault Secrets User" role

### Best Practices

- **Least Privilege**: Use minimal required permissions
- **Avoid Owner/Contributor**: These roles can modify/delete resources
- **User Assignment**: For local development only
- **Production**: Replace with Managed Identity or Service Principal
- **Regular Review**: Audit role assignments quarterly

---

## 4. 🔑 Create Secrets (Portal UI)

### Add Service Bus Connection String

1. In Key Vault → Left menu → **Secrets**
2. Click **+ Generate/Import**
3. **Create a secret** panel:
   - **Name**: `ServiceBusConnectionString`
   - **Secret value**: Paste your Service Bus connection string
     - Get this from: Service Bus → Shared access policies → RootManageSharedAccessKey → Primary Connection String
   - **Content type**: `text/plain`
   - **Enabled**: ✅ **Yes** (checked)
4. Click **Create**

### Verification

- Secret appears in the list with status "Enabled"
- Click on the secret to view details (but not the value)

### Best Practices

- **Descriptive Names**: Use `ServiceBusConnectionString` not `conn-string`
- **Versioning**: Key Vault automatically handles versions
- **Source Control**: Never commit connection strings to git
- **Secret Rotation**: Regularly rotate Service Bus keys and update Key Vault
- **Environment Separation**: Use different secrets per environment

---

## 5. 💻 Local Development (MacBook)

### Authentication Setup

Your ASP.NET Core app uses `DefaultAzureCredential` which tries multiple authentication methods in order:

1. **Azure CLI** (recommended for development)
2. **Visual Studio Code** (if signed in)
3. **Azure PowerShell**
4. **Interactive browser**

### Step-by-Step Setup

#### 1. Install Azure CLI

```bash
# On macOS with Homebrew
brew install azure-cli

# Verify installation
az --version
```

#### 2. Login to Azure

```bash
az login
```

This opens a browser window for authentication. Sign in with your Azure account.

#### 3. Verify Login

```bash
# Check your account
az account show

# List subscriptions
az account list --output table
```

#### 4. Set Active Subscription (if multiple)

```bash
az account set --subscription "Your Subscription Name"
```

### ASP.NET Core Configuration

#### appsettings.Development.json

```json
{
  "KeyVaultName": "kv-sbx-dev-servicebus-001",  // Or "kv-inspector-local-dg" for minimal setup
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

#### Program.cs Configuration

```csharp
// Add Azure Key Vault to configuration
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{builder.Configuration["KeyVaultName"]}.vault.azure.net/"),
    new DefaultAzureCredential());
```

#### Reading Secrets in Code

```csharp
// Inject IConfiguration
private readonly IConfiguration _configuration;

public MyService(IConfiguration configuration)
{
    _configuration = configuration;
}

// Read secret
var connectionString = _configuration["ServiceBusConnectionString"];
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `Azure.Identity.AuthenticationFailedException` | Run `az login` again |
| `Azure.Security.KeyVault.AccessDeniedException` | Check RBAC role assignment |
| `Azure.Security.KeyVault.SecretNotFoundException` | Verify secret name spelling |
| Certificate errors | Ensure system certificates are updated |

### Best Practices

- **Environment Variables**: Never hardcode Key Vault names
- **Error Handling**: Wrap Key Vault calls in try-catch
- **Caching**: Consider caching secrets to reduce API calls
- **Logging**: Don't log secret values (only names/keys)
- **CI/CD**: Use Service Principals or Managed Identity for pipelines

---

## 🧹 Cleanup (When Done)

### Delete Resources

1. Go to **Resource groups**
2. Select `rg-sbx-dev-eastus`
3. Click **Delete resource group**
4. Type `rg-sbx-dev-eastus` to confirm
5. Click **Delete**

**Note**: Soft delete protects Key Vault for 90 days.

### Permanent Deletion (if needed)

```bash
# List deleted vaults
az keyvault list-deleted

# Permanently delete (requires purge protection disabled first)
az keyvault purge --name kv-sbx-dev-servicebus-001 --location eastus
```

---

## 📚 Additional Resources

- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [DefaultAzureCredential](https://docs.microsoft.com/en-us/dotnet/api/azure.identity.defaultazurecredential)
- [RBAC for Key Vault](https://docs.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [Key Vault Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/general/best-practices)

---

**Ready?** Choose your path:
- **Quick Start**: Use the minimal setup script above for instant local development
- **Detailed Setup**: Follow the step-by-step guide below for production-ready configuration

Your ASP.NET Core app will securely access secrets via Key Vault using RBAC! 🔐

*Last updated: November 2025*
*Security: RBAC with DefaultAzureCredential*
*Options: Minimal setup (~₹850-1,100/month) or custom configuration*</content>
<filePath>/Users/debasisghosh/Github/debg.eventdriven/docs/AZURE_KEY_VAULT_SETUP.md