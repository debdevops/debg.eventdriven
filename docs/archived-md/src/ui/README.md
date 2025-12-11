# Service Bus Inspector - Frontend

React + TypeScript frontend for the Dynamic Azure Service Bus Inspector.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Installation

```bash
cd src/ui
npm install
```

## Development

```bash
npm run dev
```

The application will start at `http://localhost:5173`.

The Vite dev server is configured to proxy API requests to the backend at `http://localhost:5001` by default. You can override this by setting the `VITE_API_BASE_URL` environment variable:

```bash
VITE_API_BASE_URL=https://your-backend.azurewebsites.net npm run dev
```

## Building for Production

```bash
npm run build
```

The optimized production build will be created in the `dist/` directory.

## Project Structure

```
src/ui/
├── src/
│   ├── components/
│   │   ├── ConnectForm.tsx       # Session creation form
│   │   ├── EntityList.tsx        # Queue/topic selector
│   │   ├── StreamPanel.tsx       # Message streaming and management
│   │   └── JsonModal.tsx         # Message detail viewer
│   ├── hooks/
│   │   └── useSSE.ts             # Server-Sent Events hook
│   ├── utils/
│   │   ├── api.ts                # API client with axios
│   │   └── correlation.ts        # Correlation ID generation
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── vite.config.ts                # Vite build configuration
```

## Features

### Connection Management
- Connect to Service Bus namespace using Key Vault secret name
- Session-based authentication with 10-minute expiry
- Connection string never leaves the backend

### Entity Browsing
- List all queues and topics in the namespace
- Filter entities by name
- View entity metadata (message counts, dead-letter counts)

### Message Inspection
- **Peek Mode**: Preview messages without removing them
- **Receive Mode**: Lock messages and confirm receipt
- Real-time streaming via Server-Sent Events (SSE)
- Filter and sort messages by sequence number, ID, or enqueued time
- View full message details in JSON modal
- Download messages as JSON files

### Security
- Correlation IDs for distributed tracing
- No sensitive data stored in browser
- Session expiry enforcement

## API Integration

The frontend communicates with the backend API at these endpoints:

- `POST /api/namespace/connect` - Create session
- `GET /api/namespace/{sessionId}/entities` - List queues/topics
- `GET /api/stream/{sessionId}/{entityName}` - SSE message stream
- `POST /api/queue/{sessionId}/{entityName}/peek` - Peek messages
- `POST /api/queue/{sessionId}/{entityName}/receive` - Complete messages

## Deployment

### Azure Static Web Apps

```bash
npm run build

# Deploy using Azure CLI
az staticwebapp create \
  --name servicebus-inspector-ui \
  --resource-group <resource-group> \
  --source ./dist \
  --location eastus \
  --branch main \
  --app-location "/" \
  --output-location "dist"
```

### Azure Storage Static Website

```bash
npm run build

# Enable static website hosting
az storage blob service-properties update \
  --account-name <storage-account> \
  --static-website \
  --index-document index.html

# Upload files
az storage blob upload-batch \
  --account-name <storage-account> \
  --source ./dist \
  --destination '$web'
```

### Environment Variables for Production

When deploying to production, set the backend API URL:

```bash
# .env.production
VITE_API_BASE_URL=https://your-backend.azurewebsites.net
```

Then build:

```bash
npm run build
```

## Troubleshooting

### CORS Errors
Ensure the backend has CORS configured to allow requests from your frontend domain:

```csharp
// In Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://your-frontend-domain.azurewebsites.net")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
```

### SSE Connection Issues
- Verify the backend is running and accessible
- Check browser console for errors
- Ensure firewall/proxy allows SSE (EventSource) connections
- SSE automatically reconnects with exponential backoff

### Session Expiry
- Sessions expire after 10 minutes of inactivity
- The UI will show an error when the session expires
- Click "Disconnect" and reconnect to create a new session

## Development Tips

### Hot Module Replacement (HMR)
Vite provides instant HMR. Changes to components will reflect immediately without full page reload.

### Type Checking
```bash
npm run build  # TypeScript type checking is part of the build process
```

### Linting
```bash
npm run lint
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (14+)
- IE11: ❌ Not supported

## Performance Considerations

- Messages are rendered with virtualization for large lists
- SSE provides efficient real-time updates without polling
- Correlation IDs enable end-to-end tracing and performance monitoring

---

**Author**: Debasis Ghosh  
**Repository**: https://github.com/debdevops/debg.eventdriven
