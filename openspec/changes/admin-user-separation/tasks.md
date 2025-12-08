# Tasks: Admin/User UI Separation

## Phase 1: Route Infrastructure

### Backend Tasks

- [ ] **TASK-AUS-001**: Add isEmployee flag to user session
  - Check if user has linked employee profile
  - Add employeeProfileId to session data
  - Update auth middleware to populate flags
  - File: `backend/src/middleware/auth.ts`

- [ ] **TASK-AUS-002**: Create view preference endpoints
  - GET /api/me/view-preference - get current view
  - PUT /api/me/view-preference - set view preference
  - Store in user settings or separate table
  - File: `backend/src/routes/me.routes.ts`

- [ ] **TASK-AUS-003**: Add route-level access guards
  - AdminOnly middleware for /admin/* routes
  - EmployeeOnly middleware for user routes
  - Return appropriate error codes (403)
  - File: `backend/src/middleware/route-guards.ts`

### Frontend Tasks

- [x] **TASK-AUS-004**: Create ViewContext for view state management
  - Track current view ('admin' | 'user')
  - Persist preference to localStorage and API
  - Provide view switching function
  - File: `frontend/src/contexts/ViewContext.tsx`
  - **Completed:** Full ViewContext with capabilities tracking, localStorage persistence

- [x] **TASK-AUS-005**: Restructure routes with /admin prefix
  - Move admin pages under /admin/*
  - Keep user pages at root level
  - Add redirects for old URLs
  - File: `frontend/src/App.tsx`
  - **Completed:** Routes restructured with /admin prefix, path mapping implemented

- [ ] **TASK-AUS-006**: Create AdminRoute guard component
  - Check user.isAdmin before rendering
  - Redirect to home if not admin
  - Show appropriate message
  - File: `frontend/src/components/routes/AdminRoute.tsx`
  - **Note:** Currently using conditional rendering in App.tsx instead

- [ ] **TASK-AUS-007**: Create EmployeeRoute guard component
  - Check user.isEmployee before rendering
  - Redirect to /admin if not employee (for external admins)
  - Show appropriate message
  - File: `frontend/src/components/routes/EmployeeRoute.tsx`
  - **Note:** Currently using conditional rendering in App.tsx instead

## Phase 2: Navigation Separation

### Frontend Tasks

- [x] **TASK-AUS-008**: Create AdminNavigation component
  - Dashboard, Directory (Users, Groups, Devices)
  - Security (Audit Logs, Policies)
  - Settings (Modules, Master Data, Organization, Integrations)
  - File: `frontend/src/components/navigation/AdminNavigation.tsx`
  - **Completed:** Full AdminNavigation with all sections

- [x] **TASK-AUS-009**: Create UserNavigation component
  - Home, People, My Team, My Groups
  - My Profile, Settings (personal)
  - File: `frontend/src/components/navigation/UserNavigation.tsx`
  - **Completed:** UserNavigation with People, My Team, My Profile sections

- [x] **TASK-AUS-010**: Update Sidebar to use view-based navigation
  - Render AdminNavigation or UserNavigation based on currentView
  - Pass appropriate props and handlers
  - File: `frontend/src/components/Sidebar.tsx`
  - **Completed:** Sidebar renders view-specific navigation based on currentView

- [x] **TASK-AUS-011**: Create ViewSwitcher component
  - Dropdown with Admin Console / Employee View options
  - Only visible for internal admins (isAdmin && isEmployee)
  - Navigate to appropriate home on switch
  - File: `frontend/src/components/navigation/ViewSwitcher.tsx`
  - **Completed:** Full ViewSwitcher with dropdown, icons, and styling

- [x] **TASK-AUS-012**: Add ViewSwitcher to Header
  - Position before user avatar
  - Show current view label
  - File: `frontend/src/components/Header.tsx` (in App.tsx)
  - **Completed:** ViewSwitcher added to header in App.tsx

## Phase 3: User Type Detection

### Backend Tasks

- [ ] **TASK-AUS-013**: Add is_external_admin column to organization_users
  - Boolean flag, default false
  - Migration file for schema change
  - File: `database/migrations/035_add_admin_user_separation.sql`

- [ ] **TASK-AUS-014**: Update user creation to set admin type
  - External admins created without employee profile link
  - Internal admins have employee profile
  - Update admin invite flow
  - File: `backend/src/routes/users.routes.ts`

- [ ] **TASK-AUS-015**: Update login response with access flags
  - Include canAccessAdminUI and canAccessUserUI
  - Include defaultView based on user type
  - File: `backend/src/routes/auth.routes.ts`

### Frontend Tasks

- [ ] **TASK-AUS-016**: Update AuthContext with access flags
  - Store canAccessAdminUI, canAccessUserUI
  - Derive from user session data
  - File: `frontend/src/contexts/AuthContext.tsx`

- [ ] **TASK-AUS-017**: Implement default view logic on login
  - External admin → always Admin Console
  - Internal admin → Admin Console (or remembered)
  - Regular user → always Employee View
  - File: `frontend/src/pages/Login.tsx`

## Phase 4: Page Relocation

### Frontend Tasks

- [ ] **TASK-AUS-018**: Move admin pages to /admin routes
  - /admin/dashboard - Admin Dashboard
  - /admin/users - User Management
  - /admin/groups - Group Management
  - /admin/settings/* - System Settings
  - File: `frontend/src/App.tsx`

- [ ] **TASK-AUS-019**: Configure user pages at root routes
  - /dashboard or /home - User Home
  - /people - People Directory
  - /my-team - My Team View
  - /my-profile - My Profile
  - /settings - Personal Settings
  - File: `frontend/src/App.tsx`

- [ ] **TASK-AUS-020**: Create redirect handlers for legacy URLs
  - /users → /admin/users
  - /groups → /admin/groups
  - Preserve query params
  - File: `frontend/src/App.tsx`

- [ ] **TASK-AUS-021**: Update all internal navigation links
  - Update Link components in admin pages
  - Update Link components in user pages
  - Update breadcrumbs
  - Files: Multiple page and component files

## Phase 5: Access Control Polish

### Backend Tasks

- [ ] **TASK-AUS-022**: Add API-level access checks for user endpoints
  - /api/people/* requires isEmployee
  - /api/me/team requires isEmployee
  - Return 403 for external admins
  - File: `backend/src/routes/people.routes.ts`

- [ ] **TASK-AUS-023**: Add audit logging for view switches
  - Log when user switches views
  - Track view preference changes
  - File: `backend/src/services/activity-tracker.service.ts`

### Frontend Tasks

- [ ] **TASK-AUS-024**: Add "Switch to Employee View" prompt for internal admins
  - Show on first login if internal admin
  - Explain the two views
  - Allow preference setting
  - File: `frontend/src/components/ViewOnboarding.tsx`

- [ ] **TASK-AUS-025**: Handle edge cases in navigation
  - Deep link to admin route as user → redirect
  - Deep link to user route as external admin → redirect
  - Session expiry during view switch
  - File: `frontend/src/components/routes/*.tsx`

## Testing Tasks

- [ ] **TASK-AUS-T01**: E2E tests for external admin flow
  - Login as external admin
  - Verify no People/My Team in nav
  - Verify no view switcher
  - Verify /people redirects to /admin
  - File: `e2e/tests/admin-user-separation.spec.ts`

- [ ] **TASK-AUS-T02**: E2E tests for internal admin flow
  - Login as internal admin
  - Verify view switcher visible
  - Test switching between views
  - Verify navigation changes
  - File: `e2e/tests/admin-user-separation.spec.ts`

- [ ] **TASK-AUS-T03**: E2E tests for regular user flow
  - Login as regular user
  - Verify no admin nav items
  - Verify /admin/* redirects to /
  - Verify no view switcher
  - File: `e2e/tests/admin-user-separation.spec.ts`

- [ ] **TASK-AUS-T04**: API tests for route guards
  - Test admin endpoints require isAdmin
  - Test employee endpoints require isEmployee
  - Test proper 403 responses
  - File: `backend/src/__tests__/route-guards.test.ts`

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Route Infrastructure | 7 tasks | 1-2 days |
| Phase 2: Navigation Separation | 5 tasks | 1-2 days |
| Phase 3: User Type Detection | 5 tasks | 1 day |
| Phase 4: Page Relocation | 4 tasks | 1 day |
| Phase 5: Access Control | 4 tasks | 1 day |
| Testing | 4 tasks | 1 day |

**Total: ~6-9 days**

## Dependencies

```
TASK-AUS-001 (backend flags)
  └── TASK-AUS-004 (ViewContext)
       └── TASK-AUS-010 (Sidebar update)
            └── TASK-AUS-011 (ViewSwitcher)

TASK-AUS-005 (route restructure)
  └── TASK-AUS-006, TASK-AUS-007 (guards)
       └── TASK-AUS-018, TASK-AUS-019 (page moves)
            └── TASK-AUS-020 (redirects)

TASK-AUS-013 (migration)
  └── TASK-AUS-014 (user creation)
       └── TASK-AUS-015 (login response)
            └── TASK-AUS-016 (AuthContext)
```

## Implementation Notes

### Backward Compatibility
- Keep old routes working with redirects for 2 releases
- Log deprecated route usage for monitoring
- Update documentation and help text

### Performance Considerations
- View preference should be cached client-side
- Navigation components should be lazy-loaded per view
- Minimize re-renders on view switch

### Security Considerations
- Always verify access on backend, never trust frontend
- Rate limit view switch API to prevent abuse
- Audit all access control changes
