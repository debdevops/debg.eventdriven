# Service Bus Inspector - Quick Start Guide

## Prerequisites

- .NET SDK 8.0+
- Node.js 18+
- Azure Service Bus connection string

## Starting the Application

### Option 1: Start Everything (Recommended)

```bash
./start-all.sh
```

This will:
1. Clean up any existing processes and ports
2. Start the backend API on `https://localhost:7001`
3. Start the frontend UI on `http://localhost:5174`
4. Display status and logs location

### Option 2: Start Services Separately

**Backend Only:**
```bash
./start-backend.sh
```

**Frontend Only:**
```bash
./start-frontend.sh
```

## Accessing the Application

1. Open your browser to: **http://localhost:5174**
2. Enter your Azure Service Bus connection string
3. Click "Connect"

## Service Endpoints

- **Frontend UI**: http://localhost:5174
- **Backend API**: https://localhost:7001
- **API Health**: https://localhost:7001/health

## Viewing Logs

```bash
# Backend logs
tail -f /tmp/backend.log

# Frontend logs
tail -f /tmp/frontend.log
```

## Stopping the Services

```bash
# Stop backend
pkill -f 'dotnet run'

# Stop frontend
pkill -f 'node.*vite'

# Stop all
pkill -f 'dotnet run' && pkill -f 'node.*vite'
```

## Manual Development Mode

If you prefer to run services manually in separate terminals:

**Terminal 1 - Backend:**
```bash
cd src/ServiceBusInspectorApi
export ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_URLS="https://localhost:7001"
dotnet run
```

**Terminal 2 - Frontend:**
```bash
cd packages/ui
npx vite
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Kill processes on port 7001 (backend)
lsof -ti :7001 | xargs kill -9

# Kill processes on port 5174 (frontend)
lsof -ti :5174 | xargs kill -9
```

### Frontend Build Errors

If the frontend fails to start:

```bash
cd packages/ui
npm install
npm run build
```

### Backend Certificate Errors

If you see HTTPS certificate warnings, you may need to trust the development certificate:

```bash
dotnet dev-certs https --trust
```

## Configuration

### Backend Configuration

Edit `src/ServiceBusInspectorApi/appsettings.Development.json`

### Frontend Configuration

Create `packages/ui/.env.local`:

```env
VITE_API_BASE_URL=https://localhost:7001
VITE_TEST_MODE=false
```

## Next Steps

After starting the application:

1. Navigate to http://localhost:5174
2. Paste your Service Bus connection string
3. Explore your queues, topics, and subscriptions
4. View messages, DLQ, and AI insights

## Support

For issues or questions, see:
- [Architecture Documentation](ARCHITECTURE.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Migration Map](MIGRATION_MAP.md)
