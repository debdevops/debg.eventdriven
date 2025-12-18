"""
FastAPI application for AI-powered Service Bus message analysis.

ARCHITECTURE OVERVIEW:
=====================
This service provides intelligent analysis of Azure Service Bus messages using
heuristic-based clustering and pattern detection algorithms. It is designed to
integrate with the Service Bus Inspector ASP.NET backend.

PRIMARY WORKFLOW:
  1. ASP.NET backend collects messages from Service Bus
  2. Backend sends batch (max 1000) to POST /api/analyze
  3. This service clusters messages by event type and payload structure
  4. Service detects patterns, common fields, and outliers
  5. Returns AnalysisResponse JSON for UI visualization

ENDPOINTS:
  - POST /api/analyze       → Primary endpoint for real Service Bus messages
  - POST /api/analyze-mock  → Testing endpoint with pre-built mock data
  - GET  /api/mock-data     → Returns mock message dataset for inspection
  - GET  /health            → Health check with component status

NO EXTERNAL DEPENDENCIES:
  - No Azure SDK (messages come via HTTP from ASP.NET backend)
  - No ML/embeddings (uses Jaccard similarity and heuristic rules)
  - Stateless, in-memory analysis (no database or caching)

CLUSTERING APPROACH:
  1. Group by event_type (PaymentProcessed, OrderCreated, etc.)
  2. Sub-cluster by payload structure similarity (Jaccard >= 0.7)
  3. Detect outliers via validation rules and structure divergence
  4. Extract common fields and correlation groups
  5. Calculate confidence scores for cluster quality
"""
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models.message import AnalyzeRequest
from app.models.analysis import AnalysisResponse
from app.services.clustering import MessageClusteringService
from app.data.mock_messages import get_mock_messages

app = FastAPI(
    title="AI Insights Service",
    description="Intelligent analysis and clustering for Azure Service Bus messages",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clustering_service = MessageClusteringService()


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "AI Insights Service",
        "status": "operational",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "components": {
            "clustering_service": "operational",
            "pattern_detection": "operational"
        }
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_messages(request: AnalyzeRequest):
    """
    **PRIMARY ENDPOINT FOR REAL SERVICE BUS MESSAGE ANALYSIS**
    
    Accepts a batch of Service Bus messages from the ASP.NET backend and returns
    AI-powered insights: clusters, patterns, outliers, and correlation analysis.
    
    This endpoint performs:
    - Message clustering by event type and structure similarity (Jaccard-based)
    - Pattern detection and common field extraction
    - Outlier and anomaly detection using heuristic rules
    - Correlation-based grouping by correlation_id
    
    **Input:** List of ServiceBusMessage objects with:
      - message_id, event_type, correlation_id (optional), timestamp, payload
    
    **Output:** AnalysisResponse with clusters, outliers, summary, processing time
    
    **Usage from ASP.NET backend:**
      POST /api/analyze
      Content-Type: application/json
      Body: { "messages": [{ "message_id": "...", "event_type": "...", ... }] }
    
    **Validation:**
      - Rejects empty message lists
      - Enforces max 1000 messages per request (prevents memory issues)
      - Validates all required fields via Pydantic models
    
    Returns detailed insights suitable for AI-powered UI panels.
    """
    
    start_time = time.time()
    
    try:
        # Enterprise validation: ensure we have messages to analyze
        if not request.messages:
            raise HTTPException(
                status_code=400, 
                detail="No messages provided for analysis. Expected 'messages' array with at least one ServiceBusMessage."
            )
        
        # Enterprise validation: prevent memory exhaustion from large batches
        # Note: ASP.NET backend should batch messages if queue has >1000 items
        if len(request.messages) > 1000:
            raise HTTPException(
                status_code=400, 
                detail=f"Too many messages ({len(request.messages)}). Maximum 1000 messages per request. "
                       f"Please batch your requests from the ASP.NET backend."
            )
        
        # Core analysis: apply heuristic clustering to incoming messages
        # This reuses the same logic for both mock and real input - no special handling needed
        clusters, outliers = clustering_service.cluster_messages(request.messages)
        
        # Calculate summary statistics for response
        total_clustered = sum(c.message_count for c in clusters)
        total_outliers = len(outliers)
        
        if clusters:
            summary = (
                f"Identified {len(clusters)} distinct message patterns "
                f"({total_clustered} messages clustered"
            )
            if outliers:
                summary += f", {total_outliers} outliers detected"
            summary += ")"
        elif outliers:
            summary = f"All {total_outliers} messages flagged as outliers or anomalies"
        else:
            summary = "No clear patterns detected in provided messages"
        
        processing_time = (time.time() - start_time) * 1000
        
        return AnalysisResponse(
            total_messages=len(request.messages),
            clusters=clusters,
            outliers=outliers,
            summary=summary,
            processing_time_ms=round(processing_time, 2)
        )
    
    except HTTPException:
        # Re-raise validation errors (400) without modification
        raise
    except ValueError as e:
        # Handle data validation errors (e.g., malformed timestamps, invalid enum values)
        raise HTTPException(
            status_code=422,
            detail=f"Invalid message data: {str(e)}. Check that all messages have valid event_type, timestamp, and payload fields."
        )
    except Exception as e:
        # Catch-all for unexpected errors during clustering/analysis
        # In production, log this to monitoring system (e.g., Application Insights)
        raise HTTPException(
            status_code=500,
            detail=f"Internal analysis error: {str(e)}. Please check message format and retry."
        )


@app.get("/api/mock-data")
async def get_mock_data():
    """
    **TESTING ENDPOINT: Get sample Service Bus messages for development/testing**
    
    Returns a realistic dataset of 28 pre-built messages including various event types
    and intentional anomalies for demonstration purposes.
    
    Use this endpoint to:
    - Test the frontend UI without needing a real Service Bus
    - Understand the expected message format
    - See examples of normal messages vs outliers
    
    **Note:** For production, use /api/analyze with real messages from ASP.NET backend.
    """
    messages = get_mock_messages()
    return {
        "message_count": len(messages),
        "messages": [msg.model_dump() for msg in messages],
        "event_types": list(set(m.event_type for m in messages))
    }


@app.post("/api/analyze-mock")
async def analyze_mock_messages():
    """
    **CONVENIENCE TESTING ENDPOINT: Analyze the built-in mock dataset**
    
    This endpoint:
    1. Loads the pre-built mock message dataset (28 messages)
    2. Calls the same analysis logic as /api/analyze
    3. Returns clustering results, patterns, and outliers
    
    Useful for:
    - Quick testing without constructing JSON payloads
    - Demonstrating the service capabilities
    - Validating that clustering logic works as expected
    
    **Important:** This uses identical analysis logic to /api/analyze.
    The only difference is the message source (mock data vs real input).
    """
    # Load mock messages and analyze them using the primary endpoint logic
    messages = get_mock_messages()
    request = AnalyzeRequest(messages=messages)
    return await analyze_messages(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
