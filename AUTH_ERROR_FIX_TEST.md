# Authentication Error Fix - Testing Guide

## Issue Fixed
**Previous Behavior**: 
- 401 auth error → banner shows "Authentication failed after token refresh"
- Click "Reconnect" → Spinner shows, but nothing happens
- Banner persists indefinitely
- User can't send messages

**New Behavior**:
- 401 auth error → banner shows "Authentication failed after token refresh"
- Click "Reconnect" → Modal appears asking for fresh connection string
- User enters new connection string → Reconnects successfully
- Banner auto-dismisses, user can send messages

## Root Cause
The API client had a stale/invalid connection string stored. When token refresh was attempted, it failed because the stored credentials were no longer valid. The reconnect tried to reload with the same stale credentials, resulting in another 401.

**Fix**:
1. **ApiClient now clears credentials on any 401** - prevents reusing invalid connection string
2. **Reconnect now opens re-auth modal on auth failures** - user must provide fresh credentials
3. **Error state changed from 'auth_failed' to 'auth_required'** - triggers re-auth flow instead of retry loop

---

## Test Scenario 1: Test Normal Reconnect (No Auth Error)

### Setup
1. Open http://localhost:5173
2. Click "+ Add Namespace"
3. Enter your Service Bus connection string
4. Click "Connect"
5. Verify entities load (Queues/Topics appear)

### Test Steps
1. Idle for 3+ minutes (to trigger "Session Expired" modal)
2. Click "Reconnect" button
3. **Expected**: Reconnect completes, entities reload, no banner shown
4. **Success Criterion**: Can successfully send messages after reconnect ✅

### Console Verification
Look for logs:
```
[Session] RECONNECT FLOW START
[Session] Attempt 1/5: Reconnecting...
[Session] ✓ Reload successful
[Session] ✓ Reconnect SUCCESS on attempt 1
[Session] RECONNECT FLOW END (SUCCESS)
```

---

## Test Scenario 2: Test Auth Error Handling (NEW)

### Setup (Create 401 Error)

#### Method A: Manually Clear API Credentials (Fastest)
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste this:
```javascript
// Clear the stored connection string in ApiClient
(async () => {
  const { apiClient } = await import('./api/client');
  apiClient.clearCredentials();
  console.log('✓ Credentials cleared - next API call will get 401');
})();
```
4. Press Enter

#### Method B: Let Session Timeout (Takes 10+ minutes)
1. Connect to namespace
2. Idle for 10+ minutes until backend session expires
3. Try any operation (list entities, peek messages, etc.)
4. Will get 401 from backend

### Test Steps (After Setup)
1. Try any operation that calls the API (e.g., "Peek Messages", "Refresh" button)
2. **Expected Outcome**:
   - Red banner appears: "Authentication failed after token refresh"
   - Banner shows status code and error details
   - "Reconnect" button visible on banner

3. Click "Reconnect" button
4. **Expected Outcome**:
   - Modal appears: "🔐 Re-Authentication Required"
   - Two buttons: "Enter Connection String" and "Close Namespace"
   - Old namespace closes

5. Click "Enter Connection String"
6. **Expected Outcome**:
   - "Add Namespace" modal opens
   - Enter your connection string again
   - Click "Connect"

7. **Final Expected Outcome**:
   - Modal closes
   - Entities load successfully
   - Red error banner auto-dismisses
   - Can send messages ✅

### Console Verification
Look for logs:
```
[ApiClient] ⚠️  401 Unauthorized on /api/...
[ApiClient] Credentials cleared due to 401
[Session] Auth error - not retrying
[Session] ✗ RECONNECT FAILED after all attempts
[Session] Status: auth_required
[App] Auth error detected - prompting for fresh credentials
[Session] RECONNECT FLOW END (FAILED)
```

---

## Test Scenario 3: Verify Message Sending Works After Reconnect

### Setup
1. Connect to namespace
2. Navigate to a queue
3. Trigger auth error (use Method A from Scenario 2)
4. Re-enter credentials (using new modal)
5. Wait for reconnect to complete

### Test Steps
1. Click "Send Sample Payload"
2. **Expected**: Message appears in queue immediately ✅
3. Click "Refresh" to reload messages
4. **Expected**: Messages still there ✅
5. Click a message row
6. **Expected**: Message detail panel opens ✅

### Success Criteria
- ✅ Banner appears on 401
- ✅ Clicking "Reconnect" opens re-auth modal (not spinner loop)
- ✅ Can re-enter connection string
- ✅ Reconnect completes successfully
- ✅ Banner auto-dismisses
- ✅ Can send and receive messages

---

## Test Scenario 4: Verify State is Properly Restored

### Setup
1. Connect to namespace
2. Navigate to "test-queue" 
3. Trigger auth error (use Method A from Scenario 2)

### Test Steps
1. Click "Reconnect"
2. Re-enter credentials
3. Wait for reconnect to complete

### Expected Behavior
- ✅ "test-queue" is still selected (not reset to first queue)
- ✅ Message list reloads (if messages were there before)
- ✅ Message detail panel closes cleanly (not stuck)
- ✅ Auto-refresh mode preserved (Stream vs Peek)

### Console Verification
```
[Session] Executing full reload
[Session] Entities reloaded successfully
[Session] ✓ Reload successful
[Session] ✓ Reconnect SUCCESS
```

---

## Test Scenario 5: Verify Error Banner Styling

### Setup
1. Trigger auth error (use Method A from Scenario 2)
2. Banner should appear

### Visual Verification
Check these visual aspects:

**Banner Appearance**:
- ✅ Red background (error color)
- ✅ White text with good contrast
- ✅ Smooth animation (appears from top, smooth slide)
- ✅ No layout jitter (rest of page doesn't shift)

**Buttons**:
- ✅ "Reconnect" button is white/primary color
- ✅ Dismiss button (✕) is visible top-right
- ✅ Buttons are clickable

**Content**:
- ✅ Error message is clear: "Authentication failed after token refresh"
- ✅ Status code shown: "401"
- ✅ Timestamp shown
- ✅ Error reason shown

**Dismiss**:
- ✅ Clicking ✕ button closes banner
- ✅ Clicking outside banner (if clickable) doesn't close it
- ✅ Banner auto-dismisses on successful reconnect

---

## Quick Verification Checklist

Run through this in ~5 minutes:

- [ ] Open http://localhost:5173
- [ ] Connect to namespace (message shown in console)
- [ ] Clear credentials: `(async () => { const { apiClient } = await import('./api/client'); apiClient.clearCredentials(); })();`
- [ ] Click "Refresh" or "Peek Messages"
- [ ] Verify red banner appears with error
- [ ] Click "Reconnect"
- [ ] Verify modal asks for connection string
- [ ] Enter connection string
- [ ] Verify banner auto-dismisses
- [ ] Send a test message
- [ ] Verify message appears ✅

---

## Common Issues & Troubleshooting

### Issue: Banner keeps showing even after reconnect
**Symptom**: Reconnect succeeds but banner remains visible
**Fix**: Banner should auto-dismiss within 500ms of reconnect success. If it doesn't:
1. Refresh the page
2. Check console for errors
3. Restart backend/frontend

### Issue: Modal doesn't appear when clicking "Reconnect"
**Symptom**: Spinner shows but nothing happens
**Fix**: 
1. Verify you're using the latest build (`npm run build`)
2. Hard refresh browser (Cmd+Shift+R on Mac)
3. Check console for errors

### Issue: Can't send messages after reconnect
**Symptom**: "Send Message" button is disabled or grayed out
**Fix**:
1. Verify namespace is still connected (top-left shows namespace name)
2. Click "Refresh" to reload entities
3. Check console for any 401 errors
4. Try reconnecting again with fresh credentials

### Issue: Banner stuck in "Reconnecting..." state
**Symptom**: Banner shows spinner indefinitely
**Fix**:
1. The reconnect flow has failed (check console for errors)
2. Click "Reconnect" button on banner to retry
3. Or refresh page to reset state

---

## How to Report Issues

If you encounter any problems:

1. **Reproduce the issue** following the test steps above
2. **Collect evidence**:
   - Screenshot of the banner/state
   - Console logs (F12 → Console tab)
   - Exact steps to reproduce
3. **Test on latest build**:
   ```bash
   cd src/ui && npm run build
   ```
4. **Report with**:
   - Issue description
   - Screenshots
   - Console logs
   - Steps to reproduce

---

## Implementation Details

### Changes Made

**1. ApiClient (`src/ui/src/api/client.ts`)**
```typescript
// On 401, immediately clear stale credentials
if (response.status === 401) {
  this.clearCredentials()  // NEW - prevents reusing invalid connection string
  // ... rest of 401 handling
}
```

**2. SessionContextV2 (`src/ui/src/contexts/SessionContextV2.tsx`)**
```typescript
// Changed status type
type SessionStatus = '...' | 'auth_required'  // removed 'auth_failed'

// On auth failure, set to 'auth_required' instead of 'auth_failed'
setStatus('auth_required')  // Triggers re-auth modal
```

**3. App.tsx (`src/ui/src/App.tsx`)**
```typescript
// Check if error is auth-related
if (error?.isAuthError) {
  // Open re-auth modal instead of retrying
  setShowConnectModal(true)
  handleCloseNamespace(activeNamespace.sessionId)
  return
}

// Show modal when auth_required status
{status === 'auth_required' && (
  <div className="modal-content">
    {/* Re-auth modal content */}
  </div>
)}
```

---

## Success Metrics

After the fix, the app should:

1. ✅ **Detect 401 errors immediately** - Red banner appears within 1 second
2. ✅ **Not retry indefinitely** - Max 5 attempts on network errors, 0 on auth errors
3. ✅ **Clear stale credentials** - Don't reuse invalid connection strings
4. ✅ **Require fresh auth** - User must re-enter credentials, not just click retry
5. ✅ **Auto-dismiss on success** - Banner disappears automatically after reconnect succeeds
6. ✅ **Restore state** - Selected queue/topic preserved, messages reload
7. ✅ **Allow message sending** - User can send messages immediately after successful reconnect
8. ✅ **Smooth UI** - No jitter, smooth animations, professional appearance

---

**Last Updated**: December 8, 2025
**Status**: ✅ READY FOR TESTING
**Confidence**: HIGH - This addresses the exact issue from the screenshot
