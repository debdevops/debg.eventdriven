# UI Light Mode Test Checklist

## Test Date: ___________
## Tester: ___________

---

## ✅ Requirement 1: Light Mode Only (Dark Mode Removed)

### Code Verification
- [ ] `App.tsx` - No `useDarkMode` import
- [ ] `App.tsx` - No dark mode state or props
- [ ] `TopBar.tsx` - No dark mode toggle button (🌙/☀️)
- [ ] `NamespaceView.tsx` - No dark mode props
- [ ] `index.css` - No `.dark-mode` CSS rules
- [ ] `useDarkMode.ts` - Archived to `/src/ui/archived/`

### Visual Verification
- [ ] UI always renders in light theme
- [ ] No toggle button in top bar
- [ ] Page background is white (#ffffff)
- [ ] Text is dark (#213547)
- [ ] All components use light theme colors

---

## ✅ Requirement 2: Disabled Feature Buttons

### Visual Verification
- [ ] **Peek** button visible in toolbar
  - [ ] Button is grayed out (opacity 0.6)
  - [ ] Tooltip shows: "Feature disabled - Read-only mode active"
  - [ ] No action on click

- [ ] **Stream** button visible in toolbar
  - [ ] Button is grayed out (opacity 0.6)
  - [ ] Tooltip shows: "Feature disabled - Read-only mode active"
  - [ ] No action on click

- [ ] **Compare Q/DLQ** button visible in toolbar
  - [ ] Button is grayed out (opacity 0.6)
  - [ ] Tooltip shows: "Compare available in advanced mode"
  - [ ] No action on click

### Functional Verification
- [ ] Read-only banner displays: "📖 Read-Only Mode: Messages previewed without removing them"
- [ ] Banner uses blue background (#e3f2fd)
- [ ] Banner positioned below toolbar, above grid

---

## ✅ Requirement 3: UI Compression (40% Height Reduction)

### Metrics Panel
- [ ] Compact inline layout (horizontal)
- [ ] Padding reduced to 2px
- [ ] Gap between metrics 12px
- [ ] Label font size 10px
- [ ] Value font size 12px
- [ ] Min-height 24px
- [ ] Collapse toggle works

### Toolbar (stream-controls-compact)
- [ ] Padding reduced to 4px 12px
- [ ] Min-height 36px
- [ ] Buttons compact with 4px 10px padding
- [ ] Button font size 11px
- [ ] Button gap 6px
- [ ] Auto Mode badge visible
- [ ] Refresh/Pause buttons functional

### Visual Comparison
- [ ] Total toolbar + metrics height ≤ 60px (down from ~100px)
- [ ] No excessive whitespace
- [ ] Elements not cramped or overlapping

---

## ✅ Requirement 4: Grid Improvements

### Checkbox Column
- [ ] First column is checkbox column
- [ ] Header checkbox selects/deselects all
- [ ] Row checkboxes toggle individual selection
- [ ] Selected count displays: "X selected"
- [ ] Clear Selection button works

### Export Functionality
- [ ] "⬇️ Export Selected" button enabled when ≥1 selected
- [ ] Export Selected downloads only checked messages
- [ ] "⬇️ Export All" button always enabled
- [ ] Export All downloads all visible messages
- [ ] Downloaded files are valid JSON

### Row Height & Filters
- [ ] Filter row compact (≤48px height)
- [ ] Search box functional
- [ ] Correlation ID filter works
- [ ] Delivery count filter works
- [ ] Result count displays: "X messages"

### Message Preview
- [ ] Body column truncates long messages
- [ ] Preview shows first ~50 chars
- [ ] "..." indicates truncation
- [ ] Click "👁" icon opens full modal

---

## ✅ Requirement 5: DLQ as Separate Entity

### Entity List
- [ ] DLQ appears as separate item in sidebar
- [ ] DLQ labeled: "🪦 queue-name/$DeadLetterQueue"
- [ ] DLQ selectable independently from main queue

### DLQ View
- [ ] Selecting DLQ shows only DLQ messages
- [ ] DLQ banner displays when viewing DLQ
- [ ] Replay Selected button visible for DLQ
- [ ] Replay All button visible for DLQ

### No Mixing
- [ ] Main queue messages don't show in DLQ view
- [ ] DLQ messages don't show in main queue view

---

## ✅ Requirement 6: Auto-Mode Functionality

### Auto Mode Badge
- [ ] Badge displays "🔄 Auto Mode (10s)" when active
- [ ] Badge positioned in toolbar
- [ ] Badge has blue background (#e3f2fd)

### Refresh Behavior
- [ ] Auto-refresh triggers every 10 seconds
- [ ] Message grid updates automatically
- [ ] Metrics panel updates automatically
- [ ] No console errors during auto-refresh

### Manual Controls
- [ ] Manual Refresh button works
- [ ] Pause button stops auto-refresh
- [ ] Resume button restarts auto-refresh
- [ ] Snapshot/Freeze button works

---

## ✅ Requirement 7: UX Polish

### Sidebar Width
- [ ] Sidebar width is 240px (reduced from 280px)
- [ ] More horizontal space for message grid
- [ ] Sidebar still readable and functional
- [ ] Resize handle works (if implemented)

### Send Message Panel
- [ ] Panel collapsed by default (max-height 42px)
- [ ] Header shows "📤 Send Message" + expand/collapse icon
- [ ] Click header expands panel
- [ ] Expanded panel shows full form
- [ ] Collapse works after expansion

### Icon-Only Buttons
- [ ] View message: 👁 (eye icon only)
- [ ] Download message: 📄 (document icon only)
- [ ] Tooltips show on hover
- [ ] Icons clear and distinguishable

---

## ✅ Requirement 8: Code Hygiene

### Files Removed/Archived
- [ ] `useDarkMode.ts` moved to `/src/ui/archived/`
- [ ] Dark mode CSS removed from `index.css` (~100 lines)
- [ ] No unused imports in `App.tsx`
- [ ] No unused props in `TopBar.tsx`
- [ ] No unused props in `NamespaceView.tsx`

### Build Verification
- [ ] `npm run build` succeeds with no errors
- [ ] No TypeScript errors
- [ ] No ESLint warnings about unused code
- [ ] Bundle size not significantly larger

---

## 🧪 End-to-End Flow Tests

### Connect & Browse
1. [ ] Open application
2. [ ] Click "Add Namespace" → add namespace → connect
3. [ ] Sidebar shows queues/topics
4. [ ] Connection status shows "Connected" (green indicator)

### Select Queue & View Messages
1. [ ] Click a queue in sidebar
2. [ ] Message grid loads and displays messages
3. [ ] Metrics panel shows Active/DLQ/Scheduled/Size counts
4. [ ] Toolbar shows disabled Peek/Stream/Compare buttons
5. [ ] Read-only banner displays

### Use Checkboxes & Export
1. [ ] Click header checkbox → all messages selected
2. [ ] Click row checkboxes → individual messages selected
3. [ ] "X selected" count updates
4. [ ] Click "Export Selected" → downloads JSON file
5. [ ] Open JSON → verify selected messages included

### View DLQ
1. [ ] Click DLQ entity in sidebar (🪦 icon)
2. [ ] DLQ messages display (different from main queue)
3. [ ] DLQ banner shows
4. [ ] Replay buttons visible

### Auto Mode
1. [ ] Verify "🔄 Auto Mode (10s)" badge displays
2. [ ] Wait 10 seconds → grid refreshes automatically
3. [ ] Click Pause → auto-refresh stops
4. [ ] Click Resume → auto-refresh resumes

### Send Message
1. [ ] Verify Send Message panel collapsed by default
2. [ ] Click header → panel expands
3. [ ] Select entity, enter message, click Send
4. [ ] Message sent successfully (toast notification)
5. [ ] New message appears in grid after refresh

---

## 📊 Performance & Polish

### Performance
- [ ] Initial page load ≤ 2 seconds
- [ ] Message grid renders smoothly (no lag)
- [ ] Auto-refresh doesn't freeze UI
- [ ] Search/filter responds instantly
- [ ] Export completes in ≤ 1 second for 100 messages

### Visual Polish
- [ ] No layout shifts or flickers
- [ ] Consistent spacing and alignment
- [ ] Readable font sizes (≥10px)
- [ ] Tooltips helpful and accurate
- [ ] Color contrast passes WCAG AA
- [ ] Scrollbars appear only when needed

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

---

## 🐛 Known Issues / Notes

_List any issues found during testing:_

1. 
2. 
3. 

---

## ✅ Final Sign-Off

- [ ] All critical tests pass
- [ ] UI is light mode only
- [ ] Disabled buttons clearly labeled
- [ ] UI compressed to ~40% smaller
- [ ] Grid checkboxes + export working
- [ ] DLQ separate and functional
- [ ] Auto-mode working correctly
- [ ] UX polish complete (sidebar, send panel)
- [ ] Code hygiene verified

**Tested By:** ___________  
**Date:** ___________  
**Result:** ✅ PASS / ❌ FAIL  
