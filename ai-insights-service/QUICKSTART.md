# AI Insights Service - Quick Reference

## Start the Service
```bash
cd ai-insights-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Test the Service
```bash
# Run validation tests
./test-service.sh

# Or manually test
curl -X POST http://localhost:8000/api/analyze-mock | jq
```

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/health` | GET | Detailed health status |
| `/api/analyze` | POST | Analyze custom messages |
| `/api/analyze-mock` | POST | Analyze built-in mock data |
| `/api/mock-data` | GET | Get mock dataset |
| `/docs` | GET | Interactive API documentation |

## Sample Response Structure

```json
{
  "total_messages": 28,
  "clusters": [
    {
      "cluster_id": "cluster-1",
      "cluster_name": "Payment Processing Events - Group 1",
      "message_count": 5,
      "event_types": ["PaymentProcessed"],
      "pattern_description": "Payment completion events...",
      "common_fields": {"currency": "USD", "status": "completed"},
      "correlation_groups": [["msg-001", "msg-002"]],
      "sample_message_ids": ["msg-001", "msg-002", "msg-003"],
      "confidence": 0.85
    }
  ],
  "outliers": [
    {
      "message_id": "msg-022",
      "reason": "Validation failed: missing payment fields",
      "anomaly_score": 0.9
    }
  ],
  "summary": "Identified 6 distinct message patterns (22 messages clustered, 6 outliers detected)",
  "processing_time_ms": 12.45
}
```

## Event Types in Mock Data

- **PaymentProcessed** (7): Standard completions
- **OrderCreated** (5): E-commerce orders
- **InventoryUpdated** (5): Warehouse changes
- **PaymentFailed** (3): Failed transactions
- **OrderCancelled** (2): Cancellations with refunds
- **ShipmentDispatched** (2): Shipping notifications
- **Anomalies** (4): Malformed/unknown types

## Clustering Logic

1. **Primary**: Group by event_type
2. **Sub-cluster**: Payload structure similarity (Jaccard)
3. **Outlier Detection**:
   - Missing required fields
   - Null values
   - Unknown event types
   - High amounts (>$5000)
   - Duplicate flags
   - Low similarity (<50%)
4. **Pattern Extraction**: Common fields across cluster
5. **Correlation**: Group by correlation_id

## Files Overview

```
app/
├── main.py                    # FastAPI app, endpoints
├── models/
│   ├── message.py             # ServiceBusMessage model
│   └── analysis.py            # Response models
├── services/
│   ├── clustering.py          # Clustering algorithms
│   └── pattern_detection.py  # Pattern utilities
└── data/
    └── mock_messages.py       # 28 mock messages
```

## Integration Points

**For Service Bus Inspector UI:**
1. Collect messages from Azure Service Bus
2. POST to `/api/analyze` with message array
3. Display clustering results in "AI Insights" panel
4. Show outliers with reasons
5. Visualize correlation groups

**API Contract**: Stable and ready for integration
