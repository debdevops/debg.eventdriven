# Testing Scripts

## send-sample-messages.js

Node.js script to send sample messages to Azure Service Bus for testing the inspector.

### Prerequisites

```bash
cd scripts
npm install
```

### Usage

```bash
# Set your Service Bus connection string
export SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://..."

# Send 10 sample messages to 'test-queue'
node send-sample-messages.js test-queue 10
```

### Sample Message Types

The script sends randomized messages of different types:
- OrderCreated
- PaymentProcessed
- InventoryUpdated
- CustomerRegistered
- ShipmentDispatched

Each message includes:
- Unique message ID
- JSON body with realistic data
- Application properties (eventType, version, correlationId, priority)
- Content type and subject headers

### Example Output

```
🚌 Connecting to Service Bus...
   Queue: test-queue
   Messages to send: 5

✅ Sent message 1/5: OrderCreated (msg-1731585600000-1)
✅ Sent message 2/5: PaymentProcessed (msg-1731585600100-2)
✅ Sent message 3/5: InventoryUpdated (msg-1731585600200-3)
✅ Sent message 4/5: CustomerRegistered (msg-1731585600300-4)
✅ Sent message 5/5: ShipmentDispatched (msg-1731585600400-5)

✅ Successfully sent 5 messages to queue 'test-queue'

You can now inspect these messages using the Service Bus Inspector UI.
```

---

**Author**: Debasis Ghosh
