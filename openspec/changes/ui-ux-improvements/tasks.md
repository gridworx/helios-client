# UI/UX Improvements - Implementation Tasks

## P0 - Critical (This Sprint)

### 1. Fix Module Page Button Layout
- [ ] 1.1 Create ButtonGroup component with consistent sizing
- [ ] 1.2 Refactor Settings.tsx Modules tab buttons
- [ ] 1.3 Set minimum button width (100px)
- [ ] 1.4 Set fixed button height (36px)
- [ ] 1.5 Add flexbox wrap for responsive behavior
- [ ] 1.6 Move "Disable" to dropdown menu
- [ ] 1.7 Test on mobile viewport

### 2. Replace Emoji with Lucide Icons
- [ ] 2.1 App.tsx: Replace header emoji (🏢, 🔍, 🔔)
- [ ] 2.2 UserList.tsx: Replace bulk action emoji (✅, ⏸️, 🗑️)
- [ ] 2.3 UserList.tsx: Replace empty state emoji (👥)
- [ ] 2.4 Search all files for remaining emoji usage
- [ ] 2.5 Verify no emoji in production build

### 3. Fix Table Row Heights and Spacing
- [ ] 3.1 UserList.css: Set row height to 48px
- [ ] 3.2 Groups.css: Set row height to 48px
- [ ] 3.3 Add consistent padding (0 16px)
- [ ] 3.4 Set column gap to 16px
- [ ] 3.5 Add subtle hover state (#f9fafb)
- [ ] 3.6 Test with long content (text overflow)

---

## P1 - High (Next Sprint)

### 4. Create PlatformBadge Component
- [ ] 4.1 Create `components/ui/PlatformBadge.tsx`
- [ ] 4.2 Support platforms: google, microsoft, slack, okta, local
- [ ] 4.3 Use proper SVG icons or Lucide approximations
- [ ] 4.4 Add tooltip showing full platform name
- [ ] 4.5 Replace text badges in UserList.tsx
- [ ] 4.6 Replace text badges in Groups.tsx
- [ ] 4.7 Add to DESIGN-SYSTEM.md documentation

### 5. Dynamic Org Chart Implementation
- [ ] 5.1 Refactor OrgChart.tsx to build from manager_id
- [ ] 5.2 Create tree data structure from users
- [ ] 5.3 Identify and display orphaned users section
- [ ] 5.4 Add click handler to navigate to user detail
- [ ] 5.5 Implement expand/collapse for branches
- [ ] 5.6 Add user count indicators on collapsed nodes
- [ ] 5.7 Style orphaned users section distinctly
- [ ] 5.8 Test with various org structures

### 6. Navigation Terminology Update
- [ ] 6.1 Rename "Org Units" to "Departments" in sidebar
- [ ] 6.2 Update page title and breadcrumbs
- [ ] 6.3 Update any references in Settings
- [ ] 6.4 Update backend routes if needed
- [ ] 6.5 Update documentation

---

## P2 - Medium (Backlog)

### 7. Navigation Structure Reorganization
- [ ] 7.1 Move Org Chart under new "Organization" section
- [ ] 7.2 Flatten Automation section (remove if empty)
- [ ] 7.3 Flatten Insights into Reports
- [ ] 7.4 Add conditional visibility for features
- [ ] 7.5 Update sidebar collapse behavior
- [ ] 7.6 Test navigation flow with new structure

### 8. Asset Management Improvements
- [ ] 8.1 Rename to "Devices" in navigation
- [ ] 8.2 Create device type icons (Laptop, Smartphone, etc.)
- [ ] 8.3 Add GW device sync capability
- [ ] 8.4 Show sync status on devices page
- [ ] 8.5 Match table styling with Users/Groups

### 9. Org Chart Export
- [ ] 9.1 Implement PDF export
- [ ] 9.2 Implement PNG export
- [ ] 9.3 Add print-friendly styles
- [ ] 9.4 Include org name and date on exports

---

## P3 - Nice to Have

### 10. Visual Polish
- [ ] 10.1 Add subtle animations on hover/click
- [ ] 10.2 Improve loading state skeletons
- [ ] 10.3 Add empty state illustrations
- [ ] 10.4 Refine color contrast for accessibility

---

## Verification Checklist

After completing P0 tasks:
- [ ] No emoji visible in any page
- [ ] Module buttons same size, responsive
- [ ] Table rows comfortable (48px height)
- [ ] All icons from Lucide library
- [ ] Mobile viewport works correctly

After completing P1 tasks:
- [ ] Platform badges show recognizable icons
- [ ] Org Chart builds automatically
- [ ] Clicking user in Org Chart opens detail
- [ ] Orphaned users visible in Org Chart
- [ ] "Departments" label in navigation

---

## Files to Modify

### P0
- `frontend/src/App.tsx` - Header icons
- `frontend/src/components/Settings.tsx` - Module buttons
- `frontend/src/components/Settings.css` - Button styles
- `frontend/src/components/UserList.tsx` - Emoji, table
- `frontend/src/components/UserList.css` - Row heights
- `frontend/src/pages/Groups.tsx` - Table styling

### P1
- `frontend/src/components/ui/PlatformBadge.tsx` - New
- `frontend/src/pages/OrgChart.tsx` - Dynamic rebuild
- `frontend/src/pages/OrgChart.css` - Orphan section
- `frontend/src/App.tsx` - Nav labels

### P2
- `frontend/src/App.tsx` - Nav structure
- `frontend/src/pages/AssetManagement.tsx` - Rename, icons
- Backend sync services (if GW device sync added)
