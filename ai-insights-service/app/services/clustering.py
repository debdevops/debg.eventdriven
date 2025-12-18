"""Message clustering service using heuristic-based algorithms."""
from collections import defaultdict
from typing import List, Tuple
from app.models.message import ServiceBusMessage
from app.models.analysis import MessageCluster, OutlierDetail
from app.services.pattern_detection import (
    detect_common_fields,
    detect_correlation_groups,
    generate_cluster_description,
    detect_anomalies,
    extract_payload_structure,
    calculate_structure_similarity
)


class MessageClusteringService:
    """Service for clustering and analyzing Service Bus messages."""
    
    def __init__(self):
        self.outlier_threshold = 0.6
    
    def cluster_messages(self, messages: List[ServiceBusMessage]) -> Tuple[List[MessageCluster], List[OutlierDetail]]:
        """
        Cluster messages using heuristic approach:
        1. Primary clustering by event_type
        2. Sub-clustering by payload structure similarity
        3. Outlier detection within each cluster
        """
        
        outliers = []
        
        event_type_groups = defaultdict(list)
        for message in messages:
            event_type_groups[message.event_type].append(message)
        
        clusters = []
        cluster_counter = 1
        
        for event_type, event_messages in event_type_groups.items():
            
            if len(event_messages) == 1:
                msg = event_messages[0]
                is_anomalous, reason, score = detect_anomalies(msg, [])
                if is_anomalous:
                    outliers.append(OutlierDetail(
                        message_id=msg.message_id,
                        reason=reason,
                        anomaly_score=score
                    ))
                    continue
            
            sub_clusters = self._sub_cluster_by_structure(event_messages)
            
            for sub_cluster_msgs in sub_clusters:
                
                cluster_outliers, clean_messages = self._detect_cluster_outliers(
                    sub_cluster_msgs, event_type
                )
                outliers.extend(cluster_outliers)
                
                if not clean_messages:
                    continue
                
                common_fields = detect_common_fields(clean_messages)
                correlation_groups = detect_correlation_groups(clean_messages)
                
                cluster_name = self._generate_cluster_name(event_type, cluster_counter)
                pattern_desc = generate_cluster_description(
                    [event_type], clean_messages, common_fields
                )
                
                confidence = self._calculate_cluster_confidence(
                    clean_messages, common_fields
                )
                
                sample_ids = [m.message_id for m in clean_messages[:5]]
                
                cluster = MessageCluster(
                    cluster_id=f"cluster-{cluster_counter}",
                    cluster_name=cluster_name,
                    message_count=len(clean_messages),
                    event_types=[event_type],
                    pattern_description=pattern_desc,
                    common_fields=common_fields,
                    correlation_groups=correlation_groups if correlation_groups else None,
                    sample_message_ids=sample_ids,
                    confidence=confidence
                )
                
                clusters.append(cluster)
                cluster_counter += 1
        
        clusters.sort(key=lambda c: c.message_count, reverse=True)
        
        return clusters, outliers
    
    def _sub_cluster_by_structure(
        self, messages: List[ServiceBusMessage]
    ) -> List[List[ServiceBusMessage]]:
        """Sub-cluster messages by payload structure similarity."""
        
        if len(messages) <= 3:
            return [messages]
        
        structures = [extract_payload_structure(m) for m in messages]
        
        sub_clusters = []
        assigned = set()
        
        for i, msg in enumerate(messages):
            if i in assigned:
                continue
            
            cluster = [msg]
            assigned.add(i)
            struct_i = structures[i]
            
            for j in range(i + 1, len(messages)):
                if j in assigned:
                    continue
                
                struct_j = structures[j]
                similarity = calculate_structure_similarity(struct_i, struct_j)
                
                if similarity >= 0.7:
                    cluster.append(messages[j])
                    assigned.add(j)
            
            sub_clusters.append(cluster)
        
        return sub_clusters
    
    def _detect_cluster_outliers(
        self, messages: List[ServiceBusMessage], event_type: str
    ) -> Tuple[List[OutlierDetail], List[ServiceBusMessage]]:
        """Detect and separate outliers from a cluster."""
        
        outliers = []
        clean_messages = []
        
        for message in messages:
            is_anomalous, reason, score = detect_anomalies(message, messages)
            
            if is_anomalous and score >= self.outlier_threshold:
                outliers.append(OutlierDetail(
                    message_id=message.message_id,
                    reason=reason,
                    anomaly_score=score
                ))
            else:
                clean_messages.append(message)
        
        return outliers, clean_messages
    
    def _generate_cluster_name(self, event_type: str, counter: int) -> str:
        """Generate a human-readable cluster name."""
        
        name_mapping = {
            "PaymentProcessed": "Payment Processing Events",
            "PaymentFailed": "Failed Payment Events",
            "OrderCreated": "Order Creation Events",
            "OrderCancelled": "Order Cancellation Events",
            "InventoryUpdated": "Inventory Management Events",
            "ShipmentDispatched": "Shipping Dispatch Events"
        }
        
        base_name = name_mapping.get(event_type, f"{event_type} Events")
        
        return f"{base_name} - Group {counter}"
    
    def _calculate_cluster_confidence(
        self, messages: List[ServiceBusMessage], common_fields: dict
    ) -> float:
        """Calculate confidence score for cluster quality."""
        
        if not messages:
            return 0.0
        
        confidence = 0.7
        
        if len(messages) >= 3:
            confidence += 0.1
        
        if common_fields:
            common_ratio = len(common_fields) / max(
                len(messages[0].payload.keys()), 1
            )
            confidence += min(common_ratio * 0.15, 0.15)
        
        correlation_groups = detect_correlation_groups(messages)
        if correlation_groups:
            confidence += 0.05
        
        return min(confidence, 1.0)
