# Troubleshooting Guide

## Port Already in Use Error

If you see `Failed to bind to address https://127.0.0.1:7001: address already in use`:

### Solution 1: Use the start-all.sh script
```bash
./start-all.sh
```
The script now includes aggressive port cleanup.

### Solution 2: Manual cleanup
```bash
# Kill processes by port
lsof -ti :7001 | xargs kill -9
lsof -ti :5173 | xargs kill -9

# Wait and verify
sleep 2
lsof -i :7001
lsof -i :5173

# Then start
./start-all.sh
```

### Solution 3: Find and kill manually
```bash
# Find what's using port 7001
lsof -i :7001

# Kill by PID
kill -9 <PID>

# For port 5173
lsof -i :5173
kill -9 <PID>
```

## Environment Variable Not Set

If you see `KeyVaultName is required in configuration`:

```bash
# Always use the scripts, OR
cd src/ServiceBusInspectorApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

## Services Won't Start

```bash
# Full reset
pkill -9 -f "dotnet"
pkill -9 -f "node"
lsof -ti :7001 | xargs kill -9
lsof -ti :5173 | xargs kill -9
sleep 3

# Start fresh
./start-all.sh
```

## Checking Service Status

```bash
# See if services are running
ps aux | grep -E "dotnet run|node.*vite" | grep -v grep

# Check ports
lsof -i :7001
lsof -i :5173

# View logs
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
```

## Chatbox Not Showing Dropdown

Make sure you:
1. Connected to Service Bus namespace first
2. Wait for entities to load
3. Check browser console for errors

## Common Issues

### Issue: "Cannot connect to backend"
**Solution:** Check if backend is running on port 7001
```bash
lsof -i :7001
```

### Issue: "No topics/queues in dropdown"
**Solution:** 
1. Ensure you've connected to a namespace
2. Check that your Service Bus has queues/topics
3. Verify Key Vault secret is correct

### Issue: "Message send fails"
**Solution:**
1. Check backend logs: `tail -f /tmp/backend.log`
2. Verify Service Bus connection string has Send permissions
3. Ensure topic/queue name is correct

## Getting Help

1. Check logs: `/tmp/backend.log` and `/tmp/frontend.log`
2. Verify Azure authentication: `az account show`
3. Test Key Vault access: `az keyvault secret show --vault-name kv-inspector-local-dg --name ServiceBusConnectionString`
