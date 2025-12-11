# Session & Reconnect Reliability Guide

## Overview

This document describes the session management and reconnect behaviors implemented in the Service Bus Inspector frontend.

## Session Idle Model

**Timeline:**
- **0:00** - User becomes idle (no mouse/keyboard activity)
- **2:00** - Yellow toast appears: "Session will expire due to inactivity. Move mouse to stay connected."
- **2:30** - Amber banner appears: "Session expiring in 30 seconds..."
- **3:00** - Red modal appears: "Session Expired - Please Reconnect or Switch Namespace"

**Activity Resets Timer:**
Any user interaction (mouse movement, keyboard, scroll, click, touch) resets the idle timer back to 0:00 and hides all warnings.

**Implementation:**
- Hook: `useIdleDetection.ts` - Tracks user activity across 6 event types
- Context: `SessionContextV2.tsx` - Manages idle state and modal display
- Component: `App.tsx` - Routes idle critical state to SessionExpiredModal

## Reconnect Lifecycle

### Automatic Reconnect (On Network Disconnect)

**Trigger:** Any API request fails with network error or 401

**Algorithm:**
1. Prevent duplicate reconnects (mutex via `reconnectInProgressRef`)
2. Clear all old timers/intervals (prevents memory leaks)
3. Attempt reload with exponential backoff:
   - Attempt 1: 500ms wait
   - Attempt 2: 1s wait
   - Attempt 3: 2s wait
   - Attempt 4: 4s wait
   - Attempt 5: 8s wait (max)
4. On success: restore namespace/queue selection, refresh messages, show "Reconnected successfully" toast
5. On failure after 5 attempts: show error state, offer manual retry

**Key Features:**
- User sees "Reconnecting... (attempt X/5)" toast
- No stale timers or listeners remain
- Full UI state is restored (selected queue, filters, scroll position, auto-refresh state)
- If state restoration fails, sensible defaults are selected and error is shown

### Token Refresh (401 Handling)

**Single-Flight Mechanism:**
When multiple requests hit 401 simultaneously (common during token expiry):
1. Only ONE refresh actually executes (via `singleFlightRefresh()`)
2. Other requests wait for that refresh to complete
3. All requests then retry with refreshed credentials
4. If still 401 after refresh → authentication failed → show re-auth modal

**Retry Logic:**
- 401 immediately triggers single-flight refresh
- After refresh, request is retried once
- If still 401 → throw `AuthError` (let SessionContext handle)
- No cascading retry loops

### Manual Reconnect

**Via Modal Button:**
User clicks "Reconnect" button in the SessionExpiredModal → immediate reconnect attempt without waiting for backoff delay.

## Connection Health Monitoring

### Heartbeat
- Every 20 seconds (if connected and not idle)
- Marks successful communication with backend
- Tracks consecutive missed heartbeats

### Stale Connection Detection
- If 2+ consecutive heartbeat misses → connection marked "stale"
- SessionContext automatically triggers reconnect
- User sees "Connection lost" toast

## API Client (client.ts)

### Public Methods
- `connect(connectionString)` - Establish session
- `listEntities(sessionId)` - Get queues/topics
- `listSubscriptions(sessionId, topicName)` - Get subscriptions
- `peekMessages(sessionId, entityName)` - Peek messages
- `sendMessage(...)` - Send message to queue/topic

### Internal State Management
- `recordHeartbeat()` - Mark successful API call
- `recordMissedHeartbeat()` - Track failed calls
- `singleFlightRefresh()` - Centralized 401 handling

## Session Context (SessionContextV2.tsx)

### State
- `status: 'connecting' | 'connected' | 'disconnected' | 'expired' | 'auth_required'`
- `error: SessionError | null` - Last error details
- `idleSeconds: number` - Seconds since last activity
- `showIdleWarning` / `showIdleCritical` - UI state

### Actions
- `reconnect(sessionId, reloadCallback)` - Trigger reconnect with callback to reload namespace/entities
- `resetActivity()` - Reset idle timer
- `clearError()` - Clear error state
- `markExpired()` - Mark session as expired

## Component Integration

### App.tsx
Main integration point:
- Uses `useSessionV2()` hook
- Routes errors to modals
- Passes `reloadCallback` to reconnect (reloads namespace/entities/messages)
- Displays idle toasts, banners, and expiry modal

### EntityList.tsx
- Pauses auto-refresh during reconnect (`status !== 'connected'`)
- Registers timers with SessionContext (allows cleanup)

### StreamPanel.tsx
- Subscribes to SSE events
- Unsubscribes on unmount
- SessionContext ensures disposal on reconnect

## Manual Verification Steps

### Test Idle Timeout
1. Open app, connect to namespace
2. Don't touch anything for 2:00 minutes
3. Verify: Yellow toast appears
4. Wait 30 seconds
5. Verify: Amber banner appears
6. Wait 30 seconds
7. Verify: Red modal appears with "Reconnect" button
8. Click anywhere or move mouse
9. Verify: Toast/banner/modal all disappear

### Test Activity Resets Timer
1. After step 3 above (toast visible)
2. Move mouse or press key
3. Verify: Toast immediately disappears
4. Wait another 2 minutes
5. Verify: Toast appears again (timer reset)

### Test Reconnect
1. Open app, connect normally
2. Simulate network disconnect (DevTools → Network → Offline)
3. Try to fetch messages
4. Verify: "Reconnecting... (attempt 1/5)" toast appears
5. Re-enable network
6. Verify: Toast disappears, "Reconnected successfully" appears
7. Verify: Previously selected queue/messages are restored

### Test 401 Handling
1. Backend invalidates session (e.g., manual session revocation)
2. Try to fetch messages
3. Verify: Single 401 error, NO retry cascade
4. Verify: Auth modal appears
5. Re-authenticate
6. Verify: Error disappears, connection restored

### Test No Duplicate Timers
1. Open DevTools → Console
2. Trigger reconnect (offline/online)
3. Verify console logs "Clearing N timers" and "Register" calls
4. Monitor: No "timer already exists" warnings
5. Perform 5+ reconnects
6. Verify: No memory growth or duplicate timer warnings

## Debug Logging

Enable debug mode for detailed logs:
```javascript
// In browser console
localStorage.setItem('DEBUG_SESSION', 'true')
// Reload page
```

Console output will include:
- `[Session]` - SessionContextV2 lifecycle
- `[ApiClient]` - API requests and auth
- `[Heartbeat]` - Connection health
- `[IdleDetection]` - Activity tracking

## Known Limitations

1. **No automatic token refresh endpoint** - Currently, 401 forces re-auth. If backend implements a refresh endpoint, ApiClient can be updated to use it without SessionContext changes.

2. **SSE subscriptions** - StreamPanel manually subscribes to SSE. If connection drops, SessionContext reconnect doesn't automatically re-subscribe. Component is responsible for cleanup on unmount.

3. **Scroll position** - Best-effort restoration. Complex virtualized lists may not restore exactly.

4. **Message cache** - No offline message cache. Reconnect re-fetches all messages.

## Future Improvements

1. **Automatic token refresh** - Implement backend refresh endpoint, update `singleFlightRefresh()` to call it
2. **Message caching** - Store recently viewed messages to avoid re-fetch on reconnect
3. **SSE auto-resubscribe** - SessionContext could trigger SSE resubscription on reconnect
4. **IndexedDB persistence** - Store selection state across page reload
5. **Graceful degradation** - Show cached data while reconnecting instead of blank grid

## Troubleshooting

### Stuck in "Reconnecting" State
**Symptom:** Toast shows "Reconnecting... (attempt X/5)" but never completes

**Solution:**
1. Check DevTools Network tab → backend is responding?
2. Check browser console for errors
3. Click "Reconnect" button in modal (manual retry)
4. If still stuck, refresh page

### Green indicator but 401 errors
**Symptom:** Connection shows green, but API calls fail with 401

**Solution:**
1. Likely: Backend session expired while UI shows connected
2. Single-flight refresh triggered
3. If re-auth required, modal should appear
4. Re-authenticate
5. If modal doesn't appear, hard refresh browser

### Memory leak warnings
**Symptom:** DevTools shows growing memory with repeated reconnects

**Solution:**
1. Ensure SessionContext cleanup running: `clearAllTimers()` called
2. Check EventTarget listeners not accumulating
3. Review component unmount effects (cleanup functions)
4. Use DevTools → Memory → Heap snapshots to identify leaks

---

**Last Updated:** December 2025
**Status:** Actively maintained
**Contact:** For issues, check GitHub issues or contact team
