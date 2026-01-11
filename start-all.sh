#!/bin/bash

# Service Bus Inspector - Start Both Services
echo "=========================================="
echo "Service Bus Inspector - Starting Services"
echo "=========================================="

echo "Cleaning up existing processes..."
pkill -9 -f "dotnet run" 2>/dev/null || true
pkill -9 -f "node.*vite" 2>/dev/null || true

echo "Cleaning up ports 7001, 5174 (avoiding macOS port 5000)..."
lsof -ti :7001 | xargs kill -9 2>/dev/null || true
lsof -ti :5174 | xargs kill -9 2>/dev/null || true

# Wait for ports to be released
sleep 3

# Verify ports are free
if lsof -i :7001 > /dev/null 2>&1; then
    echo "❌ Port 7001 is still in use. Forcing cleanup..."
    lsof -ti :7001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

if lsof -i :5174 > /dev/null 2>&1; then
    echo "❌ Port 5174 is still in use. Forcing cleanup..."
    lsof -ti :5174 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine backend project path (prefer /src over /api if present)
BACKEND_DIR=""
if [ -d "$SCRIPT_DIR/src/ServiceBusInspectorApi" ]; then
    BACKEND_DIR="$SCRIPT_DIR/src/ServiceBusInspectorApi"
elif [ -d "$SCRIPT_DIR/api/ServiceBusInspectorApi" ]; then
    BACKEND_DIR="$SCRIPT_DIR/api/ServiceBusInspectorApi"
else
    echo "❌ Could not find backend project directory."
    exit 1
fi

echo "\nStarting Backend API from $BACKEND_DIR..."
cd "$BACKEND_DIR"
export ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_URLS="https://localhost:7001"
dotnet run > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend started successfully
if grep -q "Now listening on.*:7001" /tmp/backend.log; then
    echo "✅ Backend started successfully on https://localhost:7001"
else
    echo "❌ Backend failed to start. Check /tmp/backend.log"
    cat /tmp/backend.log
    exit 1
fi

# Start frontend
echo ""
FRONTEND_DIR=""
if [ -d "$SCRIPT_DIR/packages/ui" ]; then
    FRONTEND_DIR="$SCRIPT_DIR/packages/ui"
elif [ -d "$SCRIPT_DIR/src/ui" ]; then
    FRONTEND_DIR="$SCRIPT_DIR/src/ui"
elif [ -d "$SCRIPT_DIR/ui" ]; then
    FRONTEND_DIR="$SCRIPT_DIR/ui"
else
    echo "❌ Could not find frontend directory."
    exit 1
fi

echo "Starting Frontend UI from $FRONTEND_DIR..."
cd "$FRONTEND_DIR"
PORT=5174 npx vite > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "Waiting for frontend to initialize..."
sleep 5

# Check if frontend started successfully
if grep -q "Local:" /tmp/frontend.log; then
    echo "✅ Frontend started successfully on http://localhost:5174"
else
    echo "❌ Frontend failed to start. Check /tmp/frontend.log"
    cat /tmp/frontend.log
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All Services Running!"
echo "=========================================="
echo "Backend API:  https://localhost:7001"
echo "Frontend UI:  http://localhost:5174"
echo ""
echo "📝 Next Steps:"
echo "1. Open: http://localhost:5174 in your browser"
echo "2. You will see a form to enter your Service Bus connection string"
echo "3. Paste your connection string (e.g., Endpoint=sb://...)"
echo "4. Click 'Connect'"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop services:"
echo "  pkill -f 'dotnet run'"
echo "  pkill -f 'node.*vite'"
echo "=========================================="
