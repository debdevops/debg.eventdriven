#!/bin/bash

# ============================================
# Azure Service Bus Inspector - Minimal PaaS Setup
# ============================================
# Creates the bare minimum Azure resources needed for local development
# Cost: ~₹850-1,100/month (Service Bus Standard + Key Vault)
# Time: 10-15 minutes
# ============================================

set -e  # Exit on any error

# ============================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================
LOCATION="centralindia"                                    # or "eastus"
RESOURCE_GROUP="rg-servicebus-inspector-local"
SERVICE_BUS_NAMESPACE="sb-inspector-local-dg"              # Must be globally unique
KEY_VAULT_NAME="kv-inspector-local-dg"                     # Must be globally unique (3-24 chars)
MANAGED_IDENTITY_NAME="mi-servicebus-inspector-local"      # User Assigned Managed Identity
QUEUE_NAME="test-queue"
SECRET_NAME="ServiceBusConnectionString"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================"
echo "Azure Service Bus Inspector Setup"
echo -e "======================================${NC}\n"

# ============================================
# 1. Verify Azure CLI Login
# ============================================
echo -e "${YELLOW}[1/7] Verifying Azure CLI authentication...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}❌ Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

CURRENT_USER=$(az account show --query user.name --output tsv)
SUBSCRIPTION_NAME=$(az account show --query name --output tsv)
echo -e "${GREEN}✅ Logged in as: $CURRENT_USER${NC}"
echo -e "${GREEN}✅ Subscription: $SUBSCRIPTION_NAME${NC}\n"

# ============================================
# 2. Create Resource Group
# ============================================
echo -e "${YELLOW}[2/7] Creating Resource Group...${NC}"
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✅ Resource group '$RESOURCE_GROUP' already exists${NC}\n"
else
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    echo -e "${GREEN}✅ Created resource group: $RESOURCE_GROUP${NC}\n"
fi

# ============================================
# 3. Create Service Bus Namespace
# ============================================
echo -e "${YELLOW}[3/7] Creating Service Bus Namespace (Standard tier)...${NC}"
if az servicebus namespace show --name "$SERVICE_BUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✅ Service Bus namespace '$SERVICE_BUS_NAMESPACE' already exists${NC}\n"
else
    az servicebus namespace create \
        --name "$SERVICE_BUS_NAMESPACE" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Standard \
        --output none
    
    echo "⏳ Waiting for namespace provisioning (60 seconds)..."
    sleep 60
    echo -e "${GREEN}✅ Created Service Bus namespace: $SERVICE_BUS_NAMESPACE${NC}\n"
fi

# ============================================
# 4. Create Test Queue
# ============================================
echo -e "${YELLOW}[4/7] Creating test queue...${NC}"
if az servicebus queue show --name "$QUEUE_NAME" --namespace-name "$SERVICE_BUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✅ Queue '$QUEUE_NAME' already exists${NC}\n"
else
    az servicebus queue create \
        --name "$QUEUE_NAME" \
        --namespace-name "$SERVICE_BUS_NAMESPACE" \
        --resource-group "$RESOURCE_GROUP" \
        --enable-dead-lettering-on-message-expiration true \
        --default-message-time-to-live P14D \
        --lock-duration PT30S \
        --max-size 1024 \
        --output none
    echo -e "${GREEN}✅ Created queue: $QUEUE_NAME${NC}\n"
fi

# ============================================
# 5. Create User Assigned Managed Identity
# ============================================
echo -e "${YELLOW}[5/7] Creating User Assigned Managed Identity...${NC}"
if az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✅ Managed Identity '$MANAGED_IDENTITY_NAME' already exists${NC}"
    MANAGED_IDENTITY_PRINCIPAL_ID=$(az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query principalId --output tsv)
    MANAGED_IDENTITY_CLIENT_ID=$(az identity show --name "$MANAGED_IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query clientId --output tsv)
else
    MANAGED_IDENTITY_OUTPUT=$(az identity create \
        --name "$MANAGED_IDENTITY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output json)
    
    MANAGED_IDENTITY_PRINCIPAL_ID=$(echo "$MANAGED_IDENTITY_OUTPUT" | jq -r '.principalId')
    MANAGED_IDENTITY_CLIENT_ID=$(echo "$MANAGED_IDENTITY_OUTPUT" | jq -r '.clientId')
    echo -e "${GREEN}✅ Created Managed Identity: $MANAGED_IDENTITY_NAME${NC}"
    echo -e "${GREEN}   Principal ID: $MANAGED_IDENTITY_PRINCIPAL_ID${NC}"
    echo -e "${GREEN}   Client ID: $MANAGED_IDENTITY_CLIENT_ID${NC}"
fi

# ============================================
# 6. Create Key Vault with Access Policies
# ============================================
echo -e "${YELLOW}[6/7] Creating Key Vault with Managed Identity access...${NC}"
if az keyvault show --name "$KEY_VAULT_NAME" &>/dev/null; then
    echo -e "${GREEN}✅ Key Vault '$KEY_VAULT_NAME' already exists${NC}"
    VAULT_ID=$(az keyvault show --name "$KEY_VAULT_NAME" --query id --output tsv)
else
    VAULT_ID=$(az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --enabled-for-deployment true \
        --enabled-for-template-deployment true \
        --query id \
        --output tsv)
    echo -e "${GREEN}✅ Created Key Vault: $KEY_VAULT_NAME${NC}"
fi

# ============================================
# 7. Configure Key Vault Access Policies for Managed Identity
# ============================================
echo -e "\n${YELLOW}[7/7] Configuring Key Vault access policies for Managed Identity...${NC}"

# Set access policy for the Managed Identity (Secrets: Get, List)
echo "⏳ Setting access policy for Managed Identity..."
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --object-id "$MANAGED_IDENTITY_PRINCIPAL_ID" \
    --secret-permissions get list \
    --output none

echo -e "${GREEN}✅ Granted 'get' and 'list' secret permissions to Managed Identity${NC}"

# Also grant yourself access for setup purposes (you can remove this later)
USER_OBJECT_ID=$(az ad signed-in-user show --query id --output tsv)
echo "⏳ Granting temporary access to you for setup..."
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --object-id "$USER_OBJECT_ID" \
    --secret-permissions get list set delete \
    --output none 2>/dev/null || echo "   (Policy may already be set)"

echo -e "${GREEN}✅ Granted temporary setup permissions to your account${NC}"

# ============================================
# 6. Create Key Vault with RBAC
# ============================================
echo -e "${YELLOW}[6/7] Creating Key Vault (RBAC mode)...${NC}"
if az keyvault show --name "$KEY_VAULT_NAME" &>/dev/null; then
    echo -e "${GREEN}✅ Key Vault '$KEY_VAULT_NAME' already exists${NC}"
    VAULT_ID=$(az keyvault show --name "$KEY_VAULT_NAME" --query id --output tsv)
else
    VAULT_ID=$(az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --enable-rbac-authorization true \
        --query id \
        --output tsv)
    echo -e "${GREEN}✅ Created Key Vault: $KEY_VAULT_NAME${NC}"
fi

# Get current user object ID
USER_OBJECT_ID=$(az ad signed-in-user show --query id --output tsv)

# ============================================
# 7. Grant RBAC Permissions
# ============================================
echo -e "\n${YELLOW}[7/7] Configuring RBAC permissions...${NC}"

# Grant "Key Vault Secrets Officer" role (for creating/managing secrets)
echo "⏳ Granting 'Key Vault Secrets Officer' role..."
az role assignment create \
    --role "Key Vault Secrets Officer" \
    --assignee "$USER_OBJECT_ID" \
    --scope "$VAULT_ID" \
    --output none 2>/dev/null || echo "   (Role may already be assigned)"

# Grant "Key Vault Secrets Officer" role (for creating and reading secrets - needed for setup)
echo "⏳ Granting 'Key Vault Secrets Officer' role..."
az role assignment create \
    --role "Key Vault Secrets Officer" \
    --assignee "$USER_OBJECT_ID" \
    --scope "$VAULT_ID" \
    --output none 2>/dev/null || echo "   (Role may already be assigned)"

echo "⏳ Waiting for RBAC propagation (30 seconds)..."
sleep 30

# ============================================
# 8. Store Connection String in Key Vault
# ============================================
echo -e "\n${YELLOW}Storing Service Bus connection string in Key Vault...${NC}"
az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "$SECRET_NAME" \
    --value "$CONNECTION_STRING" \
    --output none

echo -e "${GREEN}✅ Secret '$SECRET_NAME' stored successfully${NC}\n"

# ============================================
# SUMMARY
# ============================================
echo -e "${GREEN}======================================"
echo "✅ Setup Complete!"
echo -e "======================================${NC}\n"

echo "📋 Created Resources:"
echo "   • Resource Group:     $RESOURCE_GROUP"
echo "   • Service Bus:        $SERVICE_BUS_NAMESPACE"
echo "   • Queue:              $QUEUE_NAME"
echo "   • Managed Identity:   $MANAGED_IDENTITY_NAME"
echo "   • Key Vault:          $KEY_VAULT_NAME"
echo "   • Secret:             $SECRET_NAME"
echo ""

echo "🔐 Authentication Method:"
echo "   • User Assigned Managed Identity: $MANAGED_IDENTITY_NAME"
echo "   • Principal ID: $MANAGED_IDENTITY_PRINCIPAL_ID"
echo "   • Client ID: $MANAGED_IDENTITY_CLIENT_ID"
echo ""

echo "💰 Estimated Cost:"
echo "   • Service Bus (Standard): ~₹500-700/month"
echo "   • Key Vault (Standard):   ~₹350-400/month"
echo "   • Total:                  ~₹850-1,100/month"
echo ""

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo ""
echo "1. For LOCAL development (current setup):"
echo "   - Keep using 'az login' credentials"
echo "   - The script granted you temporary access"
echo ""
echo "2. For AZURE deployment:"
echo "   - Assign the Managed Identity to your App Service"
echo "   - Update appsettings.json to use Managed Identity"
echo "   - Remove temporary user access policy:"
echo "     az keyvault delete-policy --name $KEY_VAULT_NAME --object-id $USER_OBJECT_ID"
echo ""
echo "3. Update appsettings.Development.json:"
echo "   {\"KeyVaultName\": \"$KEY_VAULT_NAME\"}"
echo ""
echo "4. Run the backend:"
echo "   cd src/RegistrationApi"
echo "   export ASPNETCORE_ENVIRONMENT=Development"
echo "   dotnet run"
echo ""
echo "5. Run the frontend:"
echo "   cd src/ui"
echo "   npm run dev"
echo ""
echo "6. Send test messages:"
echo "   cd scripts"
echo "   npm install"
echo "   node send-sample-messages.js $QUEUE_NAME 10"
echo ""

echo -e "${GREEN}🎉 Your minimal Azure environment is ready!${NC}\n"

# ============================================
# Verification Commands
# ============================================
echo -e "${YELLOW}🔍 Verification Commands:${NC}"
echo ""
echo "# Check Managed Identity:"
echo "az identity show --name $MANAGED_IDENTITY_NAME --resource-group $RESOURCE_GROUP --output table"
echo ""
echo "# Check Key Vault access policies:"
echo "az keyvault show --name $KEY_VAULT_NAME --output table"
echo "az keyvault list --query \"[?name=='$KEY_VAULT_NAME'].{Name:name, AccessPolicies:properties.accessPolicies}\" --output table"
echo ""
echo "# Check Service Bus namespace:"
echo "az servicebus namespace show --name $SERVICE_BUS_NAMESPACE --resource-group $RESOURCE_GROUP"
echo ""
echo "# List queues:"
echo "az servicebus queue list --namespace-name $SERVICE_BUS_NAMESPACE --resource-group $RESOURCE_GROUP --output table"
echo ""
echo "# List secrets:"
echo "az keyvault secret list --vault-name $KEY_VAULT_NAME --output table"
echo ""
echo "# Test secret retrieval:"
echo "az keyvault secret show --vault-name $KEY_VAULT_NAME --name $SECRET_NAME --query value --output tsv"
echo ""
