"""Pattern detection utilities for message analysis."""
from typing import Any, Dict, List, Set
from collections import defaultdict
from app.models.message import ServiceBusMessage


def extract_payload_structure(message: ServiceBusMessage) -> Set[str]:
    """Extract the structure (field names) from a message payload."""
    
    def get_keys(obj: Any, prefix: str = "") -> Set[str]:
        keys = set()
        if isinstance(obj, dict):
            for key, value in obj.items():
                full_key = f"{prefix}.{key}" if prefix else key
                keys.add(full_key)
                if isinstance(value, dict):
                    keys.update(get_keys(value, full_key))
        return keys
    
    return get_keys(message.payload)


def calculate_structure_similarity(struct1: Set[str], struct2: Set[str]) -> float:
    """Calculate similarity between two payload structures (Jaccard similarity)."""
    if not struct1 and not struct2:
        return 1.0
    if not struct1 or not struct2:
        return 0.0
    
    intersection = len(struct1 & struct2)
    union = len(struct1 | struct2)
    
    return intersection / union if union > 0 else 0.0


def detect_common_fields(messages: List[ServiceBusMessage]) -> Dict[str, Any]:
    """Detect fields that are common across all messages in a group."""
    if not messages:
        return {}
    
    field_values = defaultdict(set)
    
    for message in messages:
        for key, value in message.payload.items():
            if not isinstance(value, (dict, list)):
                field_values[key].add(str(value))
    
    common_fields = {}
    for field, values in field_values.items():
        if len(values) == 1:
            value_str = list(values)[0]
            try:
                if value_str.isdigit():
                    common_fields[field] = int(value_str)
                elif value_str.replace(".", "", 1).isdigit():
                    common_fields[field] = float(value_str)
                else:
                    common_fields[field] = value_str
            except (ValueError, AttributeError):
                common_fields[field] = value_str
    
    return common_fields


def detect_correlation_groups(messages: List[ServiceBusMessage]) -> List[List[str]]:
    """Group message IDs by correlation_id."""
    correlation_map = defaultdict(list)
    
    for message in messages:
        if message.correlation_id:
            correlation_map[message.correlation_id].append(message.message_id)
    
    return [msg_ids for msg_ids in correlation_map.values() if len(msg_ids) > 1]


def is_valid_message(message: ServiceBusMessage) -> tuple[bool, str]:
    """Check if a message has valid structure and required fields."""
    issues = []
    
    if not message.correlation_id:
        issues.append("missing correlation_id")
    
    if not message.payload:
        issues.append("empty payload")
        return False, "; ".join(issues)
    
    if message.event_type == "PaymentProcessed":
        required = ["amount", "currency", "status"]
        missing = [f for f in required if f not in message.payload]
        if missing:
            issues.append(f"missing payment fields: {', '.join(missing)}")
    
    elif message.event_type == "OrderCreated":
        required = ["order_id", "customer_id", "total_amount"]
        missing = [f for f in required if f not in message.payload]
        if missing:
            issues.append(f"missing order fields: {', '.join(missing)}")
    
    elif message.event_type == "InventoryUpdated":
        required = ["sku", "quantity_change", "warehouse_id"]
        missing = [f for f in required if f not in message.payload]
        if missing:
            issues.append(f"missing inventory fields: {', '.join(missing)}")
    
    for key, value in message.payload.items():
        if value is None:
            issues.append(f"null value in field: {key}")
    
    if issues:
        return False, "; ".join(issues)
    
    return True, ""


def detect_anomalies(message: ServiceBusMessage, cluster_messages: List[ServiceBusMessage]) -> tuple[bool, str, float]:
    """Detect if a message is anomalous compared to its cluster."""
    
    is_valid, validation_issue = is_valid_message(message)
    if not is_valid:
        return True, f"Validation failed: {validation_issue}", 0.9
    
    if message.event_type not in [
        "PaymentProcessed", "OrderCreated", "InventoryUpdated", 
        "PaymentFailed", "OrderCancelled", "ShipmentDispatched"
    ]:
        return True, f"Unknown event type: {message.event_type}", 0.85
    
    if message.payload.get("duplicate_flag"):
        return True, "Potential duplicate transaction detected", 0.75
    
    if message.event_type == "PaymentProcessed":
        amount = message.payload.get("amount")
        if isinstance(amount, (int, float)) and amount > 5000:
            return True, f"Unusually high payment amount: {amount}", 0.7
    
    msg_structure = extract_payload_structure(message)
    if cluster_messages:
        avg_similarity = sum(
            calculate_structure_similarity(msg_structure, extract_payload_structure(m))
            for m in cluster_messages
        ) / len(cluster_messages)
        
        if avg_similarity < 0.5:
            return True, f"Payload structure differs significantly from cluster (similarity: {avg_similarity:.2f})", 0.8
    
    return False, "", 0.0


def generate_cluster_description(
    event_types: List[str], 
    messages: List[ServiceBusMessage], 
    common_fields: Dict[str, Any]
) -> str:
    """Generate a human-readable description of a message cluster pattern."""
    
    primary_type = event_types[0] if event_types else "Unknown"
    count = len(messages)
    
    descriptions = {
        "PaymentProcessed": f"Payment completion events ({count} messages) with standard transaction flow",
        "PaymentFailed": f"Failed payment attempts ({count} messages) with various error conditions",
        "OrderCreated": f"Order creation events ({count} messages) from e-commerce flow",
        "OrderCancelled": f"Order cancellation events ({count} messages) with refund processing",
        "InventoryUpdated": f"Inventory adjustment events ({count} messages) from warehouse operations",
        "ShipmentDispatched": f"Shipping dispatch events ({count} messages) with tracking information"
    }
    
    base_desc = descriptions.get(primary_type, f"{primary_type} events ({count} messages)")
    
    if common_fields:
        common_keys = list(common_fields.keys())[:3]
        if common_keys:
            base_desc += f". Common attributes: {', '.join(common_keys)}"
    
    return base_desc
