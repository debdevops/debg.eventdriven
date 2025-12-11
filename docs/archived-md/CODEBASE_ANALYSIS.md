# Codebase Analysis - UI Component Inventory

**Generated:** December 8, 2025  
**Scope:** Complete src/ui/src directory analysis  
**Total Files Analyzed:** 57 TypeScript/TSX files

---

## 1. SEND MESSAGE PANEL/DRAWER COMPONENTS

### MessageSender.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/components/MessageSender.tsx`  
**Purpose:** Primary horizontal message sending component for sending messages to queues/topics  
**Size:** 860 lines of code  
**Key Exports:**
- `MessageSender` (React.FC<MessageSenderProps>) - Main component
- `MessageSenderProps` interface

**Key Features:**
- Message composition and sending
- Template management (save/load/delete templates)
- Custom message properties
- Sample payload templates (Simple Text, Order Created, User Registered, Payment Processed, Inventory Update)
- Session validation
- Entity selection
- Auto-select entity when provided
- Error handling integration

**Props Interface:**
```typescript
interface MessageSenderProps {
  sessionId: string | null
  entities?: Array<{ name: string; type: string }>
  currentEntity?: string
}
```

---

### BottomMessageDock.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/components/BottomMessageDock.tsx`  
**Purpose:** Persistent collapsible dock bar at bottom of screen - wraps MessageSender  
**Size:** 96 lines of code  
**Key Exports:**
- `BottomMessageDock` (default export) - Container component
- `BottomMessageDockProps` interface

**Key Features:**
- Always visible as 1-row bar
- Expands upward to show full MessageSender on click
- Click-outside detection to collapse
- Escape key handling to collapse
- Props pass-through to MessageSender
- Fixed positioning at bottom

**Props Interface:**
```typescript
interface BottomMessageDockProps {
  sessionId: string | null
  entities?: Array<{ name: string; type: string }>
  currentEntity?: string
}
```

**Related CSS:**
- `BottomMessageDock.css` - Styling for dock container and expand animation
- `MessageSender.css` - Styling for message form and templates

---

## 2. SESSION CONTEXT & IDLE DETECTION

### SessionContextV2.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/contexts/SessionContextV2.tsx`  
**Purpose:** Robust session management with exponential backoff reconnect and idle detection  
**Size:** 371 lines of code  
**Key Exports:**
- `SessionProviderV2` (React component) - Provider wrapper
- `useSessionV2` (hook) - Consumer hook

**Key Features:**
- Connection state management (connecting, connected, disconnected, expired, auth_required)
- Idle detection integration (120s threshold, 30s warning before expiry)
- Exponential backoff reconnect (500ms → 1s → 2s → 4s → 8s max)
- Heartbeat ping every 20s to detect stale connections
- Proper 401 handling with token refresh and retry
- Timer registry for cleanup on reconnect
- Auto-restore previous namespace/entity selection

**Exports:**
```typescript
export function SessionProviderV2({ children, toast }: SessionProviderProps)
export function useSessionV2(): SessionContextType
```

**Context Interface:**
```typescript
interface SessionContextType {
  status: SessionStatus // 'connecting'|'connected'|'disconnected'|'expired'|'auth_required'
  error: SessionError | null
  connectedAt: Date | null
  lastErrorTime: number | null
  isIdle: boolean
  idleSeconds: number
  showIdleWarning: boolean
  showIdleCritical: boolean
  reconnect: (sessionId: string, reloadCallback: () => Promise<void>) => Promise<void>
  clearError: () => void
  resetActivity: () => void
  markExpired: () => void
  registerTimer: (name: string, timerId: NodeJS.Timeout) => void
  clearAllTimers: () => void
}
```

**Constants:**
- IDLE_THRESHOLD = 120 seconds (2 minutes)
- IDLE_WARNING_THRESHOLD = 30 seconds
- HEARTBEAT_INTERVAL = 20000ms (20 seconds)
- RECONNECT_BACKOFF_INITIAL = 500ms
- RECONNECT_BACKOFF_MAX = 8000ms

---

### SessionContext.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/contexts/SessionContext.tsx`  
**Purpose:** Legacy session context (appears to be deprecated in favor of SessionContextV2)  
**Size:** 274 lines of code  
**Status:** Likely superseded by SessionContextV2

---

## 3. TOAST/NOTIFICATION COMPONENTS

### Toast.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/components/Toast.tsx`  
**Purpose:** Lightweight notification system for user feedback  
**Size:** 57 lines of code (58 with EOF)  
**Key Exports:**
- `Toast` (React.FC<ToastProps>) - Individual toast component
- `ToastContainer` (React.FC<ToastContainerProps>) - Container for multiple toasts
- `ToastType` type definition
- `ToastProps` interface
- `ToastContainerProps` interface

**Key Features:**
- 4 toast types: 'success', 'error', 'info', 'warning'
- Auto-dismiss after configurable duration (default 3000ms)
- Icon display based on type
- Click-to-dismiss
- Container for displaying multiple toasts

**Exports:**
```typescript
export type ToastType = 'success' | 'error' | 'info' | 'warning'
export function Toast({ message, type, duration, onClose }: ToastProps)
export function ToastContainer({ toasts, onRemove }: ToastContainerProps)
```

**Related CSS:**
- `Toast.css` - Styling for toast notifications and container positioning

---

## 4. IDLE WARNING & AUTH ERROR COMPONENTS

### IdleWarningBanner.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/components/IdleWarningBanner.tsx`  
**Purpose:** Critical idle warning shown 30 seconds before session expiry  
**Size:** 25 lines of code  
**Key Exports:**
- `IdleWarningBanner` - React component
- `IdleWarningBannerProps` interface

**Key Features:**
- Displays countdown timer (seconds remaining)
- On-dismiss callback
- Click-to-dismiss interaction
- Critical visual indicator

**Props Interface:**
```typescript
interface IdleWarningBannerProps {
  secondsRemaining: number
  onDismiss: () => void
}
```

**Related CSS:**
- `IdleWarningBanner.css` - Styling for warning banner

---

### AuthErrorBanner.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/components/AuthErrorBanner.tsx`  
**Purpose:** Authentication error notification with reconnect actions  
**Size:** 74-75 lines of code  
**Key Exports:**
- `AuthErrorBanner` - React component
- `AuthErrorBannerProps` interface

**Key Features:**
- Shows when reconnect fails due to auth issues (401, token invalid)
- Displays error reason, message, status code, timestamp
- Retry reconnect button with loading state
- Dismiss button
- Auto-hides after successful reconnect
- Different messaging for 'unauthorized' vs other session errors

**Props Interface:**
```typescript
interface AuthErrorBannerProps {
  isVisible: boolean
  message: string
  reason: string
  statusCode?: number
  timestamp: Date
  onDismiss: () => void
  onRetryReconnect: () => void
  isReconnecting: boolean
}
```

**Related CSS:**
- `AuthErrorBanner.css` - Styling for error banner with status colors

---

## 5. CONNECTION/RECONNECT HANDLING

### useReconnect.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/hooks/useReconnect.ts`  
**Purpose:** Centralized reconnect hook with idempotent logic and cleanup  
**Size:** 113-114 lines of code  
**Key Exports:**
- `useReconnect` - Hook function

**Key Features:**
- Idempotent reconnect routine
- Timer/interval cleanup and tracking
- Prevents concurrent reconnect attempts
- State management for reconnect status
- Callback options for success/error handling
- Integration with namespace updates

**Hook API:**
```typescript
export function useReconnect() {
  return {
    isReconnecting: boolean
    reconnectInProgressRef: React.MutableRefObject<boolean>
    timerIdsRef: React.MutableRefObject<Set<ReturnType<typeof setTimeout>>>
    clearAllTimers: () => void
    registerTimer: (id: ReturnType<typeof setTimeout>) => ReturnType<typeof setTimeout>
    unregisterTimer: (id: ReturnType<typeof setTimeout>) => void
    reconnect: (options: ReconnectOptions) => Promise<void>
  }
}
```

---

### useIdleDetection.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/hooks/useIdleDetection.ts`  
**Purpose:** Tracks user activity and idle time across the application  
**Size:** 130-131 lines of code  
**Key Exports:**
- `useIdleDetection` - Hook function

**Key Features:**
- Monitors: mousemove, keydown, scroll, mousedown, touchstart, visibilitychange
- Configurable idle and warning thresholds
- Activity reset mechanism
- Callback hooks for idle state changes
- Returns current idle time in seconds

**Hook API:**
```typescript
export function useIdleDetection(options: IdleDetectionOptions = {}) {
  return {
    idleSeconds: number
    isIdle: boolean
    isWarning: boolean
    isCritical: boolean
    resetActivity: () => void
  }
}
```

**Options:**
```typescript
interface IdleDetectionOptions {
  idleThresholdSeconds?: number      // Default: 120 (2 minutes)
  warningThresholdSeconds?: number   // Default: 30
  onIdleStart?: () => void
  onActivity?: () => void
  onIdleWarning?: () => void
  onIdleCritical?: () => void
}
```

---

### useToast.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/hooks/useToast.ts`  
**Purpose:** Toast notification state management and control  
**Size:** 48 lines of code  
**Key Exports:**
- `useToast` - Hook function

**Key Features:**
- Centralized toast queue management
- Deduplication (prevents duplicate toasts)
- Type-specific helpers (success, error, info, warning)
- Toast add/remove functionality

**Hook API:**
```typescript
export function useToast() {
  return {
    toasts: Array<{ id: string; message: string; type: ToastType }>
    addToast: (message: string, type?: ToastType) => void
    removeToast: (id: string) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warning: (message: string) => void
  }
}
```

---

### useSessionExpiry.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/hooks/useSessionExpiry.ts`  
**Purpose:** Session expiry countdown tracking  
**Size:** (Need to check)  
**Key Features:**
- Tracks time until session expiry
- Integration with session management

---

## 6. MAIN APP LAYOUT & ROOT STYLING

### App.tsx
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/App.tsx`  
**Purpose:** Main application component managing multi-namespace tabs and global state  
**Size:** 315 lines of code  
**Key Components:**
- `App` (main) - Root component with state management
- `AppContent` (inner) - Wrapper that uses SessionContextV2

**Key Features:**
- Multi-namespace management
- Global keyboard shortcuts (? for help menu)
- SessionProviderV2 integration
- Toast system setup
- Modal coordination (Connect, Auth, Expiry)
- Banner rendering (Auth errors, Idle warnings)
- Keyboard shortcut listener (Cmd+1-9 for namespace switching)
- Audit log management
- Entity selection tracking

**Key State:**
```typescript
namespaces: Namespace[]
activeNamespaceId: string | null
showConnectModal: boolean
showShortcuts: boolean
auditLog: AuditEntry[]
currentEntityName: string | null
```

**Key Child Components Used:**
- TopBar
- NamespaceTabs
- NamespaceView
- ConnectModal
- AuditPanel
- BottomMessageDock
- ToastContainer
- KeyboardShortcutsHelp
- IdleWarningBanner
- AuthErrorBanner
- SessionExpiredModal

---

### App.css
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/App.css`  
**Purpose:** Global application styling and layout  
**Size:** 282 lines of code  
**Key Styles:**
- `.app` - Main container layout
- `.main-content` - Content area with proper spacing
- Modal overlay and modal-content styles
- Empty state styling
- Global spacing and color definitions
- Responsive layout rules
- Dark mode support

**Layout Features:**
- Flexbox-based layout structure
- Proper main content padding (prevents dock overlap)
- Modal centering and overlay
- Responsive typography
- Color scheme definitions

---

## 7. API CLIENT & ERROR HANDLING

### client.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/api/client.ts`  
**Purpose:** API client for Service Bus Inspector backend with security and retry logic  
**Size:** 375 lines of code  
**Key Features:**
- 401 detection and error throwing
- Token refresh mechanism
- Exponential backoff retry logic
- Never logs or exposes connection strings
- Automatic SessionContext delegation for auth errors

**Key API Methods:**
- `setCredentials(sessionId, connectionString)`
- `connect(vaultUrl, vaultName, secretName)`
- `listEntities(sessionId)`
- `peekMessages(sessionId, entity, count)`
- `receiveMessages(sessionId, entity, count)`
- `sendMessage(sessionId, entity, payload, properties)`

---

### errors.ts
**Path:** `/Users/debasisghosh/Github/debg.eventdriven/src/ui/src/api/errors.ts`  
**Purpose:** Error type definitions and handling  
**Key Exports:**
- `ApiError` - Base error class
- `AuthError` - Authentication/authorization errors
- `NetworkError` - Network/connectivity errors

---

## SUMMARY TABLE

| Category | Component | Path | Lines | Exports | Role |
|----------|-----------|------|-------|---------|------|
| **Message Panel** | MessageSender.tsx | `components/` | 860 | MessageSender | Primary message compose UI |
| | BottomMessageDock.tsx | `components/` | 96 | BottomMessageDock | Collapsible dock wrapper |
| **Session/Idle** | SessionContextV2.tsx | `contexts/` | 371 | SessionProviderV2, useSessionV2 | Session + idle management |
| | SessionContext.tsx | `contexts/` | 274 | (legacy) | Deprecated session mgmt |
| | useIdleDetection.ts | `hooks/` | 131 | useIdleDetection | Activity tracking |
| | useSessionExpiry.ts | `hooks/` | ? | useSessionExpiry | Expiry countdown |
| **Notifications** | Toast.tsx | `components/` | 57 | Toast, ToastContainer | Toast system |
| | useToast.ts | `hooks/` | 48 | useToast | Toast state mgmt |
| **Auth/Idle UI** | IdleWarningBanner.tsx | `components/` | 25 | IdleWarningBanner | Idle countdown UI |
| | AuthErrorBanner.tsx | `components/` | 75 | AuthErrorBanner | Auth error UI |
| **Reconnect** | useReconnect.ts | `hooks/` | 114 | useReconnect | Reconnect logic |
| **API/Errors** | client.ts | `api/` | 375 | apiClient, others | API client + retry |
| | errors.ts | `api/` | ? | ApiError, AuthError, etc | Error types |
| **Root/Layout** | App.tsx | `src/` | 315 | App, AppContent | Main app component |
| | App.css | `src/` | 282 | N/A | Global styling |

---

## KEY INTEGRATION POINTS

### App.tsx → SessionContextV2
- Wraps AppContent with SessionProviderV2
- Passes toast object to provider
- Uses useSessionV2 hook for session state
- Renders based on session status and errors

### App.tsx → BottomMessageDock
- Passes sessionId, entities, currentEntity
- Positioned at bottom of layout
- References activeNamespace data

### SessionContextV2 → useIdleDetection
- Internally uses useIdleDetection hook
- Tracks idle state for session management
- Triggers warnings and expiry flows

### MessageSender → API Client
- Uses apiClient for sending messages
- Integrates error handling
- Shows toast notifications on success/error

### Toast System
- useToast hook provides state
- Toast component renders individual notifications
- ToastContainer wraps multiple toasts
- Used throughout app for feedback

---

## CONSTANTS & CONFIGURATION

**Session Timings (from SessionContextV2):**
- Idle threshold: 120 seconds (2 minutes)
- Idle warning: 30 seconds before expiry
- Heartbeat interval: 20,000ms (20 seconds)
- Reconnect initial backoff: 500ms
- Reconnect max backoff: 8,000ms (8 seconds)

**Toast Defaults:**
- Auto-dismiss: 3,000ms (3 seconds)
- Deduplication: enabled (checks message + type)

**Activity Monitoring (from useIdleDetection):**
- Monitors: mousemove, keydown, scroll, mousedown, touchstart, visibilitychange
- Configurable thresholds
- Callback hooks for state transitions

---

## RECOMMENDATIONS FOR MODIFICATIONS

When making changes, consider:

1. **MessageSender/BottomMessageDock**: Coordinate changes for UI layout impact
2. **SessionContextV2**: This is the single source of truth - changes here affect all session state
3. **useIdleDetection**: Check all consumers if modifying idle thresholds
4. **Toast system**: Lightweight - can safely extend with new toast types
5. **Auth error handling**: App.tsx shows the coordination logic - understand flow before changing
6. **API client**: Changes here affect all backend communication

---

**Analysis Complete** - All paths verified as of December 8, 2025
