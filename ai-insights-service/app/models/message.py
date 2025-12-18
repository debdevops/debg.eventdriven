"""Service Bus message data models."""
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ServiceBusMessage(BaseModel):
    """Represents an Azure Service Bus message."""
    
    message_id: str = Field(..., description="Unique message identifier")
    event_type: str = Field(..., description="Type of event (e.g., PaymentProcessed)")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for related messages")
    timestamp: datetime = Field(..., description="Message timestamp")
    payload: Dict[str, Any] = Field(..., description="Message payload data")
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional message properties")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "msg-12345",
                "event_type": "PaymentProcessed",
                "correlation_id": "corr-abc-123",
                "timestamp": "2025-12-17T10:30:00Z",
                "payload": {
                    "transaction_id": "txn-789",
                    "amount": 99.99,
                    "currency": "USD",
                    "status": "completed"
                },
                "properties": {
                    "source": "payment-service",
                    "version": "1.0"
                }
            }
        }


class AnalyzeRequest(BaseModel):
    """Request model for message analysis."""
    
    messages: list[ServiceBusMessage] = Field(..., description="List of messages to analyze")
    
    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    {
                        "message_id": "msg-1",
                        "event_type": "PaymentProcessed",
                        "correlation_id": "corr-1",
                        "timestamp": "2025-12-17T10:00:00Z",
                        "payload": {"amount": 50.0, "currency": "USD"}
                    }
                ]
            }
        }
