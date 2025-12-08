#!/bin/bash
cd "$(dirname "$0")/src/ServiceBusInspectorApi"
export ASPNETCORE_ENVIRONMENT=Development
echo "Starting backend on https://localhost:7001..."
dotnet run
