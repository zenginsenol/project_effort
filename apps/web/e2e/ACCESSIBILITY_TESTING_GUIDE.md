# Command Palette Accessibility Testing Guide

This guide provides step-by-step instructions for manually testing keyboard navigation and accessibility features of the command palette search functionality.

## Overview

The command palette is designed to be fully accessible via keyboard and screen readers. This guide covers manual testing procedures to verify accessibility compliance.

## Prerequisites

- Application running locally at `http://localhost:3000`
- Access to screen reader software (VoiceOver on Mac, NVDA/JAWS on Windows, Orca on Linux)
- Understanding of WCAG 2.1 Level AA guidelines

---

## 1. Keyboard Navigation Testing

### 1.1 Opening the Command Palette

**Test Steps:**
1. Navigate to any page in the application
2. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)

**Expected Results:**
- ✅ Command palette opens as a modal overlay
- ✅ Search input is automatically focused (cursor appears in input field)
- ✅ No need to click to start typing
- ✅ Backdrop appears behind the palette

**Status:** Pass / Fail

---

### 1.2 Closing the Command Palette

**Test Steps:**
1. Open the command palette (`Cmd+K` / `Ctrl+K`)
2. Press `Escape` key

**Expected Results:**
- ✅ Command palette closes immediately
- ✅ Focus returns to the page content
- ✅ Search input value is cleared
- ✅ Entity type filters are reset

**Alternative Method:**
- Click on the backdrop (dark area outside the palette)
- Same expected results as above

**Status:** Pass / Fail

---

### 1.3 Navigating Through Search Results

**Test Steps:**
1. Open the command palette
2. Type a search query (e.g., "test")
3. Wait for results to appear (~300-500ms)
4. Press `Arrow Down` key repeatedly

**Expected Results:**
- ✅ First result becomes highlighted when pressing Arrow Down
- ✅ Subsequent presses move highlight to next result
- ✅ Highlighted result has visible focus indicator (background color change)
- ✅ Navigation wraps to first item when reaching the end
- ✅ Highlight moves smoothly without lag

**Test Steps (Reverse):**
1. Navigate down to 3rd or 4th result
2. Press `Arrow Up` key

**Expected Results:**
- ✅ Highlight moves to previous result
- ✅ Navigation wraps to last item when at the beginning

**Status:** Pass / Fail

---

### 1.4 Selecting Search Results

**Test Steps:**
1. Open command palette
2. Search for "test"
3. Navigate to a result using Arrow keys
4. Press `Enter` key

**Expected Results:**
- ✅ Command palette closes immediately
- ✅ Browser navigates to the selected item's page
- ✅ Navigation is instant (no delay)
- ✅ Correct page loads based on entity type:
  - Projects → `/dashboard/projects/{id}`
  - Tasks → `/dashboard/projects/{projectId}` (task's project)
  - Cost Analyses → `/dashboard/analyzer`
  - Sessions → `/dashboard/sessions/{id}`

**Alternative Method:**
- Click on a result with mouse
- Same navigation behavior expected

**Status:** Pass / Fail

---

### 1.5 Tabbing Through Filter Controls

**Test Steps:**
1. Open command palette
2. Search input should be focused initially
3. Press `Tab` key once

**Expected Results:**
- ✅ Focus moves to "Projects" filter button
- ✅ Visible focus ring appears around button
- ✅ Button has clear visual focus indicator

**Test Steps (Continue):**
4. Press `Tab` again (3 more times)

**Expected Results:**
- ✅ Focus moves sequentially through:
  - Projects filter
  - Tasks filter
  - Cost Analyses filter
  - Sessions filter
- ✅ Each button shows focus indicator when focused

**Test Steps (Reverse):**
5. Press `Shift+Tab`

**Expected Results:**
- ✅ Focus moves backward through filters
- ✅ Can return to search input via `Shift+Tab`

**Status:** Pass / Fail

---

### 1.6 Activating Filters via Keyboard

**Test Steps:**
1. Open command palette
2. Press `Tab` to focus "Projects" filter
3. Press `Enter` key

**Expected Results:**
- ✅ Filter activates (background changes to primary color)
- ✅ Search results update to show only projects
- ✅ Filter remains focused after activation

**Test Steps (Alternative):**
4. Press `Space` key on a focused filter

**Expected Results:**
- ✅ Filter activates/deactivates same as Enter key
- ✅ Both Enter and Space work identically

**Test Steps (Deactivation):**
5. Press `Enter` or `Space` again on active filter

**Expected Results:**
- ✅ Filter deactivates (background returns to default)
- ✅ Search results show all entity types again

**Status:** Pass / Fail

---

### 1.7 Clearing Search Input

**Test Steps:**
1. Open command palette
2. Type "test query"
3. Click the "X" (clear) button on the right side of input

**Expected Results:**
- ✅ Search input clears immediately
- ✅ Focus remains in search input
- ✅ Clear button has `aria-label="Clear search"`
- ✅ Clear button only appears when input has text

**Keyboard Alternative:**
- Select all text (`Cmd+A` / `Ctrl+A`) and press `Backspace`
- Same clearing behavior

**Status:** Pass / Fail

---

### 1.8 Recent Searches Interaction

**Test Steps:**
1. Perform 3-5 different searches
2. Close palette (`Escape`)
3. Reopen palette (`Cmd+K` / `Ctrl+K`)
4. Leave search input empty

**Expected Results:**
- ✅ "Recent Searches" section appears
- ✅ Previous search queries are listed
- ✅ Most recent search appears first
- ✅ Can navigate to recent searches with Arrow keys
- ✅ Pressing Enter on a recent search executes that search

**Status:** Pass / Fail

---

### 1.9 Complete Keyboard-Only Workflow

**Test Steps:**
1. Open palette: `Cmd+K` or `Ctrl+K`
2. Type search query: "test"
3. Navigate to filter: `Tab`
4. Activate filter: `Enter`
5. Return to input: `Shift+Tab`
6. Navigate results: `Arrow Down`
7. Select result: `Enter`

**Expected Results:**
- ✅ Entire workflow completes without touching mouse
- ✅ All interactions respond immediately
- ✅ Focus indicators are always visible
- ✅ No focus traps or dead ends

**Status:** Pass / Fail

---

## 2. Screen Reader Testing

### 2.1 VoiceOver (Mac)

**Setup:**
- Enable VoiceOver: `Cmd+F5`
- Basic navigation: `VO+Arrow keys` (VO = Ctrl+Option)

**Test Steps:**
1. Open command palette (`Cmd+K`)
2. Listen for VoiceOver announcements

**Expected Announcements:**
- ✅ "Search projects, tasks, cost analyses, sessions, edit text" (input field)
- ✅ Input field is identified as editable text
- ✅ Placeholder text is announced

**Test Steps:**
3. Type "test" in search input
4. Navigate to filter buttons with `Tab`

**Expected Announcements:**
- ✅ "Projects, button" (button is identified)
- ✅ Button state (whether selected/not selected)
- ✅ "Tasks, button", "Cost Analyses, button", etc.

**Test Steps:**
5. Navigate through search results with `Arrow Down`

**Expected Announcements:**
- ✅ Result title is read aloud
- ✅ Entity type is identified (Project, Task, etc.)
- ✅ "Selected" state is announced for highlighted items

**Test Steps:**
6. Navigate to clear button

**Expected Announcements:**
- ✅ "Clear search, button"
- ✅ Button purpose is clear from label

**Status:** Pass / Fail

---

### 2.2 NVDA (Windows)

**Setup:**
- Start NVDA
- Basic navigation: Arrow keys and Tab

**Test Steps:**
1. Open command palette (`Ctrl+K`)
2. Listen for NVDA announcements

**Expected Announcements:**
- ✅ Input field is announced with placeholder text
- ✅ "Search projects, tasks, cost analyses, sessions, edit"
- ✅ Field type is clearly identified

**Test Steps:**
3. Tab through filter buttons

**Expected Announcements:**
- ✅ "Projects, button"
- ✅ Button state (pressed/not pressed) if applicable
- ✅ All filter buttons are identified as buttons

**Test Steps:**
4. Navigate search results

**Expected Announcements:**
- ✅ Result content is read
- ✅ Entity type is announced
- ✅ Selected state is clear

**Status:** Pass / Fail

---

### 2.3 JAWS (Windows)

**Setup:**
- Start JAWS
- Navigate with Tab and Arrow keys

**Test Steps:**
1. Open command palette
2. Verify JAWS reads input field with placeholder
3. Tab through filters and verify button announcements
4. Navigate results and verify content is read correctly

**Expected Results:**
- ✅ All interactive elements are announced
- ✅ Element types (button, text field) are clear
- ✅ Selected/focused states are announced
- ✅ Search results are readable and navigable

**Status:** Pass / Fail

---

## 3. ARIA Attributes Verification

Use browser DevTools to inspect ARIA attributes:

### 3.1 Search Input

**Inspect Element:**
```html
<input placeholder="Search projects, tasks, cost analyses, sessions..." />
```

**Verify:**
- ✅ Has descriptive placeholder attribute
- ✅ No missing or incorrect ARIA labels
- ✅ Properly identified as text input

---

### 3.2 Clear Button

**Inspect Element:**
```html
<button aria-label="Clear search">
  <X className="..." />
</button>
```

**Verify:**
- ✅ Has `aria-label="Clear search"`
- ✅ Label describes button purpose
- ✅ Icon-only button is accessible

---

### 3.3 Filter Buttons

**Inspect Element:**
```html
<button data-testid="filter-projects">
  <FolderKanban />
  <span>Projects</span>
</button>
```

**Verify:**
- ✅ Contains visible text label ("Projects", "Tasks", etc.)
- ✅ Icon + text combination is accessible
- ✅ Button purpose is clear

---

### 3.4 Backdrop

**Inspect Element:**
```html
<div aria-hidden="true" className="backdrop..." />
```

**Verify:**
- ✅ Has `aria-hidden="true"`
- ✅ Not announced to screen readers
- ✅ Does not interfere with navigation

---

### 3.5 Search Results

**Inspect Command.Item elements:**

**Verify:**
- ✅ cmdk library adds proper ARIA attributes
- ✅ `aria-selected="true"` on highlighted items
- ✅ Items are keyboard navigable
- ✅ Selection state is properly managed

---

## 4. Visual Focus Indicators

### 4.1 Focus Ring Visibility

**Test Steps:**
1. Open command palette
2. Tab through all interactive elements
3. Verify focus indicators are clearly visible

**Expected Results:**
- ✅ Search input shows focus ring or border change
- ✅ Filter buttons show focus ring (outline or shadow)
- ✅ Search results show highlight background when focused
- ✅ Focus indicators have sufficient contrast (WCAG 2.1 Level AA: 3:1)

**Status:** Pass / Fail

---

### 4.2 Color Contrast

**Test with Contrast Checker:**

**Elements to Check:**
- ✅ Search input placeholder text: minimum 4.5:1 ratio
- ✅ Filter button text: minimum 4.5:1 ratio
- ✅ Active filter background: minimum 3:1 ratio
- ✅ Search result text: minimum 4.5:1 ratio
- ✅ Focus indicators: minimum 3:1 ratio

**Tools:**
- Chrome DevTools → Accessibility panel
- WebAIM Contrast Checker
- axe DevTools browser extension

**Status:** Pass / Fail

---

## 5. Keyboard Shortcuts Display

### 5.1 Footer Hints

**Test Steps:**
1. Open command palette
2. Scroll to bottom footer

**Expected Results:**
- ✅ Footer displays keyboard hints
- ✅ Visual representations of keys (↑↓, ↵, Esc, ⌘K)
- ✅ Text labels explain each shortcut:
  - "Navigate" for arrow keys
  - "Select" for Enter
  - "Close" for Escape
- ✅ Hints are visible and legible

**Status:** Pass / Fail

---

## 6. Mobile/Touch Accessibility

### 6.1 Touch Targets

**Test on mobile device or responsive mode:**

**Expected Results:**
- ✅ Filter buttons are at least 44x44 pixels (iOS) or 48x48 pixels (Android)
- ✅ Search results are tappable without precision aiming
- ✅ Clear button is easily tappable
- ✅ No overlapping touch targets

**Status:** Pass / Fail

---

## 7. Edge Cases

### 7.1 No Results State

**Test Steps:**
1. Search for non-existent term: "xyz123abc456"
2. Verify empty state appears

**Expected Results:**
- ✅ "No results found" message appears
- ✅ Helpful text: "Try adjusting your search query"
- ✅ Icon and text are centered and visible
- ✅ Keyboard navigation still works (can close with Escape)

**Status:** Pass / Fail

---

### 7.2 Loading State

**Test Steps:**
1. Type a search query
2. Observe loading indicator

**Expected Results:**
- ✅ Spinner icon appears during search
- ✅ Loading state is visually indicated
- ✅ Keyboard navigation remains functional during loading
- ✅ No jarring layout shifts

**Status:** Pass / Fail

---

### 7.3 Long Result Lists

**Test Steps:**
1. Search for a common term that returns many results
2. Navigate through results with Arrow keys

**Expected Results:**
- ✅ Results list is scrollable
- ✅ Keyboard navigation scrolls list automatically
- ✅ Highlighted item stays visible (auto-scroll)
- ✅ Scroll is smooth and performant

**Status:** Pass / Fail

---

## 8. Browser Compatibility

Test the above scenarios in multiple browsers:

- [ ] **Chrome/Edge** (Chromium)
- [ ] **Firefox**
- [ ] **Safari** (Mac)
- [ ] **Mobile Safari** (iOS)
- [ ] **Chrome Mobile** (Android)

**Expected Results:**
- ✅ Keyboard shortcuts work in all browsers
- ✅ Focus indicators appear consistently
- ✅ ARIA labels are respected
- ✅ No browser-specific bugs

---

## 9. Success Criteria Summary

The command palette passes accessibility testing if:

1. ✅ All interactions are possible via keyboard alone
2. ✅ Screen readers announce all interactive elements correctly
3. ✅ Focus indicators are always visible and meet contrast requirements
4. ✅ ARIA labels are present and descriptive
5. ✅ No keyboard traps exist
6. ✅ Tab order is logical and intuitive
7. ✅ Enter and Space keys activate buttons
8. ✅ Escape key closes the palette
9. ✅ Arrow keys navigate results
10. ✅ Works across major browsers and screen readers

---

## 10. Common Issues and Fixes

### Issue: Focus not visible
**Fix:** Ensure focus ring styles are not removed by CSS. Add custom focus styles if needed.

### Issue: Screen reader not announcing elements
**Fix:** Add proper ARIA labels and roles. Ensure semantic HTML is used.

### Issue: Keyboard shortcut not working
**Fix:** Check for event listener conflicts. Verify `preventDefault()` is called.

### Issue: Tab order is confusing
**Fix:** Use semantic HTML order. Avoid `tabIndex` values > 0.

### Issue: Can't close with Escape
**Fix:** Ensure Escape key listener is properly attached and not blocked.

---

## Conclusion

Complete all test sections and mark status as Pass/Fail. Document any issues found and create tickets for remediation. Accessibility is not optional—it ensures all users can effectively use the search functionality regardless of their abilities or assistive technologies.

**Testing completed by:** _______________
**Date:** _______________
**Overall Status:** Pass / Fail
**Notes:** _______________
