# Testing Guide - UI Improvements

## Prerequisites
- Azure Service Bus namespace configured
- Backend API running (port 7001)
- Frontend running (port 5173)
- At least one queue with some test messages

## Setup Steps

### 1. Start Backend
```bash
cd /Users/debasisghosh/Github/debg.eventdriven
./start-backend.sh

# OR manually:
cd src/ServiceBusInspectorApi
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```

**Expected Output:**
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7001
```

### 2. Start Frontend
```bash
cd /Users/debasisghosh/Github/debg.eventdriven
./start-frontend.sh

# OR manually:
cd src/ui
npm run dev
```

**Expected Output:**
```
VITE v5.4.21  ready in 176 ms
➜  Local:   http://localhost:5173/
```

### 3. Send Test Messages (Optional)
```bash
cd scripts
npm install  # First time only
node send-sample-messages.js test-queue 10
```

**Expected Output:**
```
✅ Sent 10 messages to test-queue
```

## Test Scenarios

### Test 1: Auto-Loading Messages ✅
**Goal:** Verify messages load automatically without clicking Peek/Stream

**Steps:**
1. Open `http://localhost:5173/` in browser
2. Click **"+ Add Namespace"**
3. Enter connection string and click **Connect**
4. Click on any **queue** in the left sidebar

**Expected Result:**
- ✅ Messages appear **immediately** (no need to click Peek)
- ✅ Loading skeleton shows briefly (animated gray rows)
- ✅ Messages populate the grid within 1-2 seconds
- ✅ Last updated timestamp appears: "Last updated: 10:45:23 AM"

**What to Check:**
- No blank screen or "Click Peek to view messages" message
- Skeleton animation is smooth (pulsing gray boxes)
- Grid shows messages with correct data (ID, Seq#, Enqueued time, etc.)

---

### Test 2: Disabled Buttons with Tooltips ✅
**Goal:** Verify Peek/Stream/Compare buttons are disabled with explanatory tooltips

**Steps:**
1. After messages load, hover over the **"👁️ Peek"** button

**Expected Result:**
- ✅ Button appears **grayed out** (50% opacity)
- ✅ Cursor shows **"not-allowed"** icon
- ✅ Tooltip displays: **"Auto-load enabled - Messages refresh automatically every 10 seconds"**

**Repeat for Other Buttons:**
- **"📡 Stream"** → Tooltip: "Auto-load enabled - Live streaming not needed with auto-refresh"
- **"⚖️ Compare"** → Tooltip: "Auto-load enabled - Compare feature temporarily disabled"

---

### Test 3: Auto-Refresh Indicator ✅
**Goal:** Verify auto-refresh indicator shows refresh status

**Steps:**
1. After messages load, observe the **"🔄 Auto"** badge (top-right of header)
2. Wait 10 seconds

**Expected Result:**
- ✅ Badge shows **blue background** with "🔄 Auto" text
- ✅ Every 10 seconds, the 🔄 icon **rotates/pulses**
- ✅ "Last updated" timestamp **updates** (e.g., "10:45:33 AM")
- ✅ **(refreshing...)** text appears briefly during refresh

**What to Check:**
- No full-screen spinner or loading overlay during background refresh
- Grid doesn't flicker or jump
- Scroll position is preserved

---

### Test 4: Manual Refresh Button ✅
**Goal:** Verify manual refresh works on demand

**Steps:**
1. Click the **"🔄 Refresh"** button (right side of header)

**Expected Result:**
- ✅ "Last updated" timestamp updates **immediately**
- ✅ Button shows **disabled state** briefly (during fetch)
- ✅ New messages appear if any were added to the queue

---

### Test 5: Pause/Resume Auto-Refresh ✅
**Goal:** Verify freeze/unfreeze functionality

**Steps:**
1. Click the **"⏸️ Pause"** button
2. Wait 10 seconds
3. Observe that "Last updated" timestamp **does NOT update**
4. Click **"▶️ Resume"** button

**Expected Result:**
- ✅ When paused:
  - "🔄 Auto" indicator **disappears**
  - No background refreshes occur
  - Timestamp stays frozen
- ✅ When resumed:
  - "🔄 Auto" indicator **reappears**
  - **Immediate refresh** happens
  - Timestamp updates
  - Auto-refresh resumes every 10 seconds

---

### Test 6: Page Visibility API (Tab Switching) ✅
**Goal:** Verify refresh pauses when tab hidden, resumes when visible

**Steps:**
1. With messages loaded, note the "Last updated" timestamp
2. Switch to **another browser tab** (e.g., Gmail, YouTube)
3. Wait **15-20 seconds**
4. Switch **back** to Service Bus Inspector tab

**Expected Result:**
- ✅ While tab was hidden:
  - Timestamp did **NOT update** (refresh was paused)
  - No network requests in DevTools (check Network tab)
- ✅ When tab becomes visible:
  - **Immediate refresh** happens
  - Timestamp updates to current time
  - Auto-refresh resumes every 10 seconds

**How to Verify (Advanced):**
1. Open **Chrome DevTools** (F12)
2. Go to **Network** tab
3. Filter by **"peek"** or **"messages"**
4. Switch tabs and watch requests stop/resume

---

### Test 7: DLQ Clarification Banner ✅
**Goal:** Verify DLQ shows warning banner explaining purpose

**Steps:**
1. Click on a **queue** in the left sidebar
2. Click the **"DLQ"** checkbox/toggle (if available) OR
3. Select a queue's dead-letter queue from the sidebar

**Expected Result:**
- ✅ **Yellow warning banner** appears below header:
  - Icon: 💀
  - Title: **"Dead Letter Queue"**
  - Text: "Messages here failed delivery or expired. DLQ contains only rejected messages, not active queue messages. Use Replay to move messages back to the main queue."

**What to Check:**
- Banner appears **only for DLQ**, not regular queues
- Text is clear and informative
- "Replay" action hint is visible

---

### Test 8: Loading Skeleton (Initial Load) ✅
**Goal:** Verify skeleton loader shows on first load, not during refresh

**Steps:**
1. Connect to namespace and click a queue
2. **Immediately observe** the message grid area
3. Wait for messages to load
4. Wait 10 seconds for auto-refresh

**Expected Result:**
- ✅ On **initial load**:
  - Skeleton shows **5 animated gray rows**
  - Header, search bar, and table structure visible
  - Smooth pulsing animation (left-to-right gradient)
- ✅ On **auto-refresh** (after 10s):
  - **NO skeleton** appears
  - **NO loading overlay**
  - Messages update silently in background

---

### Test 9: Layout and Spacing ✅
**Goal:** Verify compact layout with minimal whitespace

**Steps:**
1. Load a queue with messages
2. Measure vertical spacing between components

**Expected Result:**
- ✅ **Queue name header** → Metrics panel: **0px gap** (no margin)
- ✅ **Metrics panel** → Last updated bar: **0px gap**
- ✅ **Last updated bar** → Message grid: **0px gap**
- ✅ Message grid is **immediately visible** (no need to scroll 60% down)

**Visual Check:**
- Components are tightly stacked
- No excessive white space
- Grid starts near top of page

---

### Test 10: Metrics Panel (If Not DLQ) ✅
**Goal:** Verify metrics still display correctly

**Steps:**
1. Select a regular queue (not DLQ)
2. Observe the **Queue Health Metrics** panel

**Expected Result:**
- ✅ Shows **3 metrics cards**:
  - Active Messages: (count)
  - Dead Letter: (count)
  - Scheduled: (count)
- ✅ Metrics are **compact** (12px font)
- ✅ Values are **readable** (10-12px)
- ✅ Metrics **auto-refresh** with messages

---

### Test 11: Message Sender Panel ✅
**Goal:** Verify message sender remains functional

**Steps:**
1. Click the **"📤 Send Message"** button (bottom-left corner)
2. Enter message body (e.g., `{"test": "hello"}`)
3. Click **Send**

**Expected Result:**
- ✅ Modal opens with clean interface
- ✅ Samples, Templates, Advanced, Import tabs available
- ✅ Message sends successfully
- ✅ New message appears in grid after next refresh (0-10 seconds)

---

### Test 12: Subscription Rules (If Subscription) ✅
**Goal:** Verify Rules button still works

**Steps:**
1. Expand a **Topic** in the left sidebar
2. Click on a **Subscription**
3. Click the **"⚙️ Rules"** button

**Expected Result:**
- ✅ Rules modal opens
- ✅ Shows existing rules (or "No rules" message)
- ✅ Can add/edit/delete rules

---

### Test 13: Multi-Namespace Tabs ✅
**Goal:** Verify switching between namespaces works

**Steps:**
1. Add **2 namespaces** (click "+ Add Namespace" twice)
2. Switch between tabs

**Expected Result:**
- ✅ Each tab maintains its own state
- ✅ Auto-refresh works independently per tab
- ✅ Switching tabs doesn't lose messages
- ✅ Page Visibility API works across tabs

---

## Performance Tests

### Test 14: Large Message Count (100+ Messages) ⏱️
**Goal:** Verify UI handles large datasets

**Steps:**
1. Send 100+ messages to a queue:
   ```bash
   node send-sample-messages.js test-queue 100
   ```
2. Load the queue in UI

**Expected Result:**
- ✅ Initial load takes < 5 seconds
- ✅ No UI freezing or lag
- ✅ Scrolling is smooth
- ✅ Search and filter work fast

---

### Test 15: Rapid Entity Switching 🔄
**Goal:** Verify no race conditions or stale data

**Steps:**
1. Rapidly click between different queues (5+ clicks in 2 seconds)

**Expected Result:**
- ✅ Each queue shows **correct messages** (no mixing)
- ✅ No duplicate requests or errors in console
- ✅ Loading states are handled properly

---

## Browser Compatibility

### Test 16: Cross-Browser Testing 🌐
**Browsers to Test:**
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (macOS)

**What to Check:**
- Page Visibility API works
- CSS animations are smooth
- Tooltips display correctly
- Buttons are responsive

---

## Error Handling

### Test 17: Session Expiry 🔒
**Goal:** Verify graceful handling of expired sessions

**Steps:**
1. Load messages successfully
2. Wait for session to expire (10 minutes default)
3. Wait for next auto-refresh

**Expected Result:**
- ✅ Error banner appears: **"Session expired. Please reconnect to continue."**
- ✅ Auto-refresh **stops** (no infinite 401 errors)
- ✅ User can click **Reconnect** to restore session

---

### Test 18: Network Failure 🌐
**Goal:** Verify UI handles network errors

**Steps:**
1. Load messages successfully
2. Stop backend (kill `dotnet run` process)
3. Wait for next auto-refresh (10 seconds)

**Expected Result:**
- ✅ Error message appears: **"Failed to load messages"**
- ✅ Previous messages remain visible (not cleared)
- ✅ Manual refresh shows same error

---

## Regression Tests (Ensure Nothing Broke)

### Test 19: Message Modal ✅
**Steps:**
1. Click **"View"** button on a message row

**Expected Result:**
- ✅ Modal opens with full message details
- ✅ JSON is formatted and syntax-highlighted
- ✅ Properties panel shows metadata

---

### Test 20: Export Messages ✅
**Steps:**
1. Select multiple messages (checkboxes)
2. Click **"Export Selected"**

**Expected Result:**
- ✅ Downloads JSON file
- ✅ File contains selected messages

---

### Test 21: DLQ Replay ✅
**Steps:**
1. Open a DLQ
2. Select messages
3. Click **"Replay Selected"**

**Expected Result:**
- ✅ Confirmation modal appears
- ✅ Messages move back to main queue
- ✅ DLQ count decreases

---

## Summary Checklist

Before marking as "Tested and Approved", verify:

- [ ] Auto-loading works on entity selection
- [ ] Disabled buttons have tooltips
- [ ] Auto-refresh indicator pulses during refresh
- [ ] Last updated timestamp shows and updates
- [ ] Manual refresh works
- [ ] Pause/Resume works
- [ ] Page Visibility API pauses/resumes correctly
- [ ] DLQ warning banner appears
- [ ] Loading skeleton shows on initial load only
- [ ] Layout is compact (no excessive whitespace)
- [ ] Metrics panel displays correctly
- [ ] Message sender works
- [ ] Rules button works (subscriptions)
- [ ] Multi-namespace tabs work
- [ ] Large message counts (100+) perform well
- [ ] Rapid entity switching works
- [ ] Cross-browser compatible
- [ ] Session expiry handled gracefully
- [ ] Network errors handled gracefully
- [ ] Message modal works
- [ ] Export works
- [ ] DLQ replay works

---

## Troubleshooting

### Issue: Messages Don't Auto-Load
**Check:**
- Backend is running (`curl https://localhost:7001/health`)
- Connection string is valid
- Console shows no JavaScript errors (F12 → Console)

### Issue: Auto-Refresh Not Working
**Check:**
- "Pause" button is **not active** (should show "⏸️ Pause", not "▶️ Resume")
- Console shows no errors
- Network tab shows periodic requests every 10s

### Issue: Skeleton Doesn't Appear
**Check:**
- Only appears on **initial load** (when messages.length === 0)
- Background refreshes **don't show skeleton** (this is intentional)

### Issue: Page Visibility API Not Working
**Check:**
- Browser supports Page Visibility API (all modern browsers do)
- Check DevTools Console for errors
- Try in Chrome/Firefox (100% supported)

---

**Testing Completed:** ___________  
**Tester Name:** ___________  
**Date:** ___________  
**Status:** [ ] PASS  [ ] FAIL  [ ] NEEDS FIXES
