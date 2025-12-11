# Manual Testing Guide - Session & Auth Bug Fixes

## Pre-Test Setup

### Step 1: Prepare Development Environment
```bash
# Terminal 1 - Start Backend
cd /Users/debasisghosh/Github/debg.eventdriven
./start-backend.sh
# OR: dotnet watch run --project src/ServiceBusInspectorApi/ServiceBusInspectorApi.csproj

# Terminal 2 - Start Frontend
cd /Users/debasisghosh/Github/debg.eventdriven/src/ui
npm run dev
# Frontend will be at: http://localhost:5173
```

### Step 2: Prepare Testing Tools
- Open browser to: `http://localhost:5173`
- Open Developer Tools: Press `F12`
- Go to Console tab
- Go to Network tab (to watch requests)
- Keep both tabs visible during testing

### Step 3: Prepare Backend (if testing 401 scenarios)
- Have Azure Service Bus connection string ready
- OR use local mock (if configured)
- Have way to kill/restart backend (for reconnect tests)

---

## Test Suite 1: Idle Session Detection (CRITICAL)

### Test 1.1: Idle Toast Appears at 2:00 Minutes
**Steps:**
1. Open app and connect to a namespace
2. **DO NOT TOUCH ANYTHING** - no mouse, keyboard, or scroll
3. Set phone timer or use watch for 2 minutes exactly
4. **EXPECTED at 2:00:** Yellow toast appears saying "Session idle, activity resets timer"

**Verify:**
- [ ] Toast appears at exactly 2:00 minutes (not earlier, not later)
- [ ] Toast has correct text about idle session
- [ ] Toast has yellow/warning color
- [ ] Toast remains on screen

**Console Check:**
- [ ] See log: `[SessionContext] Idle warning triggered`
- [ ] See log: `isWarning: true`
- [ ] No errors in console

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.2: Idle Banner Appears at 2:30 Minutes
**Prerequisites:** Completed Test 1.1 (idle timer running)

**Steps:**
1. Continue from Test 1.1, DO NOT TOUCH ANYTHING
2. Wait additional 30 seconds (total: 2:30)
3. **EXPECTED at 2:30:** Yellow toast disappears, Amber banner appears

**Verify:**
- [ ] Toast is gone
- [ ] Amber banner appears saying "Session expiring in 30 seconds"
- [ ] Banner has amber/critical color
- [ ] Banner is persistent (stays on screen)

**Console Check:**
- [ ] See log: `[SessionContext] Idle critical triggered`
- [ ] See log: `isCritical: true`
- [ ] No errors in console

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.3: Session Expiry Modal Appears at 3:00 Minutes
**Prerequisites:** Completed Test 1.2 (idle timer running)

**Steps:**
1. Continue from Test 1.2, DO NOT TOUCH ANYTHING
2. Wait additional 30 seconds (total: 3:00)
3. **EXPECTED at 3:00:** Banner disappears, Red modal appears

**Verify:**
- [ ] Amber banner is gone
- [ ] Red "Session Expired" modal appears
- [ ] Modal says "Your session has expired, please log in again"
- [ ] Modal blocks interaction with rest of app
- [ ] Modal has OK or "Re-authenticate" button

**Console Check:**
- [ ] See log: `[SessionContext] Session expired`
- [ ] See log: `status: 'expired'`
- [ ] No errors in console

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.4: Activity Cancels Toast (Early Reset)
**Steps:**
1. Open app, start idle timer (same setup as 1.1)
2. Wait exactly 1:00 minute
3. **At 1:00:** Move mouse OR press a key
4. Watch for toast

**Verify:**
- [ ] No toast appears (activity reset the timer)
- [ ] Timer starts over from 0

**Console Check:**
- [ ] See log: `[SessionContext] Activity detected, resetting idle timer`
- [ ] See log: `idleSeconds: 0`
- [ ] Timestamp shows recent activity logged

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.5: Activity Cancels Banner (Mid-Reset)
**Steps:**
1. Open app, start idle timer
2. Let it reach 2:15 (15 seconds after toast)
3. **At 2:15:** Move mouse OR press a key
4. Toast and/or banner should disappear

**Verify:**
- [ ] If banner hasn't appeared yet: Toast disappears
- [ ] If banner appeared: Banner disappears
- [ ] Timer resets to 0
- [ ] Can continue using app normally

**Console Check:**
- [ ] See log: `[SessionContext] Activity detected, resetting idle timer`
- [ ] See log: `idleSeconds: 0`

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.6: Activity Doesn't Cancel Modal (Too Late)
**Steps:**
1. Open app, start idle timer
2. Let it reach 3:00 (modal appears)
3. **At 3:00:** Try to move mouse, click buttons, anything
4. Observe: Modal should not disappear, UI should be blocked

**Verify:**
- [ ] Modal remains on screen
- [ ] Cannot click anything outside modal
- [ ] Cannot dismiss modal by normal actions
- [ ] Only way out: Click OK or "Re-authenticate" button

**Console Check:**
- [ ] Activity still logged (mouse/keyboard events still firing)
- [ ] But modal not dismissed

**Result:** ✅ PASS / ❌ FAIL

---

## Test Suite 2: 401 Authentication Error Handling (CRITICAL)

### Test 2.1: Single 401 Error Shows One Banner
**Setup:** Backend invalidated or service bus credentials wrong

**Steps:**
1. Open app, enter WRONG or EXPIRED Service Bus connection string
2. Click "Connect"
3. **EXPECTED:** Gets 401 error

**Verify:**
- [ ] ONE red error banner appears at top
- [ ] Banner says something about "Authentication failed" or "Unauthorized"
- [ ] Red/error color
- [ ] NO duplicate banners

**Console Check:**
- [ ] See exactly ONE log: `[ApiClient] ⚠️  401 Unauthorized on /api/...`
- [ ] See exactly ONE log: `[ApiClient] Credentials cleared due to 401`
- [ ] See exactly ONE throw: `AuthError`
- [ ] NO logs about "Refresh already in progress" (would indicate duplicates)

**Network Tab Check:**
- [ ] See ONE failed request with 401 status
- [ ] NO retries of the same request
- [ ] NO attempts to call `/api/refresh` or similar

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.2: Single 401 Error Shows One Auth Modal
**Prerequisites:** Connected to backend but got 401

**Steps:**
1. Continue from Test 2.1
2. Look for auth/login modal appearing (may be delayed 1-2 seconds)
3. **EXPECTED:** ONE modal appears asking to re-authenticate

**Verify:**
- [ ] ONE auth modal appears (not multiple)
- [ ] Modal has login form or re-auth button
- [ ] Modal blocks rest of UI
- [ ] Modal is dismissible only by proper authentication

**Console Check:**
- [ ] See log: `[SessionContext] Error: <AuthError>`
- [ ] See log: `[App] Showing auth modal`
- [ ] NO duplicate logs of same message

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.3: 401 Banner Persists Until Re-Auth
**Prerequisites:** Completed Test 2.2 (auth modal showing)

**Steps:**
1. Continue from Test 2.2
2. Look at banner - should still be visible
3. Try clicking elsewhere on UI
4. **Expected:** Cannot interact with rest of app until auth completes

**Verify:**
- [ ] Red error banner still visible
- [ ] Auth modal still visible
- [ ] Cannot click on queue list, messages, etc.
- [ ] Can only interact with auth modal

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.4: After Re-Auth, Banner Disappears
**Prerequisites:** Auth modal visible with re-auth form

**Steps:**
1. Click "Re-authenticate" button or complete login
2. Enter CORRECT Service Bus connection string
3. Click "Connect"
4. **EXPECTED:** Connected successfully

**Verify:**
- [ ] Red error banner DISAPPEARS
- [ ] Auth modal DISAPPEARS
- [ ] App goes back to normal UI
- [ ] Can select queues and interact normally

**Console Check:**
- [ ] See log: `[SessionContext] Connection re-established`
- [ ] See log: `status: 'connected'`
- [ ] No new errors

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.5: No Infinite Spinner on 401
**Steps:**
1. Trigger 401 again (wrong credentials)
2. **CRITICAL:** Watch for infinite "Reconnecting..." spinner
3. Should see error UI, not spinner

**Verify:**
- [ ] Red banner appears immediately
- [ ] NO spinning loading indicator
- [ ] NO "Reconnecting... attempt 1/5" message
- [ ] Modal appears cleanly

**Console Check:**
- [ ] NO logs about "reconnect attempt"
- [ ] NO logs about "retrying"
- [ ] Clean, single error throw

**Result:** ✅ PASS / ❌ FAIL

---

## Test Suite 3: Reconnect with Exponential Backoff (IMPORTANT)

### Test 3.1: Reconnect Shows Attempt Counter
**Setup:** Connected successfully, then backend goes down

**Steps:**
1. Open app, connect to valid namespace
2. View a queue with some messages
3. **Gracefully stop backend:**
   - Terminal running backend: `Ctrl+C`
   - OR: kill the process
4. Try to refresh messages or make an API call
5. **EXPECTED:** Should see "Reconnecting..." message with attempt counter

**Verify:**
- [ ] See message like "Reconnecting... attempt 1/5"
- [ ] Counter shows current attempt and max attempts
- [ ] Message updates for each retry (1/5, 2/5, etc.)
- [ ] Attempts happen with pauses between (not rapid-fire)

**Console Check:**
- [ ] See logs: `[SessionContext] Reconnecting... attempt X/5`
- [ ] See logs with increasing delays: 500ms, 1000ms, 2000ms, 4000ms, 8000ms
- [ ] Proper exponential backoff

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3.2: After 5 Attempts, Shows Error
**Prerequisites:** Completed Test 3.1, backend still down

**Steps:**
1. Continue from Test 3.1
2. Watch as it attempts 5 times (2-3 seconds total)
3. **EXPECTED:** After 5 failed attempts, shows permanent error

**Verify:**
- [ ] Stops at attempt 5/5
- [ ] Does NOT keep retrying infinitely
- [ ] Shows error message: "Failed to connect to service"
- [ ] Shows button like "Retry" or "Change connection"

**Console Check:**
- [ ] See log: `[SessionContext] Reconnect failed after 5 attempts`
- [ ] NO more reconnect logs after this

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3.3: Backend Comes Back Online, Auto-Reconnects
**Prerequisites:** Backend is down, app shows error

**Steps:**
1. Continue from Test 3.2 (backend down, error showing)
2. **Restart backend:**
   ```bash
   # Terminal: dotnet watch run --project src/ServiceBusInspectorApi/ServiceBusInspectorApi.csproj
   # OR: ./start-backend.sh
   ```
3. Wait 1-2 seconds
4. **EXPECTED:** App reconnects automatically

**Verify:**
- [ ] Within 1-2 seconds, error message disappears
- [ ] Back to normal UI
- [ ] Can interact with queues again
- [ ] State restored (same queue still selected if you were viewing one)

**Console Check:**
- [ ] See log: `[SessionContext] Reconnecting...`
- [ ] See log: `[SessionContext] Connected successfully`
- [ ] status changes from 'disconnected' to 'connected'

**Result:** ✅ PASS / ❌ FAIL

---

## Test Suite 4: State Restoration After Reconnect (IMPORTANT)

### Test 4.1: Queue Selection Preserved
**Setup:** Connected successfully

**Steps:**
1. In queue list on left, click to select a specific queue
2. Verify queue is highlighted/selected
3. Trigger reconnect:
   - Disable network: Open DevTools → Network tab → Right-click → Offline
   - Wait 2-3 seconds
   - Re-enable network
4. **EXPECTED:** Same queue still selected

**Verify:**
- [ ] During offline: Reconnecting message shows
- [ ] After reconnect: Same queue is still highlighted
- [ ] NO automatic switching to different queue
- [ ] Messages from that queue still loading

**Console Check:**
- [ ] See log showing queue selection persisted
- [ ] No errors about "queue selection lost"

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.2: Message Filters Preserved
**Setup:** Queue selected with messages showing

**Steps:**
1. Apply a filter to messages:
   - Example: Select "DLQ only" or "Last 24 hours"
   - Verify filtered results shown
2. Trigger reconnect (offline mode again)
3. **EXPECTED:** Same filters still applied

**Verify:**
- [ ] Filters still active in filter UI
- [ ] Messages still match filter criteria
- [ ] NO automatic clearing of filters
- [ ] Correct message count matches filter

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.3: Scroll Position Preserved
**Setup:** Queue selected with messages showing

**Steps:**
1. Scroll down in message list (at least 5+ items down)
2. Note your scroll position
3. Trigger reconnect (offline → online)
4. **EXPECTED:** Same scroll position when reconnected

**Verify:**
- [ ] After reconnect, you're at same scroll position
- [ ] NO automatic scroll to top
- [ ] NO losing your place in message list

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.4: Auto-Refresh State Preserved
**Setup:** Auto-refresh enabled, messages loading periodically

**Steps:**
1. Enable auto-refresh (if button exists, enable it)
2. Verify messages updating every N seconds
3. Trigger reconnect
4. **EXPECTED:** Auto-refresh still running

**Verify:**
- [ ] After reconnect, messages still auto-updating
- [ ] NO need to manually re-enable auto-refresh
- [ ] Refresh continues at same interval

**Result:** ✅ PASS / ❌ FAIL

---

## Test Suite 5: UI Stability (Important)

### Test 5.1: No Layout Jitter
**Steps:**
1. Open app normally
2. Perform all major actions:
   - Connect to service bus
   - Select different queues
   - Refresh message list
   - Trigger reconnect
3. Watch carefully for layout shifts

**Verify:**
- [ ] No sudden shifts in layout
- [ ] Banners appear smoothly
- [ ] Modals appear centered
- [ ] Content doesn't jump around
- [ ] Text doesn't get cut off

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5.2: No Duplicate Banners
**Steps:**
1. Trigger an auth error (401)
2. Watch banner appear
3. **CRITICAL:** Look carefully - is there only ONE banner?

**Verify:**
- [ ] See exactly ONE error banner
- [ ] NO duplicate banners stacked on top of each other
- [ ] NO multiple "Error" messages
- [ ] NO duplicate modals

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5.3: No Frozen UI
**Steps:**
1. Perform normal operations:
   - Connect
   - Select queues
   - Refresh messages
   - Trigger reconnect
2. Watch for UI responsiveness

**Verify:**
- [ ] Buttons respond immediately when clicked
- [ ] NO delays or freezing
- [ ] Typing in text fields is responsive
- [ ] Scrolling is smooth
- [ ] NO spinner showing while doing normal operations

**Result:** ✅ PASS / ❌ FAIL

---

## Test Suite 6: Browser Console Verification (TECHNICAL)

### Test 6.1: No Stale Timer Warnings
**Steps:**
1. Open DevTools Console
2. Perform reconnect operations
3. Look for warnings about "stale timers"

**Verify:**
- [ ] NO warnings about "multiple timers"
- [ ] NO warnings about "timer already exists"
- [ ] Logs should be clean and organized

**Console Pattern - GOOD:**
```
[SessionContext] Reconnecting... attempt 1/5
[SessionContext] Clear all timers
[SessionContext] Register new idle timer
[SessionContext] Register new reconnect timer
[SessionContext] Connected successfully
```

**Console Pattern - BAD (What we're avoiding):**
```
[SessionContext] Timer "idleTimer" already exists!
[SessionContext] Multiple idle timers detected!
```

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6.2: No Duplicate Event Listeners
**Steps:**
1. Open DevTools
2. Go to Sources tab
3. Perform idle/reconnect operations
4. Check Memory tab for event listener leaks

**Verify:**
- [ ] Only ONE listener for each event type:
  - [ ] mousemove: 1 listener
  - [ ] keydown: 1 listener
  - [ ] scroll: 1 listener
- [ ] NO increasing count of listeners on repeated actions

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6.3: No Auth Refresh Loop Messages
**Steps:**
1. Trigger 401 error
2. Watch console closely

**Verify:**
- [ ] NO logs about "Refresh already in progress"
- [ ] NO logs about "Attempting token refresh"
- [ ] NO repeated "401" messages from retries
- [ ] Single clean error flow

**Console Pattern - GOOD:**
```
[ApiClient] ⚠️  401 Unauthorized on /api/... - NO AUTO-RETRY
[ApiClient] Credentials cleared due to 401
[SessionContext] AuthError caught
[App] Showing auth modal
```

**Console Pattern - BAD:**
```
[ApiClient] ⚠️  401 Unauthorized
[ApiClient] Refresh already in progress, waiting...
[ApiClient] ⚠️  401 Unauthorized
[ApiClient] Refresh already in progress, waiting...
```

**Result:** ✅ PASS / ❌ FAIL

---

## Summary & Sign-Off

### Test Results Grid
| Test | Result | Notes |
|------|--------|-------|
| 1.1 - Idle toast 2:00 | ✅ / ❌ | |
| 1.2 - Idle banner 2:30 | ✅ / ❌ | |
| 1.3 - Session modal 3:00 | ✅ / ❌ | |
| 1.4 - Activity cancels toast | ✅ / ❌ | |
| 1.5 - Activity cancels banner | ✅ / ❌ | |
| 1.6 - Activity doesn't cancel modal | ✅ / ❌ | |
| 2.1 - Single 401 banner | ✅ / ❌ | |
| 2.2 - Single auth modal | ✅ / ❌ | |
| 2.3 - Banner persists until auth | ✅ / ❌ | |
| 2.4 - Banner gone after re-auth | ✅ / ❌ | |
| 2.5 - No infinite spinner | ✅ / ❌ | |
| 3.1 - Reconnect attempt counter | ✅ / ❌ | |
| 3.2 - Error after 5 attempts | ✅ / ❌ | |
| 3.3 - Auto-reconnect when back | ✅ / ❌ | |
| 4.1 - Queue selection preserved | ✅ / ❌ | |
| 4.2 - Message filters preserved | ✅ / ❌ | |
| 4.3 - Scroll position preserved | ✅ / ❌ | |
| 4.4 - Auto-refresh preserved | ✅ / ❌ | |
| 5.1 - No layout jitter | ✅ / ❌ | |
| 5.2 - No duplicate banners | ✅ / ❌ | |
| 5.3 - No frozen UI | ✅ / ❌ | |
| 6.1 - No stale timer warnings | ✅ / ❌ | |
| 6.2 - No duplicate listeners | ✅ / ❌ | |
| 6.3 - No refresh loop messages | ✅ / ❌ | |

### Overall Result
- **Total Tests:** 24
- **Passed:** ___ / 24
- **Failed:** ___ / 24
- **Status:** ✅ ALL PASS / ⚠️ NEEDS FIXES / ❌ CRITICAL ISSUES

### Sign-Off
Tested by: ________________
Date: ________________
Time: ________________
Environment: Development / Staging / Production

**Note:** All tests should pass. If any test fails, investigate and report the specific failure.
