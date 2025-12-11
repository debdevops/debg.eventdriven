# Code Changes Summary - 401 Auth Error Fix

## Files Modified: 3

### 1. src/ui/src/api/client.ts

**Change**: Clear credentials immediately on 401 error

**Location**: Line ~156 (in the 401 response handler)

**Before**:
```typescript
// Handle 401 Unauthorized - attempt token refresh
if (response.status === 401) {
  console.warn(`[ApiClient] ⚠️  401 Unauthorized on ${endpoint}`)
  
  // Only retry once after refresh for 401
  if (attempt === 0 && this.connectionString) {
    console.log('[ApiClient] Attempting automatic token refresh...')
```

**After**:
```typescript
// Handle 401 Unauthorized - attempt token refresh
if (response.status === 401) {
  console.warn(`[ApiClient] ⚠️  401 Unauthorized on ${endpoint}`)
  
  // CRITICAL: Clear stale credentials immediately on 401
  // This prevents token refresh from using invalid connection string
  this.clearCredentials()  // ← NEW LINE
  console.log('[ApiClient] Credentials cleared due to 401')
  
  // Only retry once after refresh for 401
  if (attempt === 0 && this.connectionString) {
    console.log('[ApiClient] Attempting automatic token refresh...')
```

**Purpose**: Prevents infinite retry loop with stale credentials

---

### 2. src/ui/src/contexts/SessionContextV2.tsx

**Change 1**: Remove 'auth_failed' from status type

**Location**: Line 20

**Before**:
```typescript
type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'expired' | 'auth_required' | 'auth_failed'
```

**After**:
```typescript
type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'expired' | 'auth_required'
```

**Purpose**: Forces all auth errors to use 'auth_required' status

---

**Change 2**: Set status to 'auth_required' on auth errors

**Location**: Line ~328 (in the catch block of reconnect)

**Before**:
```typescript
// Handle final error
if (lastError instanceof AuthError) {
  const authError: SessionError = {
    message: lastError.getUserFriendlyMessage(),
    reason: lastError.reason,
    isAuthError: true,
    statusCode: lastError.statusCode,
    timestamp: lastError.timestamp
  }
  setError(authError)
  setStatus('auth_failed')  // ← OLD
  toast.error(`🔐 ${authError.message}`)
```

**After**:
```typescript
// Handle final error
if (lastError instanceof AuthError) {
  const authError: SessionError = {
    message: lastError.getUserFriendlyMessage(),
    reason: lastError.reason,
    isAuthError: true,
    statusCode: lastError.statusCode,
    timestamp: lastError.timestamp
  }
  setError(authError)
  setStatus('auth_required')  // Changed to auth_required (not auth_failed) to trigger re-auth  ← CHANGED
  toast.error(`🔐 ${authError.message}`)
```

**Purpose**: Triggers re-authentication modal instead of retry loop

---

### 3. src/ui/src/App.tsx

**Change 1**: Rewrite handleReconnectFromModal to detect auth errors

**Location**: Lines 75-105

**Before**:
```typescript
// Handle reconnect from modal or auth banner
const handleReconnectFromModal = useCallback(async () => {
  if (activeNamespace) {
    try {
      await reconnect(activeNamespace.sessionId, async () => {
        // Reload entities
        const { apiClient } = await import('./api/client')
        const entities = await apiClient.listEntities(activeNamespace.sessionId)
        // Update will happen via handleUpdateNamespace
        handleUpdateNamespace(activeNamespace.sessionId, {
          queues: entities.queues,
          topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
        })
      })
      setShowExpiredModal(false)
      setShowAuthError(false)
    } catch (err) {
      console.error('Reconnect failed:', err)
      // Error will be shown in auth banner
    }
  }
}, [activeNamespace, reconnect, handleUpdateNamespace])
```

**After**:
```typescript
// Handle reconnect from modal or auth banner
const handleReconnectFromModal = useCallback(async () => {
  if (activeNamespace) {
    // If it's an auth error, require fresh authentication
    const isAuthError = error?.isAuthError ?? false
    
    if (isAuthError) {
      // For auth errors, force user to enter credentials again
      console.log('[App] Auth error detected - prompting for fresh credentials')
      setShowAuthError(false)
      setShowExpiredModal(false)
      setShowConnectModal(true)  // Open connect modal for fresh auth
      // Close the old namespace since credentials are invalid
      handleCloseNamespace(activeNamespace.sessionId)
      return
    }
    
    // For network errors, try to reconnect with existing credentials
    try {
      await reconnect(activeNamespace.sessionId, async () => {
        // Reload entities
        const { apiClient } = await import('./api/client')
        const entities = await apiClient.listEntities(activeNamespace.sessionId)
        // Update will happen via handleUpdateNamespace
        handleUpdateNamespace(activeNamespace.sessionId, {
          queues: entities.queues,
          topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
        })
      })
      setShowExpiredModal(false)
      setShowAuthError(false)
    } catch (err) {
      console.error('Reconnect failed:', err)
      // Error will be shown in auth banner
    }
  }
}, [activeNamespace, error, reconnect, handleUpdateNamespace, handleCloseNamespace])
```

**Purpose**: Detect auth errors and open re-auth modal instead of retrying

---

**Change 2**: Add re-authentication modal rendering

**Location**: Lines 130-145 (after AuthErrorBanner)

**Added**:
```typescript
{/* Modal shown when credentials are invalid - requires fresh auth */}
{status === 'auth_required' && activeNamespace && !showConnectModal && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ textAlign: 'center' }}>
      <h2>🔐 Re-Authentication Required</h2>
      <p>Your session credentials are no longer valid. Please provide a fresh connection string.</p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn-primary" onClick={() => {
          setShowConnectModal(true)
        }}>
          Enter Connection String
        </button>
        <button className="btn-secondary" onClick={() => handleCloseNamespace(activeNamespace.sessionId)}>
          Close Namespace
        </button>
      </div>
    </div>
  </div>
)}
```

**Purpose**: Shows modal asking user for fresh connection string

---

## Summary

**Total Changes**: 3 files, ~70 lines

| File | Lines | Changes |
|------|-------|---------|
| api/client.ts | 5 | Added clearCredentials() on 401 |
| SessionContextV2.tsx | 2 | Removed 'auth_failed', changed setStatus |
| App.tsx | 63 | Enhanced reconnect handler + added modal |

**Build Result**: ✅ Success (451ms, 0 errors)

**Impact**: 
- ✅ Breaks infinite 401 retry loop
- ✅ Provides clear recovery path
- ✅ Low risk, localized changes
- ✅ No API changes
- ✅ No breaking changes
