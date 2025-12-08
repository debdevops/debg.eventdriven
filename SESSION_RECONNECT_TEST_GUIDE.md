# Session Management & Reconnect - Comprehensive Test Guide

## Overview

This document provides step-by-step manual tests for the robust session management with exponential backoff reconnect system implemented in SessionContextV2.

## Test 1: Idle Detection & Toast Warning

**Objective**: Verify that after 2 minutes of inactivity, a toast warning appears.

**Steps**:
1. Connect to a Service Bus namespace
2. Start a message stream (click on queue)
3. Set a timer for 2 minutes
4. DO NOT move mouse, click, type, or scroll
5. After 2 minutes:
   - Expected: Toast warning appears: "⏱️ Session will expire due to inactivity. Move mouse to stay connected."
   - Status Indicator: Changes to show idle state
6. Move mouse or click
   - Expected: Toast disappears, timer resets to 0 seconds

**Result**: ✅ PASS / ❌ FAIL

---

## Test 2: Idle Critical Warning & Modal

**Objective**: Verify that after 3 minutes of inactivity, modal appears with Reconnect button.

**Steps**:
1. Connect to a Service Bus namespace
2. Start a message stream
3. Set timer for 3 minutes
4. DO NOT interact (no mouse, click, type, scroll)
5. After ~2 minutes:
   - Toast warning appears
6. After ~3 minutes:
   - Expected: Amber banner appears at top
7. After +2 more seconds:
   - Expected: Modal dialog appears with:
     - Message: "Session Expired - Your session has expired due to inactivity"
     - Button: "🔄 Reconnect" (primary)
     - Button: "Switch Namespace" (secondary)

**Result**: ✅ PASS / ❌ FAIL

---

## Test 3: Manual Reconnect from Modal

**Objective**: Verify that clicking Reconnect button successfully restores connection.

**Prerequisites**: Modal from Test 2 is open

**Steps**:
1. Click "🔄 Reconnect" button
2. Expected: Button shows "Reconnecting..." with spinner
3. Expected: Toast shows "Reconnecting... (attempt 1/5)"
4. After 1-2 seconds:
   - Button returns to normal
   - Modal closes
   - Toast shows "✓ Reconnected successfully!"
   - Selected namespace/queue remains (restored)
   - Messages resume streaming if in auto mode

**Result**: ✅ PASS / ❌ FAIL

---

## Test 4: Activity Resets Idle Timer

**Objective**: Verify that any user activity resets the idle timer.

**Steps**:
1. Connect to namespace
2. Start timer for 2+ minutes
3. At 1:50 mark, move mouse or click
   - Expected: Idle timer resets to 0
   - Toast does NOT appear
4. Wait another 1:50
5. At 3:40 mark (1:50 after activity):
   - No warnings appear yet
6. At 3:50 mark (2:00 after last activity):
   - Toast warning appears

**Result**: ✅ PASS / ❌ FAIL

---

## Test 5: Reconnect with Exponential Backoff

**Objective**: Verify automatic reconnect with exponential backoff.

**Steps**:
1. Connect to namespace and select a queue
2. Open browser DevTools (F12)
3. In Console tab, simulate network failure:
   ```javascript
   // Disable network
   // Go to Network tab → Throttle → Offline
   ```
4. Keep page idle for 2-3 minutes
5. After modal appears, click "Reconnect"
6. Expected sequence:
   - Toast: "Reconnecting... (attempt 1/5)" after 500ms
   - Toast: "Reconnecting... (attempt 2/5)" after +1s
   - Toast: "Reconnecting... (attempt 3/5)" after +2s
   - Toast: "Reconnecting... (attempt 4/5)" after +4s
   - Toast: "Reconnecting... (attempt 5/5)" after +8s (max)
   - If still failing: Error toast after all attempts
7. Restore network (Network tab → Throttle → Online)
8. Expected: Next reconnect attempt succeeds
   - Toast: "✓ Reconnected successfully!"
   - Modal closes, connection restored

**Result**: ✅ PASS / ❌ FAIL

---

## Test 6: Authentication Error Handling

**Objective**: Verify 401/auth errors are handled gracefully without infinite retry.

**Steps**:
1. Connect to a valid namespace
2. In browser DevTools Network tab, find any API call to `/api/*`
3. Right-click → Edit and Resend → Modify to invalid sessionId
   - Change `sessionId=xxx` to `sessionId=invalid`
4. Press Enter
5. Expected:
   - 401 Unauthorized error response
   - Toast: "🔐 [Auth error message]"
   - Status changes to "auth_required"
   - Modal does NOT appear (auth errors skip retry logic)
   - Manual Reconnect button still available in sidebar

**Result**: ✅ PASS / ❌ FAIL

---

## Test 7: Controls Disabled While Disconnected

**Objective**: Verify that action buttons are disabled when status !== 'connected'.

**Prerequisites**: Status should be 'disconnected' or 'expired'

**Steps**:
1. Trigger disconnect (e.g., let session expire)
2. Status indicator shows red/disconnected
3. Expected disabled buttons (grayed out, no-click):
   - Stream (if messages panel visible)
   - Peek
   - Refresh
   - Send Message
   - Export All
   - Compare DLQ
4. Hover over disabled button:
   - Expected: Tooltip explains "Reconnect to use this feature"
5. Click Reconnect button
6. After successful reconnect:
   - All buttons re-enabled (clickable)
   - Status indicator shows green/connected

**Result**: ✅ PASS / ❌ FAIL

---

## Test 8: Timer Cleanup (No Duplicates)

**Objective**: Verify that reconnect properly cleans up all timers and doesn't create duplicates.

**Steps**:
1. Open browser DevTools Console
2. Connect to namespace
3. Note console output: "[Session] Clearing X timers"
4. Let session idle → Modal appears
5. Click Reconnect
6. In console, observe:
   ```
   [Session] Clearing N timers
   [Session] ✓ Timers cleared
   [Session] Executing full reload
   [Session] ✓ Reconnect SUCCESS on attempt 1
   ```
7. Repeat idle + reconnect 3 times
8. Expected: Timer count should NOT grow
   - First reconnect: "Clearing 0-2 timers"
   - Second reconnect: "Clearing 0-2 timers" (not 5-6)
   - Third reconnect: "Clearing 0-2 timers" (not 10-12)

**Result**: ✅ PASS / ❌ FAIL

---

## Test 9: Switch Namespace from Modal

**Objective**: Verify "Switch Namespace" button closes modal and opens namespace selector.

**Prerequisites**: Session expired modal is open

**Steps**:
1. Click "Switch Namespace" button
2. Expected:
   - Modal closes
   - Connect/Add Namespace dialog appears
   - User can select or add new namespace

**Result**: ✅ PASS / ❌ FAIL

---

## Test 10: Namespace & Entity Selection Restored After Reconnect

**Objective**: Verify previous selection is remembered after reconnect.

**Steps**:
1. Connect to "Dev" namespace
2. Select queue "test-queue2"
3. Message panel loads and shows messages
4. Trigger session expiry (idle for 3 minutes)
5. Modal appears
6. Click "Reconnect"
7. After successful reconnect:
   - Expected: Still on "Dev" namespace (tabs)
   - Expected: Still showing "test-queue2" in sidebar (selected)
   - Expected: Messages resume streaming

**Result**: ✅ PASS / ❌ FAIL

---

## Test 11: Manual Reconnect Button in Sidebar

**Objective**: Verify manual Reconnect button in status dot is functional.

**Steps**:
1. Connect to namespace
2. Trigger disconnect (let session expire)
3. Status indicator shows red dot with "Expired" tooltip
4. Click on status dot
5. Expected: Dropdown or direct button to Reconnect
6. Click Reconnect
7. Expected: Same behavior as modal reconnect
   - Toast shows progress
   - Button shows spinner during reconnect
   - After success: Status returns to green
   - Modal closes (if open)

**Result**: ✅ PASS / ❌ FAIL

---

## Test 12: Browser Visibility Change

**Objective**: Verify activity detection works when returning from hidden tab.

**Steps**:
1. Connect to namespace
2. Start message stream
3. Switch to another browser tab (hide page)
4. Wait 30 seconds
5. Idle timer should NOT advance (visibilitychange handler)
6. Return to page
7. Expected: Activity detected, idle timer resets
8. Wait 2 minutes idle
9. Expected: Toast appears as normal

**Result**: ✅ PASS / ❌ FAIL

---

## Summary Checklist

- [ ] Test 1: Idle Toast Warning (2 min)
- [ ] Test 2: Idle Critical Modal (3 min)
- [ ] Test 3: Manual Reconnect from Modal
- [ ] Test 4: Activity Resets Idle Timer
- [ ] Test 5: Exponential Backoff
- [ ] Test 6: Auth Error Handling (401)
- [ ] Test 7: Controls Disabled When Disconnected
- [ ] Test 8: Timer Cleanup (No Duplicates)
- [ ] Test 9: Switch Namespace from Modal
- [ ] Test 10: Selection Restored After Reconnect
- [ ] Test 11: Manual Reconnect Button
- [ ] Test 12: Visibility Change Activity Reset

**Overall Result**: ✅ ALL PASS / ⚠️ PARTIAL / ❌ CRITICAL FAILURES

---

## Known Issues / Notes

(To be filled during testing)

---

## How to Run Tests Locally

```bash
# Terminal 1: Start backend
cd /Users/debasisghosh/Github/debg.eventdriven/src/ServiceBusInspectorApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run

# Terminal 2: Start frontend
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
npm run dev

# Terminal 3: Open browser
open http://localhost:5173

# Then follow test steps above
```

## Environment Setup

- **Browser**: Chrome/Edge with DevTools (F12)
- **Timer Tool**: Online timer or `Date.now()` in console
- **Network Simulation**: DevTools Network tab
- **Backend**: .NET 9 running at https://localhost:7001
- **Frontend**: Vite dev server at http://localhost:5173
