/**
 * Generates a unique correlation ID for distributed tracing.
 * Used to correlate frontend requests with backend logs and Application Insights traces.
 */
export function generateCorrelationId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Stores the correlation ID in session storage for the current session.
 * This can be used to track all requests from a single user session.
 */
export function setSessionCorrelationId(sessionId: string): void {
  const correlationId = generateCorrelationId()
  sessionStorage.setItem(`correlation-${sessionId}`, correlationId)
}

/**
 * Retrieves the correlation ID for a session from session storage.
 */
export function getSessionCorrelationId(sessionId: string): string | null {
  return sessionStorage.getItem(`correlation-${sessionId}`)
}

/**
 * Clears the correlation ID for a session.
 */
export function clearSessionCorrelationId(sessionId: string): void {
  sessionStorage.removeItem(`correlation-${sessionId}`)
}

// PRODUCTION INTEGRATION WITH APPLICATION INSIGHTS:
//
// To integrate with Azure Application Insights from the frontend:
//
// 1. Install the Application Insights SDK:
//    npm install @microsoft/applicationinsights-web
//
// 2. Initialize in main.tsx:
//    import { ApplicationInsights } from '@microsoft/applicationinsights-web'
//    
//    const appInsights = new ApplicationInsights({
//      config: {
//        connectionString: 'YOUR_CONNECTION_STRING',
//        enableAutoRouteTracking: true,
//        enableCorsCorrelation: true,
//        enableRequestHeaderTracking: true,
//        enableResponseHeaderTracking: true,
//        correlationHeaderExcludedDomains: []
//      }
//    })
//    appInsights.loadAppInsights()
//    appInsights.trackPageView()
//
// 3. Set custom properties with correlation ID:
//    appInsights.addTelemetryInitializer((envelope) => {
//      envelope.tags['ai.operation.id'] = getSessionCorrelationId(sessionId) || generateCorrelationId()
//    })
//
// 4. Track custom events:
//    appInsights.trackEvent({ name: 'MessageReceived', properties: { messageId, sessionId } })
//
// 5. Track exceptions:
//    appInsights.trackException({ exception: new Error('...') })
//
// This enables end-to-end tracing from frontend → backend → Service Bus with correlated telemetry.
