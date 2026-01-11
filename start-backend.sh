#!/bin/bash
cd "$(dirname "$0")/src/ServiceBusInspectorApi"
export ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_URLS="https://localhost:7001"
echo "Starting backend on https://localhost:7001..."
dotnet run
