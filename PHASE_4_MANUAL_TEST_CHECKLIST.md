# Phase 4 Comprehensive UI Refactoring - Manual Test Checklist

## Overview
Testing all 10 acceptance criteria for the bottom drawer overlay refactoring and UI reliability improvements.

## Test Environment
- **URL**: http://localhost:5175/
- **Latest Commit**: eeb0cbb (fix(ui): refactor bottom drawer to true overlay, fix duplicate headers)
- **Build Status**: ✅ 485ms, 0 TypeScript errors

---

## ✅ Acceptance Criteria Testing

### 1. Bottom Drawer as True Overlay (38% height default, max 60vh)
**Requirement**: Drawer appears as fixed overlay (not pushing content), 38% viewport height

- [ ] **Open drawer** by clicking "Send Message to Service Bus" button at bottom
  - Expected: Button bar disappears, backdrop appears
  - Verify: Drawer opens smoothly with fade animation
  - Check: Height is reasonable (38% of screen, not too large)

- [ ] **Verify no content push** - scroll main area
  - Expected: Main content visible behind transparent backdrop
  - Verify: Content doesn't shift when drawer opens/closes
  - Check: Layout remains stable

- [ ] **Verify height is correct**
  - Expected: Drawer takes ~38% of viewport (smaller than current 60vh)
  - Visual: Leaves content visible above drawer, below drawer button area
  - Test: Doesn't obscure top navigation even on smaller screens

- [ ] **Test on smaller viewport**
  - Expected: Height scales responsively (media query at max-height: 600px)
  - Verify: Still usable and not overwhelming on 600px height screen

---

### 2. Remove Duplicate "Send Message" Headers
**Requirement**: No duplicate title text between collapsed bar and expanded drawer

- [ ] **Check collapsed state**
  - Visual: Only button bar visible at bottom
  - Text: "Send Message to Service Bus" visible once in button
  - No duplication in DOM

- [ ] **Check expanded state**
  - Visual: Button bar hidden, drawer header shown
  - Text: "Send Message to Service Bus" visible once in drawer header
  - No duplicate titles

- [ ] **Toggle open/close multiple times**
  - Expected: Title never appears twice
  - Verify: Smooth transition, no flashing of duplicate text

---

### 3. Fix Sidebar Clipping Issues
**Requirement**: Sidebar doesn't get cut off or overlap improperly

- [ ] **Verify sidebar visibility**
  - Visual: Left sidebar visible and fully rendered
  - Check: Width/content not clipped by drawer
  - Verify: Works with drawer open and closed

- [ ] **Test sidebar functionality**
  - Click items in sidebar
  - Navigate between different views
  - Verify: Sidebar stays accessible, no z-index conflicts

---

### 4. Toast Placement (top-right with consistent stacking)
**Requirement**: Toast notifications appear in top-right corner, stack properly

- [ ] **Find toast trigger** (if available in UI)
  - Look for notifications or messages that would trigger toasts
  - Expected location: Top-right corner of screen

- [ ] **Test stacking**
  - Multiple toasts should stack vertically
  - Each new toast appears below previous ones
  - Spacing consistent between toasts

- [ ] **Verify no conflicts with drawer**
  - Toast visible even when drawer is open
  - Toast positioned above or beside drawer
  - No overlap or accessibility issues

---

### 5. Session Idle Timeout Model
**Requirement**: 2min toast → 2:30 banner → 3min modal (or integrated warning)

- [ ] **Idle detection**
  - Wait 2 minutes without activity
  - Expected: Toast or warning appears
  - Message: Something like "Session expiring in 30 seconds"

- [ ] **Reconnect capability**
  - When idle warning shows, user can interact to keep session alive
  - Clicking anywhere or typing should reset idle timer
  - Verify: Session stays active

- [ ] **Final timeout**
  - If idle continues past timeout
  - Expected: User logged out or session ended
  - Verify: Clear message about what happened

---

### 6. Reconnect Reliability with Rate Limiting
**Requirement**: Proper reconnect on 401/connection loss, rate limiting, state restoration

- [ ] **Test 401 handling**
  - Trigger 401 (e.g., close browser dev tools session tab)
  - Expected: Error message + reconnect attempt
  - Verify: Automatic reconnect within 10-15 seconds

- [ ] **Rate limiting**
  - Check browser console
  - Verify: No excessive reconnect attempts (should throttle)
  - Pattern: Exponential backoff or fixed 5-second intervals

- [ ] **State restoration**
  - Before 401: Select a queue, load some data
  - After reconnect: Same queue/data should be visible
  - Verify: No loss of UI state

---

### 7. Proper 401/Auth Error Handling
**Requirement**: Clear error messages, automatic recovery, no infinite loops

- [ ] **See error on 401**
  - Error banner displays at top
  - Clear message: "Authentication failed" or "Session expired"
  - Button: Option to "Re-login" or "Reconnect"

- [ ] **Recovery flow**
  - Click reconnect/re-login button
  - Expected: Automatic reconnection attempt
  - Verify: No spinner stuck indefinitely

- [ ] **After recovery**
  - UI resumes normal operation
  - Previous state/selection restored
  - Error banner disappears

---

### 8. Drawer Click-to-Close & Escape Key
**Requirement**: Click backdrop to close, Esc key closes drawer

- [ ] **Click backdrop to close**
  - Open drawer (click button)
  - Click on dimmed area (backdrop) outside the drawer
  - Expected: Drawer closes smoothly
  - Verify: Button bar reappears

- [ ] **Escape key closes**
  - Open drawer
  - Press Escape key
  - Expected: Drawer closes immediately
  - Verify: Focus returns to main area or button

- [ ] **No close on content click**
  - Open drawer
  - Click inside drawer content (message sender form)
  - Expected: Drawer stays open
  - Verify: Only backdrop click closes (not content area)

---

### 9. Message Sending Functionality
**Requirement**: MessageSender component works properly inside drawer

- [ ] **Open drawer**
  - Click "Send Message to Service Bus" button
  - Expected: Drawer opens, MessageSender component visible

- [ ] **Fill message form**
  - Select queue/topic
  - Enter message content
  - Set any properties
  - Expected: Form fields work normally

- [ ] **Send message**
  - Click Send button
  - Expected: Message sent successfully
  - Verify: Success notification appears
  - Drawer may close automatically (check desired behavior)

---

### 10. No Layout Jitter or Flashing
**Requirement**: Smooth animations, no visual glitches

- [ ] **Drawer open animation**
  - Click to open drawer
  - Observe: Smooth slide-up animation
  - No height jumping or content shifting

- [ ] **Drawer close animation**
  - Press Escape or click backdrop
  - Observe: Smooth slide-down animation
  - No flashing or jitter

- [ ] **No flash on page load**
  - Refresh page
  - Wait for app to load
  - Expected: Drawer stays collapsed (no flash of expanded state)

- [ ] **Scrolling inside drawer**
  - Open drawer with content
  - Scroll up/down
  - Expected: Smooth scrolling, no lag

---

## Summary

**Total Acceptance Criteria**: 10  
**Sub-checks per criterion**: ~3-4  
**Estimated test time**: 10-15 minutes

### Testing Notes
- [ ] All visual checks passed
- [ ] All interaction checks passed
- [ ] No console errors during testing
- [ ] No accessibility issues detected
- [ ] Mobile/responsive behavior verified

### Follow-up Issues (if any)
- List any bugs or issues found during testing
- Document unexpected behavior
- Note any missing features or edge cases

---

## Quick Test Summary
When you run through this checklist, provide a quick summary:
- ✅ Drawer behavior (open/close/animation)
- ✅ No duplicate headers
- ✅ Message sending works
- ✅ Toast placement correct
- ✅ Idle/reconnect working
- ✅ Auth errors handled properly
- ✅ No visual glitches

This validates the Phase 4 comprehensive UI refactoring is complete and ready for production.
