# Local Development Guide

This guide covers setting up and running the Service Bus Inspector locally.

## Prerequisites

| Tool | Version | Required For |
|------|---------|--------------|
| Node.js | 20+ | UI, Build tools |
| PNPM | 9+ | Package management |
| .NET SDK | 9.0+ | API development |
| Python | 3.11+ | AI service |
| Docker | Latest | Containerized dev |

## Quick Start

### Option 1: Native Development

```bash
# 1. Clone and setup
git clone https://github.com/debdevops/debg.eventdriven.git
cd debg.eventdriven
./setup.sh

# 2. Start all services
pnpm dev
```

Services will be available at:
- **UI**: http://localhost:3000
- **API**: http://localhost:5000
- **AI**: http://localhost:8000

### Option 2: Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Service-Specific Setup

### UI (Next.js)

```bash
cd packages/ui

# Install dependencies (from root)
pnpm install

# Create .env.local
cp .env.example .env.local

# Start dev server
pnpm dev
```

**Environment Variables:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AI_URL=http://localhost:8000
```

### API (.NET)

```bash
cd packages/api

# Restore dependencies
dotnet restore

# Start dev server
dotnet run --project ServiceBusInspector.Api
```

**Configuration (appsettings.Development.json):**
```json
{
  "SessionTimeoutMinutes": 10,
  "AiServiceUrl": "http://localhost:8000"
}
```

### AI (Python)

```bash
cd packages/ai

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Start dev server
uvicorn src.api.main:app --reload --port 8000
```

## Testing with Azure Service Bus

### Create Azure Resources

1. Create a Service Bus namespace in Azure
2. Create a test queue (e.g., `test-queue`)
3. Get the connection string from "Shared access policies"

### Connect in UI

1. Open http://localhost:3000
2. Click "Connect Namespace"
3. Paste your connection string
4. Browse queues and messages

### Generate Test Data

Use the included script to send test messages:

```bash
cd scripts
npm install
node send-sample-messages.js --connection-string "YOUR_CONNECTION_STRING"
```

## Common Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### PNPM Installation Issues

```bash
# Clear cache
pnpm store prune

# Reinstall
rm -rf node_modules
pnpm install
```

### .NET Build Errors

```bash
# Clean and rebuild
dotnet clean
dotnet restore
dotnet build
```

### Python Import Errors

```bash
# Ensure virtual environment is activated
source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

## Development Tips

### Hot Reload

- **UI**: Automatic with Next.js
- **API**: Use `dotnet watch run`
- **AI**: Automatic with `--reload` flag

### Debugging

- **UI**: Browser DevTools + React DevTools
- **API**: Visual Studio or VS Code debugger
- **AI**: VS Code Python debugger

### API Testing

Use the Swagger UI at http://localhost:5000/swagger for API exploration.

## IDE Setup

### VS Code Extensions

- **UI**: ESLint, Prettier, Tailwind CSS IntelliSense
- **API**: C# Dev Kit, .NET Extension Pack
- **AI**: Python, Pylance, Black Formatter

### Recommended Settings

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "[csharp]": {
    "editor.defaultFormatter": "ms-dotnettools.csharp"
  }
}
```
