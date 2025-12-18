"""Mock Service Bus messages for testing and development."""
from datetime import datetime, timedelta
from app.models.message import ServiceBusMessage


def get_mock_messages() -> list[ServiceBusMessage]:
    """Generate realistic mock Service Bus messages with various event types and anomalies."""
    
    base_time = datetime(2025, 12, 17, 10, 0, 0)
    messages = []
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-001",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-001",
            timestamp=base_time,
            payload={
                "transaction_id": "txn-1001",
                "amount": 149.99,
                "currency": "USD",
                "status": "completed",
                "payment_method": "credit_card",
                "merchant_id": "merch-500"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-002",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-001",
            timestamp=base_time + timedelta(seconds=2),
            payload={
                "transaction_id": "txn-1002",
                "amount": 149.99,
                "currency": "USD",
                "status": "completed",
                "payment_method": "credit_card",
                "merchant_id": "merch-500"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-003",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-002",
            timestamp=base_time + timedelta(minutes=5),
            payload={
                "transaction_id": "txn-1003",
                "amount": 299.50,
                "currency": "USD",
                "status": "completed",
                "payment_method": "paypal",
                "merchant_id": "merch-501"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-004",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-003",
            timestamp=base_time + timedelta(minutes=8),
            payload={
                "transaction_id": "txn-1004",
                "amount": 49.99,
                "currency": "USD",
                "status": "completed",
                "payment_method": "debit_card",
                "merchant_id": "merch-500"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-005",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-004",
            timestamp=base_time + timedelta(minutes=12),
            payload={
                "transaction_id": "txn-1005",
                "amount": 199.00,
                "currency": "EUR",
                "status": "completed",
                "payment_method": "credit_card",
                "merchant_id": "merch-502"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-006",
            event_type="OrderCreated",
            correlation_id="corr-order-100",
            timestamp=base_time + timedelta(minutes=1),
            payload={
                "order_id": "ord-2001",
                "customer_id": "cust-5000",
                "total_amount": 149.99,
                "currency": "USD",
                "items_count": 3,
                "shipping_address": {
                    "country": "US",
                    "zip": "10001"
                }
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
        ServiceBusMessage(
            message_id="msg-007",
            event_type="OrderCreated",
            correlation_id="corr-order-101",
            timestamp=base_time + timedelta(minutes=6),
            payload={
                "order_id": "ord-2002",
                "customer_id": "cust-5001",
                "total_amount": 299.50,
                "currency": "USD",
                "items_count": 5,
                "shipping_address": {
                    "country": "US",
                    "zip": "90210"
                }
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
        ServiceBusMessage(
            message_id="msg-008",
            event_type="OrderCreated",
            correlation_id="corr-order-102",
            timestamp=base_time + timedelta(minutes=10),
            payload={
                "order_id": "ord-2003",
                "customer_id": "cust-5002",
                "total_amount": 49.99,
                "currency": "USD",
                "items_count": 1,
                "shipping_address": {
                    "country": "US",
                    "zip": "60601"
                }
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
        ServiceBusMessage(
            message_id="msg-009",
            event_type="OrderCreated",
            correlation_id="corr-order-103",
            timestamp=base_time + timedelta(minutes=15),
            payload={
                "order_id": "ord-2004",
                "customer_id": "cust-5003",
                "total_amount": 599.00,
                "currency": "USD",
                "items_count": 7,
                "shipping_address": {
                    "country": "CA",
                    "zip": "M5H2N2"
                }
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-010",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-200",
            timestamp=base_time + timedelta(minutes=3),
            payload={
                "sku": "PROD-1000",
                "warehouse_id": "WH-EAST",
                "quantity_change": -3,
                "new_quantity": 147,
                "reason": "order_fulfillment"
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
        ServiceBusMessage(
            message_id="msg-011",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-201",
            timestamp=base_time + timedelta(minutes=7),
            payload={
                "sku": "PROD-2000",
                "warehouse_id": "WH-WEST",
                "quantity_change": -5,
                "new_quantity": 82,
                "reason": "order_fulfillment"
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
        ServiceBusMessage(
            message_id="msg-012",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-202",
            timestamp=base_time + timedelta(minutes=11),
            payload={
                "sku": "PROD-1000",
                "warehouse_id": "WH-CENTRAL",
                "quantity_change": 50,
                "new_quantity": 250,
                "reason": "restock"
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
        ServiceBusMessage(
            message_id="msg-013",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-203",
            timestamp=base_time + timedelta(minutes=14),
            payload={
                "sku": "PROD-3000",
                "warehouse_id": "WH-EAST",
                "quantity_change": -1,
                "new_quantity": 15,
                "reason": "order_fulfillment"
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
        ServiceBusMessage(
            message_id="msg-014",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-204",
            timestamp=base_time + timedelta(minutes=18),
            payload={
                "sku": "PROD-4000",
                "warehouse_id": "WH-WEST",
                "quantity_change": -7,
                "new_quantity": 43,
                "reason": "order_fulfillment"
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-015",
            event_type="PaymentFailed",
            correlation_id="corr-payment-fail-001",
            timestamp=base_time + timedelta(minutes=4),
            payload={
                "transaction_id": "txn-9001",
                "amount": 89.99,
                "currency": "USD",
                "status": "failed",
                "error_code": "INSUFFICIENT_FUNDS",
                "payment_method": "credit_card"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-016",
            event_type="PaymentFailed",
            correlation_id="corr-payment-fail-002",
            timestamp=base_time + timedelta(minutes=9),
            payload={
                "transaction_id": "txn-9002",
                "amount": 299.00,
                "currency": "USD",
                "status": "failed",
                "error_code": "CARD_EXPIRED",
                "payment_method": "credit_card"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-017",
            event_type="PaymentFailed",
            correlation_id="corr-payment-fail-003",
            timestamp=base_time + timedelta(minutes=16),
            payload={
                "transaction_id": "txn-9003",
                "amount": 49.50,
                "currency": "USD",
                "status": "failed",
                "error_code": "FRAUD_SUSPECTED",
                "payment_method": "paypal"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-018",
            event_type="OrderCancelled",
            correlation_id="corr-order-cancel-50",
            timestamp=base_time + timedelta(minutes=13),
            payload={
                "order_id": "ord-3001",
                "customer_id": "cust-6000",
                "cancellation_reason": "customer_request",
                "refund_amount": 199.99,
                "currency": "USD"
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
        ServiceBusMessage(
            message_id="msg-019",
            event_type="OrderCancelled",
            correlation_id="corr-order-cancel-51",
            timestamp=base_time + timedelta(minutes=17),
            payload={
                "order_id": "ord-3002",
                "customer_id": "cust-6001",
                "cancellation_reason": "out_of_stock",
                "refund_amount": 75.00,
                "currency": "USD"
            },
            properties={"source": "order-service", "version": "1.5"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-020",
            event_type="ShipmentDispatched",
            correlation_id="corr-ship-300",
            timestamp=base_time + timedelta(hours=1),
            payload={
                "shipment_id": "ship-4001",
                "order_id": "ord-2001",
                "tracking_number": "TRK123456789",
                "carrier": "FedEx",
                "estimated_delivery": "2025-12-20"
            },
            properties={"source": "shipping-service", "version": "2.0"}
        ),
        ServiceBusMessage(
            message_id="msg-021",
            event_type="ShipmentDispatched",
            correlation_id="corr-ship-301",
            timestamp=base_time + timedelta(hours=1, minutes=10),
            payload={
                "shipment_id": "ship-4002",
                "order_id": "ord-2002",
                "tracking_number": "TRK987654321",
                "carrier": "UPS",
                "estimated_delivery": "2025-12-21"
            },
            properties={"source": "shipping-service", "version": "2.0"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-022",
            event_type="PaymentProcessed",
            correlation_id=None,
            timestamp=base_time + timedelta(minutes=20),
            payload={
                "transaction_id": "txn-bad-001",
                "status": "completed"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-023",
            event_type="OrderCreated",
            correlation_id="corr-malformed-999",
            timestamp=base_time + timedelta(minutes=22),
            payload={
                "order_id": None,
                "total_amount": "invalid_number"
            },
            properties={}
        ),
        ServiceBusMessage(
            message_id="msg-024",
            event_type="UnknownEvent",
            correlation_id="corr-unknown-001",
            timestamp=base_time + timedelta(minutes=25),
            payload={
                "random_field": "random_value",
                "nested": {
                    "deep": {
                        "value": 42
                    }
                }
            },
            properties={"source": "unknown-service", "version": "0.0.1"}
        ),
        ServiceBusMessage(
            message_id="msg-025",
            event_type="InventoryUpdated",
            correlation_id="corr-inv-bad-001",
            timestamp=base_time + timedelta(minutes=27),
            payload={
                "sku": "PROD-9999",
                "quantity_change": "not_a_number",
                "warehouse_id": None
            },
            properties={"source": "inventory-service", "version": "3.0"}
        ),
        ServiceBusMessage(
            message_id="msg-026",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-dupe",
            timestamp=base_time + timedelta(minutes=30),
            payload={
                "transaction_id": "txn-1001",
                "amount": 149.99,
                "currency": "USD",
                "status": "completed",
                "payment_method": "credit_card",
                "merchant_id": "merch-500",
                "duplicate_flag": True
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
    ])
    
    messages.extend([
        ServiceBusMessage(
            message_id="msg-027",
            event_type="PaymentProcessed",
            correlation_id="corr-payment-005",
            timestamp=base_time + timedelta(minutes=35),
            payload={
                "transaction_id": "txn-1010",
                "amount": 9999.99,
                "currency": "USD",
                "status": "completed",
                "payment_method": "wire_transfer",
                "merchant_id": "merch-503"
            },
            properties={"source": "payment-service", "version": "2.1"}
        ),
        ServiceBusMessage(
            message_id="msg-028",
            event_type="OrderCreated",
            correlation_id="corr-order-104",
            timestamp=base_time + timedelta(minutes=38),
            payload={
                "order_id": "ord-2005",
                "customer_id": "cust-5004",
                "total_amount": 29.99,
                "currency": "GBP",
                "items_count": 2,
                "shipping_address": {
                    "country": "UK",
                    "zip": "SW1A1AA"
                }
            },
            properties={"source": "order-service", "version": "1.6"}
        ),
    ])
    
    return messages
