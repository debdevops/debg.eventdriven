# Dynamic Azure Service Bus Inspector

A secure, real-time Azure Service Bus inspection tool that enables developers and operators to peek, receive, and audit messages without exposing connection strings to the client.

## Architecture

- **Frontend**: React + TypeScript (Vite) with Server-Sent Events (SSE)
- **Backend**: ASP.NET Core (.NET 9) Minimal API
- **Security**: Azure Key Vault + DefaultAzureCredential (Managed Identity in production)
- **Observability**: OpenTelemetry with Azure Monitor
- **Auditing**: File-based audit log (migration path to Cosmos DB provided)

## Key Features

- **Zero-Trust Security**: Connection strings never leave the backend; session-based access model
- **Peek vs Receive**: Preview messages without removing them, or receive with explicit confirmation
- **Real-time Streaming**: SSE-based message streaming with ephemeral token handling
- **Audit Trail**: All receive operations logged for compliance
- **Local Development**: Runs on macOS without Docker using `az login` credentials

## Prerequisites

### Local Development
- **.NET 9 SDK**: [Download](https://dotnet.microsoft.com/download/dotnet/9.0)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **Azure CLI**: `brew install azure-cli`
- **Azure Subscription**: With permissions to create Service Bus and Key Vault resources
- **Authenticated Azure CLI**: Run `az login` before starting

### Azure Resources Required
- Azure Service Bus namespace (Standard or Premium tier)
- Azure Key Vault
- (Optional) Application Insights for observability

## Azure Manual Provisioning

### Option 1: Azure Portal

#### 1. Create Service Bus Namespace
1. Navigate to **Azure Portal** → **Create a resource** → **Service Bus**
2. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `rg-servicebus-inspector` (or existing)
   - **Namespace name**: `sb-inspector-dev` (must be globally unique)
   - **Location**: `East US` (or preferred)
   - **Pricing tier**: `Standard` (required for topics)
3. Click **Review + Create** → **Create**
4. Once deployed, create a queue:
   - Navigate to namespace → **Queues** → **+ Queue**
   - **Name**: `test-queue`
   - Accept defaults → **Create**

#### 2. Create Key Vault
1. Navigate to **Create a resource** → **Key Vault**
2. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `rg-servicebus-inspector`
   - **Key vault name**: `kv-inspector-dev` (globally unique)
   - **Region**: `East US`
   - **Pricing tier**: `Standard`
3. Under **Access configuration**, ensure **Azure role-based access control (RBAC)** is enabled
4. Click **Review + Create** → **Create**

#### 3. Store Service Bus Connection String in Key Vault
1. Navigate to your Service Bus namespace → **Settings** → **Shared access policies** → **RootManageSharedAccessKey**
2. Copy the **Primary Connection String**
3. Navigate to your Key Vault → **Secrets** → **+ Generate/Import**
4. Fill in:
   - **Name**: `ServiceBusConnectionString`
   - **Value**: Paste the connection string
   - Click **Create**

#### 4. Grant Your User Access to Key Vault (Local Development)
1. Navigate to Key Vault → **Access control (IAM)** → **+ Add** → **Add role assignment**
2. Select **Key Vault Secrets User** role
3. Click **Next** → Select your user account
4. Click **Review + assign**

#### 5. (Optional) Create Application Insights
1. Navigate to **Create a resource** → **Application Insights**
2. Fill in details and create
3. Copy the **Connection String** from Overview page
4. Set as environment variable: `export APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>"`

### Option 2: Azure CLI

```bash
# Variables
RESOURCE_GROUP="rg-servicebus-inspector"
LOCATION="eastus"
SB_NAMESPACE="sb-inspector-dev-$(openssl rand -hex 4)"
KV_NAME="kv-inspector-$(openssl rand -hex 4)"
QUEUE_NAME="test-queue"

# Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Service Bus Namespace
az servicebus namespace create \
  --resource-group $RESOURCE_GROUP \
  --name $SB_NAMESPACE \
  --location $LOCATION \
  --sku Standard

# Create Queue
az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $SB_NAMESPACE \
  --name $QUEUE_NAME

# Get Service Bus Connection String
SB_CONN_STRING=$(az servicebus namespace authorization-rule keys list \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $SB_NAMESPACE \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString -o tsv)

# Create Key Vault
az keyvault create \
  --name $KV_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enable-rbac-authorization true

# Store connection string as secret
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "ServiceBusConnectionString" \
  --value "$SB_CONN_STRING"

# Grant yourself Key Vault Secrets User role
USER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
KV_SCOPE=$(az keyvault show --name $KV_NAME --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $USER_OBJECT_ID \
  --scope $KV_SCOPE

# (Optional) Create Application Insights
az monitor app-insights component create \
  --app ai-inspector-dev \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

echo "Setup complete!"
echo "Key Vault Name: $KV_NAME"
echo "Service Bus Namespace: $SB_NAMESPACE"
```

## Local Development Setup

### 1. Clone and Configure Backend

```bash
cd /Users/debasisghosh/Github/debg.eventdriven

# Set environment variables
export KeyVaultName="<your-keyvault-name>"  # e.g., kv-inspector-dev
export APPLICATIONINSIGHTS_CONNECTION_STRING="<optional-app-insights-connection-string>"

# Restore dependencies
cd src/RegistrationApi
dotnet restore

# Run backend
dotnet run
# Backend will start at https://localhost:7001 and http://localhost:5001
```

### 2. Configure and Run Frontend

```bash
# In a new terminal
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui

# Install dependencies
npm install

# Run frontend
npm run dev
# Frontend will start at http://localhost:5173
```

### 3. Authenticate with Azure

Ensure you're logged in to Azure CLI (required for DefaultAzureCredential):

```bash
az login
az account show  # Verify correct subscription
```

## Testing the Application

### 1. Send Sample Messages

Use the provided script to populate your Service Bus queue:

```bash
cd scripts

# Set your connection string
export SERVICE_BUS_CONNECTION_STRING="<your-sb-connection-string>"

# Send 10 sample messages
node send-sample-messages.js test-queue 10
```

### 2. Using the UI

1. Open browser to `http://localhost:5173`
2. In the Connect form, enter your Key Vault secret name: `ServiceBusConnectionString`
3. Click **Connect** (creates a 10-minute session)
4. Select your queue/topic from the entity list
5. Choose **Peek** or **Receive** mode:
   - **Peek**: Preview messages without removing them
   - **Receive**: Get messages with lock; must confirm to complete
6. View message details, filter, sort, and download as JSON

### 3. Running Tests

```bash
cd tests/ServiceBusInspectorApi.Tests
dotnet test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/namespace/connect` | Create session with Key Vault secret name |
| GET | `/api/namespace/{sessionId}/entities` | List queues and topics |
| GET | `/api/stream/{sessionId}/{entityName}` | SSE stream of messages (peek/receive) |
| POST | `/api/queue/{sessionId}/{entityName}/peek` | Peek messages immediately |
| POST | `/api/queue/{sessionId}/{entityName}/receive` | Complete received messages |

## Deployment to Azure App Service

### 1. Create App Service with Managed Identity

```bash
APP_NAME="app-servicebus-inspector"
APP_PLAN="plan-inspector"

# Create App Service Plan
az appservice plan create \
  --name $APP_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_PLAN \
  --runtime "DOTNET|9.0"

# Enable System-Assigned Managed Identity
az webapp identity assign \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Get the managed identity principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant Managed Identity access to Key Vault
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $PRINCIPAL_ID \
  --scope $KV_SCOPE
```

### 2. Configure App Settings

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    KeyVaultName="$KV_NAME" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="<your-app-insights-conn-string>"
```

### 3. Deploy Backend

```bash
cd src/RegistrationApi
dotnet publish -c Release -o ./publish

cd publish
zip -r ../app.zip .

az webapp deploy \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src-path ../app.zip
```

### 4. Deploy Frontend

Build frontend with backend URL and deploy to Azure Static Web Apps or Storage Account static website.

```bash
cd src/ui
VITE_API_BASE_URL="https://$APP_NAME.azurewebsites.net" npm run build
# Upload dist/ folder to your static hosting
```

## Security Considerations

- **Never commit connection strings**: Use Key Vault for all secrets
- **Audit all operations**: Review `src/ServiceBusInspectorApi/data/audit.log` regularly
- **Session expiry**: Sessions expire after 10 minutes; implement Redis for production
- **RBAC**: Use least-privilege access; grant only necessary roles
- **Private Endpoints**: Enable for Key Vault and Service Bus in production
- **CORS**: Configure allowed origins in production appsettings

See [docs/security-guidance.md](docs/security-guidance.md) for detailed security recommendations.

## Architecture

See [docs/architecture.txt](docs/architecture.txt) for detailed architecture diagrams and flow descriptions.

## Project Structure

```
debg.eventdriven/
├── src/
│   ├── ServiceBusInspectorApi/   # .NET 9 Backend API
│   │   ├── Services/              # Business logic services
│   │   ├── Streams/               # SSE streaming
│   │   ├── Models/                # Data models
│   │   ├── data/                  # Audit log storage
│   │   └── Program.cs             # Minimal API endpoints
│   └── ui/                        # React TypeScript Frontend
│       └── src/
│           ├── components/        # React components
│           ├── hooks/             # Custom hooks (SSE)
│           └── utils/             # API client, correlation
├── scripts/                       # Testing scripts
├── docs/                          # Architecture & guides
└── tests/                         # Unit tests

```

## Roadmap

- [ ] Migrate audit store to Cosmos DB
- [ ] Add Redis for distributed session management
- [ ] Implement dead-letter queue inspection
- [ ] Add message replay functionality
- [ ] AI-powered message pattern analysis
- [ ] Support for Event Hubs

## Contributing

This is a personal project. Issues and pull requests are welcome.

## License

MIT License - See LICENSE file for details

## Learn More

- [LinkedIn Article](docs/linkedin-article-outline.md): Deep dive into the architecture
- [Security Guidance](docs/security-guidance.md): Production hardening checklist
- [Architecture Docs](docs/architecture.txt): System design and flows

---

**Author**: Debasis Ghosh  
**Repository**: https://github.com/debdevops/debg.eventdriven  
**Branch**: dg-local-111425
