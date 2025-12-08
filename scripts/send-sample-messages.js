#!/usr/bin/env node

/**
 * Send sample messages to Azure Service Bus for testing the inspector.
 * 
 * Usage:
 *   export SERVICE_BUS_CONNECTION_STRING="<connection-string>"
 *   node send-sample-messages.js <queue-name> <count>
 * 
 * Example:
 *   node send-sample-messages.js test-queue 10
 */

const { ServiceBusClient } = require('@azure/service-bus')

// Configuration
const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING
const queueName = process.argv[2]
const messageCount = parseInt(process.argv[3] || '5', 10)

if (!connectionString) {
  console.error('❌ Error: SERVICE_BUS_CONNECTION_STRING environment variable is required')
  console.error('\nUsage:')
  console.error('  export SERVICE_BUS_CONNECTION_STRING="<connection-string>"')
  console.error('  node send-sample-messages.js <queue-name> <count>')
  process.exit(1)
}

if (!queueName) {
  console.error('❌ Error: Queue name is required')
  console.error('\nUsage:')
  console.error('  node send-sample-messages.js <queue-name> <count>')
  process.exit(1)
}

// Sample message templates
const messageTemplates = [
  {
    type: 'OrderCreated',
    data: {
      orderId: 'ORD-{{id}}',
      customerId: 'CUST-{{random}}',
      amount: 99.99,
      items: [
        { sku: 'ITEM-001', quantity: 2 },
        { sku: 'ITEM-002', quantity: 1 }
      ],
      timestamp: new Date().toISOString()
    }
  },
  {
    type: 'PaymentProcessed',
    data: {
      paymentId: 'PAY-{{id}}',
      orderId: 'ORD-{{random}}',
      amount: 149.99,
      status: 'Completed',
      processor: 'Stripe',
      timestamp: new Date().toISOString()
    }
  },
  {
    type: 'InventoryUpdated',
    data: {
      sku: 'ITEM-{{random}}',
      warehouseId: 'WH-001',
      quantityBefore: 100,
      quantityAfter: 98,
      operation: 'Sale',
      timestamp: new Date().toISOString()
    }
  },
  {
    type: 'CustomerRegistered',
    data: {
      customerId: 'CUST-{{id}}',
      email: 'customer{{random}}@example.com',
      firstName: 'John',
      lastName: 'Doe',
      registrationDate: new Date().toISOString()
    }
  },
  {
    type: 'ShipmentDispatched',
    data: {
      shipmentId: 'SHIP-{{id}}',
      orderId: 'ORD-{{random}}',
      carrier: 'FedEx',
      trackingNumber: 'TRK{{random}}',
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      timestamp: new Date().toISOString()
    }
  }
]

function replaceTemplateVars(obj, index) {
  const json = JSON.stringify(obj)
    .replace(/{{id}}/g, String(index).padStart(5, '0'))
    .replace(/{{random}}/g, Math.floor(Math.random() * 10000).toString())
  return JSON.parse(json)
}

async function sendMessages() {
  console.log(`🚌 Connecting to Service Bus...`)
  console.log(`   Queue: ${queueName}`)
  console.log(`   Messages to send: ${messageCount}`)
  console.log()

  const sbClient = new ServiceBusClient(connectionString)
  const sender = sbClient.createSender(queueName)

  try {
    for (let i = 1; i <= messageCount; i++) {
      // Pick a random template
      const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
      const messageData = replaceTemplateVars(template.data, i)

      const message = {
        body: JSON.stringify(messageData),
        messageId: `msg-${Date.now()}-${i}`,
        contentType: 'application/json',
        subject: template.type,
        applicationProperties: {
          eventType: template.type,
          version: '1.0',
          source: 'sample-script',
          correlationId: `corr-${Date.now()}-${i}`,
          priority: i % 3 === 0 ? 'high' : 'normal'
        }
      }

      await sender.sendMessages(message)
      console.log(`✅ Sent message ${i}/${messageCount}: ${template.type} (${message.messageId})`)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log()
    console.log(`✅ Successfully sent ${messageCount} messages to queue '${queueName}'`)
    console.log()
    console.log('You can now inspect these messages using the Service Bus Inspector UI.')
  } catch (error) {
    console.error()
    console.error(`❌ Error sending messages:`, error.message)
    process.exit(1)
  } finally {
    await sender.close()
    await sbClient.close()
  }
}

sendMessages().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
