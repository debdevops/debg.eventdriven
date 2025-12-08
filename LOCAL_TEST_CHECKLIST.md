╔══════════════════════════════════════════════════════════════════════════════╗
║                    🧪 COMPREHENSIVE LOCAL TEST CHECKLIST                     ║
║         Session Management, Idle Detection, Reconnect & Auth Flows           ║
╚══════════════════════════════════════════════════════════════════════════════╝

## ✅ PRE-TEST SETUP (BEFORE TESTING)

### 1. Services Running
```bash
# Check if services are running
curl -s https://localhost:7001/health
# Should show: {"status":"healthy","timestamp":"..."}

curl -s http://localhost:5173/ | head -5
# Should load the frontend without errors
```

**Status**: [ ] Backend responding [ ] Frontend loading

### 2. Browser Console Clean
- Open DevTools (F12 or Cmd+Shift+I)
- Clear console (Ctrl+Shift+K)
- Go to Application → Local Storage → Clear All
- Go to Application → Cookies → Clear All

**Status**: [ ] Console clean [ ] Storage cleared

### 3. Connect to Namespace
1. Click "Add Namespace"
2. Enter Key Vault Name (e.g., `kv-inspector-local-dg`)
3. Click "Connect"
4. Wait for connection
5. See entities loaded

**Status**: [ ] Connected [ ] Entities visible

---

## 🔬 TEST 1: IDLE DETECTION FLOW (CRITICAL)

**Objective**: Verify idle detection triggers warnings at correct thresholds

**Duration**: 5 minutes

### Test Steps:

1. **T+0 min (No warnings)**
   - [ ] Open the app with namespace connected
   - [ ] Select a queue/topic to view messages
   - [ ] Move mouse frequently
   - **Expected**: No toast, no banner, no modal

2. **T+2 min (Toast warning)**
   - [ ] STOP interacting (don't move mouse, type, scroll)
   - [ ] Wait exactly 2 minutes
   - **Expected**: 
     - Toast appears: "⏱️ Session will expire due to inactivity..."
     - No banner or modal yet
     - Can still interact with UI

3. **T+2:30 min (Amber banner)**
   - [ ] Continue idle
   - [ ] Wait 30 more seconds (total 2:30 min)
   - **Expected**:
     - Toast still visible
     - Amber banner appears below TopBar
     - Banner is non-blocking (can scroll behind it)
     - No modal yet

4. **T+3 min (Modal appears)**
   - [ ] Continue idle
   - [ ] Wait 30 more seconds (total 3 min)
   - **Expected**:
     - Toast disappears
     - Banner disappears
     - Red modal: "Session Expired" with 2 buttons
     - UI is frozen (can't interact with entities)
     - Modal shows: "Reconnect" (primary) and "Switch Namespace" (secondary)

5. **T+2 min - User activity resets everything**
   - [ ] Move mouse
   - **Expected**:
     - Toast disappears immediately
     - Banner disappears (if shown)
     - Modal dismisses
     - Timer resets to 0 (watch console: `idleSeconds`)
     - Can interact normally

### Console Verification:
```javascript
// Open DevTools Console and look for:
[Session] User activity detected
[Session] User became idle
[Session] Idle warning triggered
[Session] Critical idle - showing modal
```

### Visual Checklist:
- [ ] Toast text is clear and readable
- [ ] Toast disappears after user activity
- [ ] Banner color is amber (not red)
- [ ] Banner appears smooth (no flicker)
- [ ] No layout shift when banner appears/disappears
- [ ] Modal is centered and readable
- [ ] Modal buttons are responsive

---

## 🔌 TEST 2: RECONNECT FLOW (CRITICAL)

**Objective**: Verify reconnect with exponential backoff works correctly

**Duration**: 10 minutes

### Setup:
1. Connect to namespace and select a queue
2. Open DevTools Network tab
3. Open DevTools Console

### Test Steps:

1. **Manual Reconnect (Normal)**
   - [ ] App is connected and working
   - [ ] In Console, run: `document.querySelector('[title*="Reconnect"]')?.click()`
   - **Expected**:
     - "Reconnecting... (attempt 1/5)" toast appears
     - No network errors
     - After 1-2 seconds: "✓ Reconnected successfully!" toast
     - Previous queue/topic still selected
     - Messages reload

2. **Idle → Modal Reconnect**
   - [ ] Wait 3 min until modal appears
   - [ ] Click "Reconnect" button in modal
   - **Expected**:
     - Button shows spinner icon
     - Toast: "Reconnecting... (attempt 1/5)"
     - Modal stays visible
     - After 1-2 sec: "✓ Reconnected successfully!" toast
     - Modal closes
     - Queue/messages still visible

3. **Network Failure → Exponential Backoff**
   - [ ] DevTools Network tab → toggle "Throttling" to "Offline"
   - [ ] Wait 3 min until modal appears
   - [ ] Click "Reconnect"
   - **Expected**:
     - Attempt 1 (500ms): Fails, toast shows
     - Attempt 2 (1s): Fails, toast updates
     - Attempt 3 (2s): Fails, toast updates
     - Attempt 4 (4s): Fails, toast updates
     - Attempt 5 (8s): Fails, error shown in red banner
   - [ ] Re-enable network
   - [ ] Click Reconnect again
   - [ ] Should succeed on first attempt (no backoff delay)

4. **State Restoration After Reconnect**
   - [ ] Connect to namespace
   - [ ] Select Queue A
   - [ ] Load some messages
   - [ ] Idle 3 min → Modal
   - [ ] Click Reconnect
   - **Expected**:
     - Queue A still selected (not deselected)
     - Messages reload (spinner visible briefly)
     - Filters/search still apply
     - Auto-refresh mode preserved

### Console Verification:
```
Look for messages like:
[Session] RECONNECT FLOW START
[Session] Attempt 1/5: Reconnecting...
[Session] ✓ Reconnect SUCCESS on attempt X
[Session] RECONNECT FLOW END (SUCCESS)

OR on failure:
[Session] ✗ RECONNECT FAILED after all attempts
```

### Checkpoint:
- [ ] Backoff delays visible (1-2s for attempt 1, then longer)
- [ ] No duplicate toasts (clean re-render)
- [ ] No invisible errors in console (check for red errors)
- [ ] Modal can be dismissed and re-triggered

---

## 🔐 TEST 3: 401 AUTH ERROR HANDLING (CRITICAL)

**Objective**: Verify 401 errors trigger token refresh and show proper banner

**Duration**: 5 minutes

### Setup:
1. Connect to namespace normally
2. Open Console and Network tabs

### Test Steps:

1. **Simulate 401 Response**
   - [ ] In Console, set up to block requests (this is for testing UI behavior)
   - [ ] Delete stored credentials in localStorage
   - [ ] Try to navigate to a different queue
   - **Expected**:
     - Toast: "Authentication failed..."
     - Red error banner appears below TopBar
     - Banner shows: "🔐 Authentication Failed" | "Reconnect" | "✕"

2. **Auth Error Banner Appearance**
   - [ ] Verify red banner has:
     - Red gradient background
     - Clear error message
     - "Reconnect" button (white background)
     - Dismiss button (X)
     - Timestamp
     - Status code (401)
   - [ ] Try to click buttons - should not work (or show loading)

3. **Reconnect from Auth Banner**
   - [ ] Click "Reconnect" button in banner
   - **Expected**:
     - Button shows spinner/loading state
     - Toast: "Reconnecting... (attempt 1/5)"
     - After success: Banner disappears automatically
     - Toast: "✓ Reconnected successfully!"
     - Entities reload

4. **Dismiss Auth Banner**
   - [ ] Force another 401 scenario
   - [ ] Click "✕" (dismiss) button
   - **Expected**:
     - Banner slides up and disappears smoothly
     - No animation jitter
     - Toast gone

5. **Banner Auto-Clear**
   - [ ] Force 401 error (banner appears)
   - [ ] Click Reconnect and wait for success
   - **Expected**:
     - Banner auto-dismisses (no need to click X)
     - All errors cleared

### Visual Checklist:
- [ ] Red banner doesn't cause layout shift
- [ ] Banner appears smooth (no flicker)
- [ ] Text is readable and white
- [ ] Buttons are properly styled
- [ ] No overlap with other UI elements
- [ ] Banner can be scrolled over if content is long

---

## 🗺️ TEST 4: NAVIGATION BETWEEN ENTITIES (CRITICAL)

**Objective**: Verify no 401 errors when switching queues/topics after reconnect

**Duration**: 10 minutes

### Setup:
1. Connect to namespace with multiple queues/topics
2. Open Console

### Test Steps:

1. **Navigate Between Queues (No Idle)**
   - [ ] Click Queue A → load messages
   - [ ] Click Queue B → load messages
   - [ ] Click Queue C → load messages
   - [ ] Repeat 3-5 times
   - **Expected**:
     - No 401 errors in console
     - No red banner
     - Messages load cleanly
     - No "stale session" messages

2. **Navigate After Reconnect**
   - [ ] Connected to Queue A
   - [ ] Wait 3 min → Modal
   - [ ] Click Reconnect
   - [ ] After success, click Queue B
   - [ ] Then click Queue C
   - [ ] Then click Topic D → subscriptions
   - **Expected**:
     - No 401 errors
     - All entities load correctly
     - Messages visible immediately
     - No "Authentication failed after token refresh" errors

3. **Rapid Navigation**
   - [ ] Queue A → Queue B → Queue A → Topic C (rapid clicks)
   - [ ] After reconnect, same rapid clicks
   - **Expected**:
     - No race conditions
     - Last selected entity loads correctly
     - No orphaned loaders/spinners

4. **Navigate to DLQ (Dead Letter)**
   - [ ] Click on a Queue
   - [ ] Look for "View DLQ" or similar button
   - [ ] Click to view Dead Letter messages
   - [ ] Back to main queue
   - [ ] After reconnect, try same DLQ flow
   - **Expected**:
     - DLQ loads and displays
     - No 401 errors
     - DLQ refreshes after reconnect

5. **Subscription Navigation**
   - [ ] Click Topic
   - [ ] Expand topic to see subscriptions
   - [ ] Click subscription
   - [ ] View subscription messages
   - [ ] Click another subscription
   - **Expected**:
     - Subscriptions load cleanly
     - Messages display correctly
     - No 401 errors

### Console Check:
```
Should NOT see:
- "Authentication failed after token refresh"
- Multiple "401" errors
- "Failed to load subscriptions" (unless actual backend error)

Should see:
- Successful message loads
- Timer and idle state logs (if enabled)
```

---

## ⏱️ TEST 5: SESSION TIMEOUT BEHAVIOR

**Objective**: Verify session expires gracefully after 3 minutes idle

**Duration**: 5 minutes

### Test Steps:

1. **UI Becomes Read-Only After Modal**
   - [ ] Idle 3 min → Modal shows
   - [ ] Try to scroll messages (if any shown)
   - [ ] Try to click buttons
   - **Expected**: UI should be unresponsive to entity clicks (modal is blocking)

2. **Reconnect Restores Interactivity**
   - [ ] Modal open
   - [ ] Click Reconnect
   - [ ] After success, try to click entities
   - **Expected**: UI fully interactive again

3. **Auto-Refresh Preserves After Reconnect**
   - [ ] Enable auto-refresh on messages (Stream mode)
   - [ ] Idle 3 min → Modal
   - [ ] Reconnect
   - **Expected**: Auto-refresh resumes (spinner visible if new messages)

---

## 🎨 TEST 6: UI SMOOTHNESS & NO JITTER

**Objective**: Verify no layout shifts, flicker, or scroll resets

**Duration**: 5 minutes

### Test Steps:

1. **Banner Appearance (Toast → Banner → Modal)**
   - [ ] Watch the screen as idle warnings appear
   - [ ] Measure visual shift distance
   - **Expected**:
     - Toast appears, shifts nothing
     - Banner appears, shifts main content down slightly (smooth animation)
     - Modal appears centered (no shift)
     - Modal dismisses (smooth animation)

2. **Sidebar Scroll Position**
   - [ ] Select Queue with many entities
   - [ ] Scroll sidebar down (see bottom entities)
   - [ ] Idle 3 min → Modal
   - [ ] Reconnect
   - [ ] Modal closes
   - **Expected**:
     - Sidebar scroll position preserved
     - Not jumped back to top
     - Smooth transition

3. **Message Panel Scroll**
   - [ ] Select Queue
   - [ ] Scroll messages down
   - [ ] Idle 3 min → Reconnect
   - **Expected**:
     - Message scroll position might reset (OK, messages re-fetch)
     - But no jitter or flicker
     - Smooth reload

4. **Button State Transitions**
   - [ ] Hover over buttons during idle
   - [ ] Click buttons during reconnect
   - **Expected**:
     - Smooth hover effects
     - No rapid state changes
     - Loading spinners appear smoothly

---

## 📊 TEST 7: TIMER & MEMORY INTEGRITY

**Objective**: Verify no duplicate timers, memory leaks, or stale listeners

**Duration**: 5 minutes

### Test Steps:

1. **Check for Duplicate Timers**
   - [ ] Reconnect 3 times in a row
   - [ ] Open DevTools → Performance tab → Memory
   - [ ] Take heap snapshot
   - **Expected**:
     - No huge memory growth
     - No hundreds of interval timers
     - Timer count should be ~3-5 (heartbeat, idle check, etc.)

2. **Event Listener Leak Test**
   - [ ] Right-click page → Inspect
   - [ ] In Console: `getEventListeners(document).mousemove?.length`
   - [ ] Reconnect 3 times
   - [ ] Check listener count again
   - **Expected**:
     - Count stays relatively stable
     - Not growing (should be <10)

3. **Console for Cleanup Logs**
   - [ ] Open Console
   - [ ] Disconnect and reconnect namespace
   - [ ] Watch for cleanup messages:
   ```
   [Session] Clearing X timers
   [Session] ✓ Timers cleared
   ```
   - **Expected**: Cleanup logs appear consistently

---

## ✨ TEST 8: MESSAGE DETAIL PANEL PERSISTENCE

**Objective**: Verify message detail panel survives reconnect

**Duration**: 5 minutes

### Test Steps:

1. **Open Message Detail**
   - [ ] Queue with messages
   - [ ] Click a message to open detail panel
   - [ ] Message content shows

2. **Idle → Reconnect → Panel Still Open**
   - [ ] Detail panel open
   - [ ] Idle 3 min → Reconnect
   - [ ] After success, detail panel should still be open
   - **Expected**:
     - Message detail visible
     - Can read full message content
     - Can close detail panel

3. **Close & Reopen After Reconnect**
   - [ ] Open detail panel
   - [ ] Close it
   - [ ] Idle → Reconnect
   - [ ] Click another message
   - **Expected**:
     - New message detail opens cleanly
     - No leftover state from previous message

---

## 🎯 FINAL VALIDATION CHECKLIST

### Functional Tests
- [ ] **Idle Detection**: Toast (2:00) → Banner (2:30) → Modal (3:00)
- [ ] **Reconnect**: Exponential backoff works, state restored
- [ ] **Auth Errors**: Red banner shows, reconnect clears it
- [ ] **Navigation**: No 401 errors between entities
- [ ] **State**: Selection, filters, auto-refresh preserved
- [ ] **Message Panel**: Continues working after reconnect

### UI Tests
- [ ] **Smooth Animations**: No flicker, no jitter
- [ ] **Layout Stability**: No shift when banners appear/disappear
- [ ] **Responsive**: Buttons, dropdowns work during state changes
- [ ] **Accessible**: Error messages clear, buttons labeled

### Performance Tests
- [ ] **Memory**: No unbounded growth
- [ ] **Timers**: Properly cleaned up (no duplicates)
- [ ] **Network**: No duplicate requests
- [ ] **CPU**: No spinning loops or high CPU usage

### Browser Console
- [ ] **No Red Errors**: All errors are logged intentionally
- [ ] **Warnings OK**: CSS warnings are non-critical
- [ ] **Logs Clean**: Session logs are informative (not noise)

---

## 🐛 TROUBLESHOOTING GUIDE

### Issue: Modal never appears
**Solution**:
```javascript
// Force idle state in Console:
document.querySelector('[role="dialog"]')
// Should show modal element
```

### Issue: Reconnect never succeeds
**Solution**:
1. Check backend: `curl https://localhost:7001/health`
2. Check browser console for actual error
3. Reload page and try again

### Issue: Layout shifts when banner appears
**Solution**:
- Check App.css `.main-content` is using `overflow: hidden`
- Verify AuthErrorBanner position is `fixed` (not relative)

### Issue: 401 error but no red banner
**Solution**:
1. Check if error is auth-related
2. Verify App.tsx has `{error && error.isAuthError && showAuthError && ...}`
3. Check sessionState has `auth_failed` status

### Issue: Session expires too quickly
**Solution**:
- Idle threshold is 120 seconds (2 minutes)
- Make sure mouse is truly not moving
- Check system might have auto-motion script

---

## 📝 REPORT TEMPLATE

After running tests, fill in:

```
TEST RUN REPORT
═══════════════

Date: ___________
Tester: _________
Browser: ________

RESULTS:
✓ Idle Detection: [ ] PASS [ ] FAIL
✓ Reconnect Flow: [ ] PASS [ ] FAIL
✓ Auth Handling: [ ] PASS [ ] FAIL
✓ Navigation: [ ] PASS [ ] FAIL
✓ UI Smoothness: [ ] PASS [ ] FAIL
✓ Memory Integrity: [ ] PASS [ ] FAIL
✓ Message Panel: [ ] PASS [ ] FAIL
✓ Performance: [ ] PASS [ ] FAIL

OVERALL: [ ] ALL PASS [ ] SOME FAILURES [ ] CRITICAL FAILURES

Notes:
_____________________________________________________________________
_____________________________________________________________________
```

---

✅ **Testing Complete!**

All tests passing = READY FOR PRODUCTION

