#!/bin/bash
# Script to purge all soft-deleted Key Vaults
# WARNING: This permanently deletes the vaults - they cannot be recovered!

echo "Purging soft-deleted Key Vaults..."
echo "This action cannot be undone!"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to permanently delete all soft-deleted Key Vaults? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    echo "Operation cancelled."
    exit 1
fi

# Purge each soft-deleted vault
echo "Purging kv-inspector-local-dg1..."
az keyvault purge --name kv-inspector-local-dg1 --location eastus

echo "Purging kv-inspector-eastus-dg..."
az keyvault purge --name kv-inspector-eastus-dg --location eastus

echo "Purging kv-inspector-local-dg..."
az keyvault purge --name kv-inspector-local-dg --location eastus

echo ""
echo "✅ All soft-deleted Key Vaults have been purged."
echo "You can now reuse these names for new Key Vaults."
