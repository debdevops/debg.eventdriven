# AI Insights Service

**Intelligent message clustering and pattern detection for Azure Service Bus**

A standalone microservice providing AI-powered analysis of Service Bus messages using heuristic-based algorithms. Designed for Phase 1 integration with the Azure Service Bus Inspector.

## Features

- **Message Clustering**: Automatic grouping by event type and payload structure
- **Pattern Detection**: Identifies common fields and message patterns
- **Outlier Detection**: Flags anomalous messages with detailed reasoning
- **Correlation Grouping**: Groups related messages by correlation_id
- **Mock Data**: Built-in realistic Service Bus message dataset (28 messages)

## Technology Stack

- Python 3.11
- FastAPI
- Pydantic for data validation
- Heuristic-based clustering (no ML dependencies yet)

## Quick Start

### 1. Install Dependencies

```bash
cd ai-insights-service
pip install -r requirements.txt
```

### 2. Run the Service

```bash
uvicorn app.main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`

### 3. Test the API

**Interactive API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Quick Test (using built-in mock data):**

```bash
curl -X POST http://localhost:8000/api/analyze-mock
```

## API Endpoints

### `POST /api/analyze`
Analyze a list of Service Bus messages.

**Request Body:**
```json
{
  "messages": [
    {
      "message_id": "msg-001",
      "event_type": "PaymentProcessed",
      "correlation_id": "corr-123",
      "timestamp": "2025-12-17T10:00:00Z",
      "payload": {
        "transaction_id": "txn-1001",
        "amount": 149.99,
        "currency": "USD",
        "status": "completed"
      },
      "properties": {
        "source": "payment-service"
      }
    }
  ]
}
```

**Response:**
```json
{
  "total_messages": 28,
  "clusters": [
    {
      "cluster_id": "cluster-1",
      "cluster_name": "Payment Processing Events - Group 1",
      "message_count": 5,
      "event_types": ["PaymentProcessed"],
      "pattern_description": "Payment completion events (5 messages) with standard transaction flow",
      "common_fields": {
        "currency": "USD",
        "status": "completed"
      },
      "correlation_groups": [["msg-001", "msg-002"]],
      "sample_message_ids": ["msg-001", "msg-002", "msg-003"],
      "confidence": 0.85
    }
  ],
  "outliers": [
    {
      "message_id": "msg-022",
      "reason": "Validation failed: missing payment fields: amount, currency",
      "anomaly_score": 0.9
    }
  ],
  "summary": "Identified 8 distinct message patterns (22 messages clustered, 6 outliers detected)",
  "processing_time_ms": 12.45
}
```

### `GET /api/mock-data`
Retrieve the built-in mock dataset (28 messages with various event types and anomalies).

### `POST /api/analyze-mock`
Convenience endpoint that automatically analyzes the built-in mock dataset.

### `GET /health`
Health check endpoint.

## Message Event Types (Mock Data)

The mock dataset includes:
- **PaymentProcessed** (7 messages): Standard payment completions
- **OrderCreated** (5 messages): E-commerce order events
- **InventoryUpdated** (5 messages): Warehouse inventory changes
- **PaymentFailed** (3 messages): Failed payment attempts
- **OrderCancelled** (2 messages): Order cancellations with refunds
- **ShipmentDispatched** (2 messages): Shipping notifications
- **Anomalies** (4 messages): Malformed, missing fields, unknown types

## Clustering Logic

The service uses a multi-stage heuristic approach:

1. **Primary Clustering**: Groups messages by `event_type`
2. **Structure-Based Sub-clustering**: Analyzes payload field structure using Jaccard similarity
3. **Outlier Detection**: Validates required fields and detects anomalies:
   - Missing correlation IDs
   - Null/missing payload fields
   - Unknown event types
   - Unusually high values (e.g., payments > $5000)
   - Duplicate transaction flags
   - Low structural similarity (< 50%)
4. **Pattern Extraction**: Identifies common fields across cluster members
5. **Correlation Grouping**: Links messages sharing the same `correlation_id`

## Project Structure

```
ai-insights-service/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application
│   ├── models/
│   │   ├── __init__.py
│   │   ├── message.py             # Message data models
│   │   └── analysis.py            # Response models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── clustering.py          # Clustering algorithms
│   │   └── pattern_detection.py  # Pattern detection utilities
│   └── data/
│       ├── __init__.py
│       └── mock_messages.py       # Mock Service Bus messages
├── requirements.txt
└── README.md
```

## Design Decisions

- **No ML dependencies**: Uses deterministic heuristics for predictable, explainable results
- **Separation of concerns**: Clear boundaries between models, services, and API layers
- **Enterprise-ready structure**: Scalable architecture ready for future enhancements
- **UI-friendly responses**: Structured output designed for "AI Insights" panel integration
- **No external dependencies**: Operates entirely with mock data (no Azure SDK required for Phase 1)

## Future Enhancements (Not in Phase 1)

- OpenAI/Claude API integration for semantic analysis
- Embedding-based similarity clustering
- Time-series pattern detection
- Azure Service Bus direct integration
- Real-time streaming analysis
- ML-based anomaly detection models

## Development

**Run with auto-reload:**
```bash
uvicorn app.main:app --reload --port 8000
```

**Test with curl:**
```bash
# Analyze mock data
curl -X POST http://localhost:8000/api/analyze-mock | jq

# Get mock dataset
curl http://localhost:8000/api/mock-data | jq

# Custom analysis (replace with your messages)
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d @your-messages.json | jq
```

## Integration with Service Bus Inspector

This service is designed to be called from the main Inspector UI:

1. UI collects Service Bus messages
2. Sends batch to `/api/analyze` endpoint
3. Displays clustering results in "AI Insights" panel
4. Shows outliers with detailed reasoning
5. Visualizes correlation groups and patterns

**API contract is stable** and ready for UI integration.
