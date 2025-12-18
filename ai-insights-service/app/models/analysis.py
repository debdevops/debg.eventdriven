"""Analysis result data models."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OutlierDetail(BaseModel):
    """Details about an outlier message."""
    
    message_id: str = Field(..., description="ID of the outlier message")
    reason: str = Field(..., description="Why this message is considered an outlier")
    anomaly_score: float = Field(..., ge=0, le=1, description="Anomaly score (0=normal, 1=highly anomalous)")


class MessageCluster(BaseModel):
    """Represents a cluster of similar messages."""
    
    cluster_id: str = Field(..., description="Unique cluster identifier")
    cluster_name: str = Field(..., description="Human-readable cluster name")
    message_count: int = Field(..., ge=0, description="Number of messages in cluster")
    event_types: List[str] = Field(..., description="Event types found in this cluster")
    pattern_description: str = Field(..., description="Description of detected pattern")
    common_fields: Dict[str, Any] = Field(..., description="Fields common across all messages in cluster")
    correlation_groups: Optional[List[List[str]]] = Field(
        default=None, 
        description="Groups of message IDs correlated by correlation_id"
    )
    sample_message_ids: List[str] = Field(..., description="Sample message IDs from this cluster")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in cluster quality")


class AnalysisResponse(BaseModel):
    """Response model for message analysis."""
    
    total_messages: int = Field(..., ge=0, description="Total number of messages analyzed")
    clusters: List[MessageCluster] = Field(..., description="Detected message clusters")
    outliers: List[OutlierDetail] = Field(..., description="Detected outlier messages")
    summary: str = Field(..., description="High-level summary of findings")
    processing_time_ms: float = Field(..., ge=0, description="Processing time in milliseconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_messages": 25,
                "clusters": [
                    {
                        "cluster_id": "cluster-1",
                        "cluster_name": "Payment Processing Events",
                        "message_count": 10,
                        "event_types": ["PaymentProcessed"],
                        "pattern_description": "Standard payment completion events",
                        "common_fields": {
                            "currency": "USD",
                            "status": "completed"
                        },
                        "correlation_groups": [["msg-1", "msg-2"]],
                        "sample_message_ids": ["msg-1", "msg-2", "msg-3"],
                        "confidence": 0.95
                    }
                ],
                "outliers": [
                    {
                        "message_id": "msg-99",
                        "reason": "Missing required payload fields",
                        "anomaly_score": 0.85
                    }
                ],
                "summary": "Found 3 distinct patterns with 2 outliers",
                "processing_time_ms": 15.5
            }
        }
