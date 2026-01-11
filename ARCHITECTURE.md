# Architecture Overview

## System Design

Service Bus Inspector follows a **Clean Architecture** approach with four independent, deployable layers.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                        (Next.js 14 + React)                     │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│         HTTP/REST            │           HTTP/REST               │
│              │               │               │                   │
│              ▼               │               ▼                   │
│    ┌─────────────────┐       │     ┌─────────────────┐          │
│    │     API Layer   │       │     │    AI Layer     │          │
│    │   (.NET 9.0)    │◄──────┼────►│   (FastAPI)     │          │
│    └────────┬────────┘       │     └────────┬────────┘          │
│             │                │              │                    │
│             ▼                │              ▼                    │
│    ┌─────────────────┐       │     ┌─────────────────┐          │
│    │  Service Bus    │       │     │   ML Models     │          │
│    │    (Azure)      │       │     │ (Scikit-learn)  │          │
│    └─────────────────┘       │     └─────────────────┘          │
│                              │                                   │
├──────────────────────────────┴───────────────────────────────────┤
│                      SHARED CONTRACTS                            │
│              (TypeScript / C# / Python types)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. UI Layer (`packages/ui`)

**Technology:** Next.js 14 App Router + React 18 + TypeScript

**Responsibilities:**
- User interface rendering
- Client-side state management
- API communication
- Real-time updates (SSE)

**Key Patterns:**
- Feature-Sliced Design
- Server Components (where possible)
- TanStack Query for server state
- Zustand for client state

**Structure:**
```
src/
├── app/              # Next.js routes
├── features/         # Feature modules
│   ├── messages/     # Message browsing
│   ├── anomalies/    # Anomaly detection views
│   └── namespaces/   # Namespace management
└── shared/           # Shared components & utilities
```

### 2. API Layer (`packages/api`)

**Technology:** .NET 9 Minimal APIs + Clean Architecture

**Responsibilities:**
- HTTP endpoint handling
- Authentication/Authorization
- Business logic orchestration
- Service Bus communication

**Key Patterns:**
- Clean Architecture (Core, Infrastructure, API)
- Repository Pattern
- Dependency Injection
- Result Pattern (no exceptions for flow control)

**Structure:**
```
ServiceBusInspector.Api/          # HTTP layer
├── Controllers/                   # Minimal API endpoints
├── Middleware/                    # Error handling, auth
└── Program.cs                     # Composition root

ServiceBusInspector.Core/          # Business logic
├── Entities/                      # Domain models
├── Interfaces/                    # Service contracts
├── Services/                      # Business logic
└── DTOs/                          # Data transfer objects

ServiceBusInspector.Infrastructure/  # External concerns
├── ServiceBus/                    # Azure SDK wrapper
├── AI/                            # AI service client
└── Cache/                         # Redis integration
```

### 3. AI Layer (`packages/ai`)

**Technology:** Python 3.11 + FastAPI + Scikit-learn

**Responsibilities:**
- Anomaly detection (ML)
- Pattern analysis
- Remediation suggestions
- Model training & versioning

**Key Patterns:**
- RESTful API design
- Pydantic for validation
- Background tasks for training
- Model versioning

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/detect` | POST | Analyze messages for anomalies |
| `/suggest` | POST | Get remediation suggestions |
| `/feedback` | POST | Submit feedback for model improvement |
| `/health` | GET | Health check |

**ML Approach:**
1. **Rule-based checks**: Delivery count, message age, DLQ status
2. **Statistical analysis**: Outlier detection (Isolation Forest)
3. **Pattern matching**: Unusual payload structures
4. **Feedback loop**: Weekly model retraining with user feedback

### 4. Shared Layer (`packages/shared`)

**Purpose:** Single source of truth for contracts

**Contents:**
- TypeScript types (for UI)
- C# DTOs (for API)
- Python Pydantic models (for AI)
- Utility functions

**Synchronization Strategy:**
1. OpenAPI spec as source of truth
2. TypeScript types generated from OpenAPI
3. C# DTOs auto-generated from OpenAPI
4. Python Pydantic models from OpenAPI
5. Git hooks validate sync on commit

## Communication Patterns

### UI ↔ API

```
UI (Next.js) ──── HTTP/REST ────► API (.NET)
                   │
                   ├── GET /api/entities
                   ├── GET /api/messages/{entity}
                   ├── POST /api/messages/{entity}/complete
                   └── POST /api/analyze
```

### API ↔ AI

```
API (.NET) ──── HTTP/REST ────► AI (FastAPI)
                   │
                   ├── POST /detect
                   ├── POST /suggest
                   └── POST /feedback
```

### Real-Time Updates

```
UI (Next.js) ←──── SSE ──────── API (.NET)
                   │
                   └── /api/stream/{entity}
                       ├── message events
                       ├── heartbeat events
                       └── error events
```

## Data Flow

### Message Analysis Flow

```
1. User selects queue in UI
2. UI calls GET /api/messages/{queue}
3. API peeks messages from Service Bus
4. API calls AI POST /detect with messages
5. AI analyzes and returns anomalies
6. API enriches response with AI insights
7. UI displays messages with anomaly indicators
```

### Remediation Flow

```
1. User clicks "Replay" on anomalous message
2. UI calls POST /api/messages/{queue}/replay
3. API validates session and permissions
4. API replays message to active queue
5. API records audit entry
6. UI shows success notification
7. Optional: UI submits feedback to AI
```

## Security Model

### Session Management
- Session tokens issued on /api/session/connect
- Tokens stored in memory (production: Redis)
- Connection strings never persisted
- Session TTL: 10-30 minutes (configurable)

### Request Flow
```
Request → CORS Check → Session Middleware → Business Logic
                            │
                            └── X-Session-Id header required
```

## Deployment Options

### Option 1: Monolith (Development/Small Scale)
```
All layers deployed as single unit
- Simple deployment
- Shared resources
- Cost-effective for small loads
```

### Option 2: Microservices (Production/Scale)
```
Each layer independently deployable
- Independent scaling
- Technology isolation
- Fault tolerance
```

### Recommended: Azure Container Apps
```
┌─────────────────────────────────────────┐
│           Azure Container Apps          │
├─────────────┬─────────────┬─────────────┤
│     UI      │     API     │     AI      │
│  (Replica)  │  (Replica)  │  (Replica)  │
├─────────────┴─────────────┴─────────────┤
│              Azure Redis                │
├─────────────────────────────────────────┤
│          Azure Service Bus              │
└─────────────────────────────────────────┘
```

## Scaling Considerations

| Layer | Scaling Strategy | Trigger |
|-------|------------------|---------|
| UI | Horizontal (replicas) | Request rate |
| API | Horizontal (replicas) | Request rate, CPU |
| AI | Horizontal (replicas) | Queue depth, CPU |

## Monitoring

- **Application Insights**: Tracing, metrics, logs
- **Prometheus**: AI service metrics
- **Health endpoints**: All services expose /health
