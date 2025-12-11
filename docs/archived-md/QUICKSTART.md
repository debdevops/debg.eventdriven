# Quick Start Guide - 5 Minutes to Running

This is the fastest path to get the Service Bus Inspector running locally.

## Prerequisites (One-Time Setup)

```bash
# 1. Install .NET 9 SDK
# Download from: https://dotnet.microsoft.com/download/dotnet/9.0

# 2. Install Node.js 18+
# Download from: https://nodejs.org/

# 3. Install Azure CLI
brew install azure-cli

# 4. Login to Azure
az login
```

## Azure Setup (5 Minutes)

```bash
# Copy and paste this entire block into your terminal:

# Variables
RG="rg-servicebus-inspector"
LOCATION="eastus"
SB="sb-inspector-$(openssl rand -hex 4)"
KV="kv-inspector-$(openssl rand -hex 4)"
QUEUE="test-queue"

# Create resources
az group create --name $RG --location $LOCATION
az servicebus namespace create --resource-group $RG --name $SB --sku Standard
az servicebus queue create --resource-group $RG --namespace-name $SB --name $QUEUE

# Get connection string
SB_CONN=$(az servicebus namespace authorization-rule keys list \
  --resource-group $RG --namespace-name $SB \
  --name RootManageSharedAccessKey --query primaryConnectionString -o tsv)

# Create Key Vault and store secret
az keyvault create --name $KV --resource-group $RG --enable-rbac-authorization true
az keyvault secret set --vault-name $KV --name ServiceBusConnectionString --value "$SB_CONN"

# Grant yourself access
USER_ID=$(az ad signed-in-user show --query id -o tsv)
KV_SCOPE=$(az keyvault show --name $KV --query id -o tsv)
az role assignment create --role "Key Vault Secrets User" --assignee $USER_ID --scope $KV_SCOPE

# Save these values!
echo ""
echo "✅ Setup complete!"
echo "================================"
echo "Key Vault Name: $KV"
echo "Service Bus Namespace: $SB"
echo "Queue Name: $QUEUE"
echo "Connection String (for scripts): $SB_CONN"
echo "================================"
echo ""
echo "Save Key Vault Name for next step!"
```

## Run the Application (3 Terminals)

### Terminal 1: Backend

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/ServiceBusInspectorApi

# Set your Key Vault name from above
export KeyVaultName="<your-kv-name-from-above>"

# Run
dotnet restore
dotnet run

# Wait for: "Now listening on: https://localhost:7001"
```

### Terminal 2: Frontend

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui

# Install and run
npm install
npm run dev

# Wait for: "Local: http://localhost:5173"
```

### Terminal 3: Send Test Messages

```bash
cd /Users/debasisghosh/Github/debg.eventdriven/scripts

# Set connection string from above
export SERVICE_BUS_CONNECTION_STRING="<connection-string-from-above>"

# Install and send
npm install
node send-sample-messages.js test-queue 10

# You should see: "✅ Successfully sent 10 messages..."
```

## Test the UI

1. Open browser: **http://localhost:5173**
2. Enter secret name: **ServiceBusConnectionString**
3. Click **Connect**
4. Select **test-queue**
5. Click **Peek Mode** or **Receive Mode**
6. See your 10 test messages!

## Troubleshooting

**"Failed to create session"**
- Run `az login` again
- Verify Key Vault name is correct
- Check you have "Key Vault Secrets User" role

**"Failed to list entities"**
- Verify Service Bus connection string in Key Vault
- Check secret name is exactly: `ServiceBusConnectionString`

**Frontend won't connect**
- Ensure backend is running (check terminal 1)
- Verify backend shows: "Now listening on: https://localhost:7001"

**No messages in UI**
- Check terminal 3 completed successfully
- Try sending more messages: `node send-sample-messages.js test-queue 5`

## Clean Up (Optional)

```bash
# Delete everything
az group delete --name rg-servicebus-inspector --yes --no-wait

# This removes: Service Bus, Key Vault, and all data
```

## Next Steps

- Read **README.md** for detailed documentation
- Check **docs/architecture.txt** for system design
- Review **docs/security-guidance.md** before production deployment

---

**Total Setup Time**: ~5 minutes for Azure + 2 minutes for running locally  
**Need Help?** Check **PROJECT_SUMMARY.md** for detailed troubleshooting
