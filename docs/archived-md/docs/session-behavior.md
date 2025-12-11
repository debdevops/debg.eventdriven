# Session Behavior Documentation

## Overview

The Service Bus Inspector uses an **idle-based session management system** that keeps users connected as long as they're active, with automatic warnings for prolonged inactivity.

---

## Core Principles

1. **No Forced Timeout**: Sessions don't expire after a fixed duration
2. **Activity Detection**: User activity resets idle timer automatically
3. **Smart Warnings**: Progressive notifications before actual expiry
4. **Reliable Reconnect**: Full state restoration with zero UI glitches

---

## Idle Detection Logic

### Monitored Events
The system tracks these user activities:
- `mousemove` - Mouse movement anywhere on page
- `keydown` - Any keyboard input
- `scroll` - Scrolling in any element
- `mousedown` - Mouse clicks
- `touchstart` - Touch interactions (mobile)
- `click` - Click events
- `visibilitychange` - Tab becomes visible again

### Thresholds

| Threshold | Time | Behavior |
|-----------|------|----------|
| **Idle Start** | 2 minutes | User considered idle (internal only) |
| **Warning** | 2 minutes | Show toast: "Session will expire soon" |
| **Critical** | 2.5 minutes | Show amber banner (30 sec before expiry) |
| **Expiry** | 3 minutes | Session expires, show modal |

### Activity Reset
Any detected activity immediately:
- Resets idle timer to 0
- Dismisses all warnings/banners
- Restarts keepalive heartbeat

---

## Keepalive Strategy

### Current Implementation
- **Interval**: 4 minutes (while user is active)
- **Endpoint**: Not yet implemented in backend
- **Fallback**: Backend 401 detection triggers reconnect

### Future Enhancement
When backend adds `/api/session/keepalive`:
```typescript
POST /api/session/keepalive
Headers: Authorization: Bearer <session-token>
Response: 200 OK { "expiresAt": "2025-12-08T12:34:56Z" }
```

The frontend will automatically start using it.

---

## Warning Sequence

### 1. Initial Toast (2 minutes idle)
- **Type**: Info toast (top-right)
- **Message**: "Session will expire soon due to inactivity"
- **Dismissal**: Automatically on any user activity
- **Non-blocking**: User can continue working

### 2. Critical Banner (2.5 minutes idle)
- **Type**: Amber banner (top of page)
- **Message**: "Session expiring in 30 seconds"
- **Dismissal**: Automatically on activity
- **Non-blocking**: User can click anywhere to stay active

### 3. Expiry Modal (3 minutes idle OR backend 401)
- **Type**: Centered modal overlay
- **Blocks UI**: Yes (dims background)
- **Actions**:
  - **Primary**: "Reconnect to Dev" (blue button)
  - **Secondary**: "Switch Namespace" (gray button)

---

## Reconnect Flow

### Trigger Points
1. User idle for 3 minutes
2. Backend returns 401 (token expired)
3. User manually clicks "Reconnect"

### Reconnect Steps

```
1. Set status to 'connecting'
2. Clear all timers/intervals
3. Wait 150ms for cleanup
4. Execute reload callback:
   - Fetch namespace metadata
   - Reload queues/topics/subscriptions
   - Reselect previously selected entity
   - Restore filters and scroll position
   - Restart auto-refresh if enabled
5. Reset activity timer
6. Set status to 'connected'
7. Show success toast
```

### State Restoration
The reconnect callback must restore:
- ✅ Selected queue/topic/subscription
- ✅ Active tab (messages/metrics/rules)
- ✅ Search filters
- ✅ Sort order
- ✅ Scroll position
- ✅ Auto-refresh state
- ✅ Polling intervals

### Error Handling

#### Auth Errors (401/403)
```
Status: 'auth_required'
Modal: Shows with error message
Retry: User must click "Reconnect" again
```

#### Network Errors
```
Status: 'expired'
Modal: Shows generic error
Retry: Automatic retry after 3 seconds (optional)
```

#### Idempotency
- Multiple reconnect calls are ignored
- Only one reconnect can run at a time
- UI remains stable during reconnect

---

## Session Status Indicator

### Location
**Left sidebar header** (above entity list)

### Format
```
Dev • Connected • Active 07:52:13
```

### Components
1. **Namespace**: Short name (truncated if long)
2. **Status**: Connected / Connecting... / Expired
3. **Active Time**: HH:MM:SS since connection

### Visual States

| State | Indicator | Color |
|-------|-----------|-------|
| Connected | 🟢 Pulsing green dot | Green (#10b981) |
| Connecting | 🟠 Blinking orange dot | Orange (#f59e0b) |
| Expired | 🔴 Red dot | Red (#ef4444) |

---

## Testing Manually

### Test Idle Detection
1. Open the app and connect to namespace
2. **Don't touch anything** for 2 minutes
3. Verify toast appears: "Session will expire soon"
4. Move mouse → toast should disappear
5. Wait 2 more minutes → toast reappears
6. Wait 30 more seconds → amber banner appears
7. Wait 30 more seconds → modal appears

### Test Activity Reset
1. Let idle timer reach 1 minute (no toast yet)
2. Move mouse
3. Verify internal timer reset (check console logs)
4. Wait 2 more minutes → toast should appear (fresh 2-min countdown)

### Test Reconnect
1. Force session expiry (wait 3 min idle)
2. Modal appears
3. Click "Reconnect to Dev"
4. Verify:
   - Loading state shows
   - Previous entity reselected
   - Messages reload
   - Auto-refresh restarts (if was enabled)
   - No duplicate timers
   - No layout jumps

### Test Reconnect Failure
1. Disconnect network
2. Trigger reconnect
3. Verify error message shows
4. Reconnect network
5. Click "Reconnect" again
6. Verify success

### Test Switch Namespace
1. Open modal (idle or manual)
2. Click "Switch Namespace"
3. Verify navigation to namespace selection

---

## Implementation Files

### Core Logic
- `src/ui/src/contexts/SessionContext.tsx` - Main session management
- `src/ui/src/hooks/useIdleDetection.ts` - Idle tracking hook

### UI Components
- `src/ui/src/components/SessionStatusIndicator.tsx` - Unified status display
- `src/ui/src/components/SessionExpiryModal.tsx` - Expiry/reconnect modal
- `src/ui/src/components/IdleWarningBanner.tsx` - Critical warning banner

### Integration Points
- `src/ui/src/components/NamespaceView.tsx` - Reconnect callback implementation
- `src/ui/src/components/EntityList.tsx` - Status indicator placement
- `src/ui/src/App.tsx` - SessionProvider wrapper

---

## Configuration

### Adjusting Timeouts

Edit `SessionContext.tsx`:

```typescript
const IDLE_THRESHOLD = 120        // 2 minutes to idle
const IDLE_WARNING_AT = 120       // Show warning at 2 min
const IDLE_CRITICAL_AT = 150      // Show critical at 2.5 min
const KEEPALIVE_INTERVAL = 240000 // 4 minutes keepalive
```

### Disabling Warnings

To disable idle warnings (keep only backend 401 detection):

```typescript
onIdleWarning: undefined,  // Remove toast
onIdleCritical: undefined, // Remove banner
```

---

## Troubleshooting

### Issue: "Duplicate timers after reconnect"
**Cause**: Timers not properly cleared before reconnect  
**Fix**: Ensure `clearAllTimers()` called in reconnect flow  
**Verify**: Check console logs for "Clearing N timers"

### Issue: "Layout jumps when modal appears"
**Cause**: Modal adding scrollbar or shifting layout  
**Fix**: Modal uses fixed positioning with proper z-index  
**Verify**: No `position: absolute` on modal backdrop

### Issue: "Activity not detected on mobile"
**Cause**: Missing touch events  
**Fix**: Added `touchstart` to activity listeners  
**Verify**: Test on mobile device or Chrome DevTools mobile emulation

### Issue: "Session expires while user is active"
**Cause**: Backend token expired before idle threshold  
**Fix**: Implement backend keepalive endpoint  
**Workaround**: Increase `KEEPALIVE_INTERVAL` frequency

### Issue: "Reconnect doesn't restore previous state"
**Cause**: Reload callback not comprehensive enough  
**Fix**: Ensure callback includes all state restoration steps  
**Verify**: Check console logs during reconnect

---

## Future Enhancements

### Backend Integration
- [ ] Implement `/api/session/keepalive` endpoint
- [ ] Return updated `expiresAt` timestamp
- [ ] Support session extension without full reconnect

### Analytics
- [ ] Track idle time distribution
- [ ] Monitor reconnect success rate
- [ ] Measure time-to-reconnect

### UX Improvements
- [ ] Animate countdown in critical banner
- [ ] Add sound/notification for critical warning
- [ ] Remember user preference for auto-reconnect

---

**Last Updated**: December 8, 2025  
**Version**: 1.0  
**Maintained by**: Development Team
