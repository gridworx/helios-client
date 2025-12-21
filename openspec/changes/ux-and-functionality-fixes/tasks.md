# UX & Functionality Fixes - Tasks (TDD Approach)

## Phase 1: Data Integrity Fixes

### TASK-FIX-001: Fix Deleted Users Count Mismatch
- [ ] Write test: Verify deleted count in header matches table row count
- [ ] Investigate count query in UsersPage.tsx
- [ ] Fix count to use same filter logic as table query
- [ ] Verify all status counts (Active, Staged, Suspended, Deleted) are accurate

**Test First:**
```typescript
test('deleted users count matches displayed rows', async ({ page }) => {
  await page.goto('/admin/users');
  await page.click('[data-testid="filter-deleted"]');
  const countBadge = await page.locator('[data-testid="deleted-count"]').textContent();
  const rowCount = await page.locator('tbody tr').count();
  expect(parseInt(countBadge)).toBe(rowCount);
});
```

### TASK-FIX-002: Normalize Department Field (Strip OU Paths)
- [ ] Write test: Department should not contain "/" characters
- [ ] Find where Google OU path is being stored as department
- [ ] Create normalization function to extract department name
- [ ] Apply on sync and on display
- [ ] Update existing records with migration or script

**Test First:**
```typescript
test('department displays clean name without OU path', async ({ page }) => {
  await page.goto('/admin/users');
  const departments = await page.locator('[data-testid="user-department"]').allTextContents();
  departments.forEach(dept => {
    expect(dept).not.toContain('/');
  });
});
```

---

## Phase 2: Users Page Header Redesign

### TASK-FIX-003: Redesign Stats Cards Layout
- [ ] Write test: Stats cards have proper spacing and alignment
- [ ] Update CSS for stats cards container
- [ ] Add proper gap between cards
- [ ] Ensure consistent card heights

### TASK-FIX-004: Fix INTEGRATIONS/STATUS Column Blending
- [ ] Write test: Column headers have clear visual separation
- [ ] Add proper column width constraints
- [ ] Add subtle border or spacing between columns
- [ ] Ensure text doesn't wrap unexpectedly

### TASK-FIX-005: Align Search Box with Filters
- [ ] Write test: Search box and filter buttons are horizontally aligned
- [ ] Reduce search box height to match button height
- [ ] Use flexbox with proper alignment
- [ ] Consistent border-radius across all elements

**Test First:**
```typescript
test('search box and filter buttons are aligned', async ({ page }) => {
  await page.goto('/admin/users');
  const searchBox = await page.locator('[data-testid="search-input"]').boundingBox();
  const filterBtn = await page.locator('[data-testid="filter-button"]').boundingBox();
  // Verify vertical center alignment (within 2px tolerance)
  const searchCenter = searchBox.y + searchBox.height / 2;
  const filterCenter = filterBtn.y + filterBtn.height / 2;
  expect(Math.abs(searchCenter - filterCenter)).toBeLessThan(3);
});
```

---

## Phase 3: Filter Panel Implementation

### TASK-FIX-006: Implement Filter Button Click Handler
- [ ] Write test: Clicking filter icon opens filter panel
- [ ] Create FilterPanel component
- [ ] Add state for panel visibility
- [ ] Wire onClick to toggle panel

### TASK-FIX-007: Implement Column Visibility Toggle
- [ ] Write test: Clicking columns icon opens column selector
- [ ] Create ColumnSelector component
- [ ] Allow hiding/showing columns
- [ ] Persist preference to localStorage

### TASK-FIX-008: Add Date-Based Filters
- [ ] Write test: Can filter by "Recently Created" (last 7 days)
- [ ] Write test: Can filter by date created range
- [ ] Write test: Can filter by last login date range
- [ ] Add date picker components
- [ ] Implement filter logic in API query

### TASK-FIX-009: Add Property Filters
- [ ] Write test: Can filter by department
- [ ] Write test: Can filter by role
- [ ] Write test: Can filter by integration status (Google/Microsoft/None)
- [ ] Add dropdown selectors for each filter
- [ ] Combine filters with AND logic

**Test First:**
```typescript
test('filter panel opens and filters by recently created', async ({ page }) => {
  await page.goto('/admin/users');
  await page.click('[data-testid="filter-button"]');
  await expect(page.locator('.filter-panel')).toBeVisible();
  await page.click('[data-testid="filter-recently-created"]');
  // Verify only users created in last 7 days shown
  const dates = await page.locator('[data-testid="user-created-date"]').allTextContents();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  dates.forEach(dateStr => {
    expect(new Date(dateStr).getTime()).toBeGreaterThan(sevenDaysAgo.getTime());
  });
});
```

---

## Phase 4: User Slideout Layout Redesign

### TASK-FIX-010: Redesign Overview Tab to 2-Column Layout
- [ ] Write test: Profile fields use 2-column grid on desktop
- [ ] Update UserSlideOut.tsx Overview section
- [ ] Create `.info-grid-2col` CSS class
- [ ] Group related fields: Name row, Email/Phone row, Job/Dept row, etc.

### TASK-FIX-011: Improve Field Grouping
- [ ] Write test: Related fields are visually grouped
- [ ] Add section dividers between User Info, Profile Info, Account Info
- [ ] Ensure consistent label styling
- [ ] Add proper spacing between sections

**Test First:**
```typescript
test('user slideout uses 2-column layout for profile fields', async ({ page }) => {
  await page.goto('/admin/users');
  await page.click('[data-testid="user-row"]');
  const grid = page.locator('.info-grid-2col');
  await expect(grid).toBeVisible();
  const gridStyle = await grid.evaluate(el => getComputedStyle(el).display);
  expect(gridStyle).toBe('grid');
});
```

---

## Phase 5: Fix Add to Group Functionality

### TASK-FIX-012: Debug Add to Group API Call
- [ ] Write test: Adding user to group persists in database
- [ ] Check network tab for API call on add
- [ ] Verify endpoint `/api/v1/groups/:id/members` exists and works
- [ ] Fix any missing request body or auth issues

### TASK-FIX-013: Add Success/Error Toast for Group Actions
- [ ] Write test: Success toast appears after adding to group
- [ ] Write test: Error toast appears if add fails
- [ ] Import and use toast from Toast component
- [ ] Show group name in success message

### TASK-FIX-014: Refresh Group List After Add
- [ ] Write test: Group list updates after successful add
- [ ] Call refetch/refresh after successful API call
- [ ] Optimistic UI update if desired

**Test First:**
```typescript
test('adding user to group shows success and persists', async ({ page }) => {
  await page.goto('/admin/users');
  await page.click('[data-testid="user-row-david"]');
  await page.click('[data-testid="tab-groups"]');
  await page.click('[data-testid="btn-add-to-group"]');
  await page.click('[data-testid="group-option-all-users"]');
  await page.click('[data-testid="btn-confirm-add"]');
  await expect(page.locator('.toast-success')).toBeVisible();
  // Verify group now appears in list
  await expect(page.locator('[data-testid="group-all-users"]')).toBeVisible();
});
```

---

## Phase 6: Fix Create in Google Workspace

### TASK-FIX-015: Debug Google Workspace User Creation
- [ ] Write test: Creating user with GW checkbox calls GW API
- [ ] Check if user is created in Helios first
- [ ] Verify Google Admin SDK credentials are configured
- [ ] Check for silent error handling that swallows errors

### TASK-FIX-016: Add Error Handling for GW Creation
- [ ] Write test: Error toast shown if GW creation fails
- [ ] Wrap GW API call in try/catch
- [ ] Show specific error message (quota, permissions, etc.)
- [ ] Still create Helios user even if GW fails (with warning)

### TASK-FIX-017: Fix User Creation Flow
- [ ] Write test: User appears in Helios after creation
- [ ] Debug why user isn't being created at all
- [ ] Check for validation errors not being shown
- [ ] Verify database insert is happening

**Test First:**
```typescript
test('create user with GW creates in Helios and shows feedback', async ({ page }) => {
  await page.goto('/admin/users');
  await page.click('[data-testid="btn-add-user"]');
  await page.fill('[name="firstName"]', 'Test');
  await page.fill('[name="lastName"]', 'User');
  await page.fill('[name="email"]', 'test.user@example.com');
  await page.check('[data-testid="create-in-gw"]');
  await page.click('[data-testid="btn-submit"]');
  // Should see either success or error toast
  const toast = page.locator('.toast');
  await expect(toast).toBeVisible();
  // Verify user exists in list
  await page.goto('/admin/users');
  await expect(page.locator('text=test.user@example.com')).toBeVisible();
});
```

---

## Phase 7: Activity Log Population

### TASK-FIX-018: Log Group Membership Changes
- [ ] Write test: Activity log shows group add/remove events
- [ ] Add activity_logs insert in group membership endpoints
- [ ] Include actor, action, target, timestamp

### TASK-FIX-019: Log Google Workspace Sync Events
- [ ] Write test: Activity log shows GW sync attempts
- [ ] Add activity_logs insert in GW service
- [ ] Log success and failures with details

### TASK-FIX-020: Log Status Changes
- [ ] Write test: Activity log shows status changes
- [ ] Add activity_logs insert in user status update endpoint
- [ ] Include old status, new status, actor

### TASK-FIX-021: Display Activity Log in Slideout
- [ ] Write test: Activity tab shows recent events
- [ ] Fetch from `/api/v1/users/:id/activity`
- [ ] Display with timestamps and actor names
- [ ] Add pagination or "load more"

**Test First:**
```typescript
test('activity log shows recent user events', async ({ page }) => {
  // First make a change
  await page.goto('/admin/users');
  await page.click('[data-testid="user-row-david"]');
  await page.click('[data-testid="tab-settings"]');
  await page.selectOption('[name="status"]', 'suspended');
  await page.click('[data-testid="btn-save"]');

  // Check activity log
  await page.click('[data-testid="tab-activity"]');
  await expect(page.locator('.activity-item')).toHaveCount({ min: 1 });
  await expect(page.locator('text=status changed')).toBeVisible();
});
```

---

## Phase 8: Scheduled Actions Page Fix

### TASK-FIX-022: Fix Scheduled Actions Layout
- [ ] Write test: Empty state is full-width centered
- [ ] Remove split-panel layout for empty state
- [ ] Show full-width card with empty illustration
- [ ] When items exist, use proper table or card list

### TASK-FIX-023: Add Proper Split-Panel (Optional)
- [ ] Write test: Clicking an action shows details panel
- [ ] Only show split layout when item selected
- [ ] Left: list, Right: details
- [ ] Or use slideout pattern consistent with Users page

**Test First:**
```typescript
test('scheduled actions empty state is full width', async ({ page }) => {
  await page.goto('/admin/scheduled-actions');
  const emptyState = page.locator('.empty-state');
  await expect(emptyState).toBeVisible();
  const box = await emptyState.boundingBox();
  const pageWidth = page.viewportSize().width;
  // Empty state should be centered and reasonably wide
  expect(box.width).toBeGreaterThan(pageWidth * 0.5);
});
```

---

## Verification Checklist

- [ ] Deleted count matches actual deleted users
- [ ] Department shows clean name (no OU paths)
- [ ] Stats cards properly spaced
- [ ] Column headers clearly separated
- [ ] Search box aligned with filters
- [ ] Filter button opens filter panel
- [ ] Column visibility toggle works
- [ ] Date filters work (recently created, date range)
- [ ] Property filters work (department, role, integration)
- [ ] User slideout uses 2-column layout
- [ ] Add to group works and shows toast
- [ ] Create in Google Workspace works or shows error
- [ ] User creation flow works
- [ ] Activity log shows events
- [ ] Scheduled actions page has proper layout
- [ ] All actions show success/error feedback
- [ ] No console errors during interactions

---

## Dependencies

- Toast component (exists)
- Filter panel component (create)
- Column selector component (create)
- Activity service (may need creation)

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/UsersPage.tsx` | Count fix, header layout, filters |
| `frontend/src/pages/UsersPage.css` | Header styling, grid layout |
| `frontend/src/components/UserSlideOut.tsx` | 2-col layout, group fix, activity |
| `frontend/src/components/UserSlideOut.css` | Grid styling |
| `frontend/src/components/FilterPanel.tsx` | NEW - filter UI |
| `frontend/src/components/ColumnSelector.tsx` | NEW - column visibility |
| `frontend/src/pages/ScheduledActionsPage.tsx` | Layout fix |
| `backend/src/routes/groups.routes.ts` | Fix add member |
| `backend/src/routes/user.routes.ts` | Fix creation, add logging |
| `backend/src/services/activity.service.ts` | NEW or enhance |
| `backend/src/services/google-workspace.service.ts` | Error handling |
