#!/bin/bash

# Service Bus Inspector - Start Both Services
echo "=========================================="
echo "Service Bus Inspector - Starting Services"
echo "=========================================="

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -9 -f "dotnet run" 2>/dev/null
pkill -9 -f "node.*vite" 2>/dev/null

# Force kill processes on ports
echo "Cleaning up ports 7001 and 5173..."
lsof -ti :7001 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Wait for ports to be released
sleep 3

# Verify ports are free
if lsof -i :7001 > /dev/null 2>&1; then
    echo "❌ Port 7001 is still in use. Forcing cleanup..."
    lsof -ti :7001 | xargs kill -9 2>/dev/null
    sleep 2
fi

if lsof -i :5173 > /dev/null 2>&1; then
    echo "❌ Port 5173 is still in use. Forcing cleanup..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo ""
echo "Starting Backend API..."
cd "$SCRIPT_DIR/src/ServiceBusInspectorApi"
export ASPNETCORE_ENVIRONMENT=Development
dotnet run > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend started successfully
if grep -q "Now listening on" /tmp/backend.log; then
    echo "✅ Backend started successfully on https://localhost:7001"
else
    echo "❌ Backend failed to start. Check /tmp/backend.log"
    cat /tmp/backend.log
    exit 1
fi

# Start frontend
echo ""
echo "Starting Frontend UI..."
cd "$SCRIPT_DIR/src/ui"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "Waiting for frontend to initialize..."
sleep 5

# Check if frontend started successfully
if grep -q "Local:" /tmp/frontend.log; then
    echo "✅ Frontend started successfully on http://localhost:5173"
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
echo "Frontend UI:  http://localhost:5173"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop services:"
echo "  pkill -f 'dotnet run'"
echo "  pkill -f 'node.*vite'"
echo "=========================================="
