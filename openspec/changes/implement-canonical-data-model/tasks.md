# Implementation Tasks - Canonical Data Model

## Phase 1: Foundation - Database & Backend (6-8 hours)

### Database Schema
- [ ] Create migration `019_create_canonical_data_model.sql`
  - [ ] Create `custom_labels` table with constraints
  - [ ] Add indexes for organization_id lookups
  - [ ] Add CHECK constraints for character limits
  - [ ] Add audit columns (created_by, updated_by, timestamps)
- [ ] Create seed function `seedDefaultLabels(organizationId)`
  - [ ] Define default labels for all canonical entities
  - [ ] Insert defaults: entity.user, entity.workspace, entity.access_group, entity.policy_container, entity.device
- [ ] Update organization creation to seed labels
  - [ ] Modify `POST /api/organization/setup` to call seed function
- [ ] Test migration up and down
- [ ] Verify defaults for existing organizations

### Backend - Label Service
- [ ] Create `backend/src/services/label.service.ts`
  - [ ] Implement `getLabels(organizationId)` - Returns all labels for org
  - [ ] Implement `getLabel(organizationId, canonicalName)` - Single label lookup
  - [ ] Implement `updateLabels(organizationId, labels)` - Bulk update
  - [ ] Implement `validateLabel(label)` - XSS, length, special char validation
  - [ ] Add caching logic (optional Redis integration)
- [ ] Add unit tests for label validation
  - [ ] Test: Max 30 characters
  - [ ] Test: XSS prevention (strip HTML)
  - [ ] Test: Special character handling
  - [ ] Test: Empty string rejection

### Backend - Label API Routes
- [ ] Create `backend/src/routes/labels.routes.ts`
  - [ ] GET `/api/organization/labels` - Get all labels for current org
  - [ ] PATCH `/api/organization/labels` - Update labels (admin only)
  - [ ] Add authentication middleware
  - [ ] Add admin role check
  - [ ] Add request validation
- [ ] Register routes in `backend/src/index.ts`
- [ ] Add integration tests
  - [ ] Test: Get labels returns defaults
  - [ ] Test: Update labels persists changes
  - [ ] Test: Non-admin cannot update
  - [ ] Test: Invalid labels rejected

## Phase 2: Split Groups Entity (8-10 hours)

### Database - New Tables
- [ ] Add to migration `019_create_canonical_data_model.sql`
  - [ ] Create `workspaces` table
    - [ ] id, organization_id, name, description
    - [ ] type (microsoft_team, google_chat_space)
    - [ ] external_id, metadata JSONB
    - [ ] Indexes on organization_id, external_id
  - [ ] Create `access_groups` table
    - [ ] id, organization_id, name, email
    - [ ] type (google_group, m365_security_group, m365_distribution_group)
    - [ ] external_id, metadata JSONB
    - [ ] Indexes on organization_id, external_id, email
  - [ ] Create `workspace_members` junction table
    - [ ] workspace_id, user_id, role
  - [ ] Create `access_group_members` junction table
    - [ ] access_group_id, user_id
- [ ] Create data migration script
  - [ ] Migrate existing `user_groups` → `access_groups`
  - [ ] Classify all as 'google_group' type
  - [ ] Preserve all metadata and relationships
  - [ ] Create rollback script

### Backend - Workspaces Routes
- [ ] Create `backend/src/routes/workspaces.routes.ts`
  - [ ] GET `/api/organization/workspaces` - List workspaces
  - [ ] POST `/api/organization/workspaces` - Create workspace
  - [ ] GET `/api/organization/workspaces/:id` - Get details
  - [ ] PATCH `/api/organization/workspaces/:id` - Update
  - [ ] DELETE `/api/organization/workspaces/:id` - Delete
  - [ ] GET `/api/organization/workspaces/:id/members` - List members
  - [ ] POST `/api/organization/workspaces/:id/members` - Add member
  - [ ] DELETE `/api/organization/workspaces/:id/members/:userId` - Remove member
- [ ] Add route tests

### Backend - Access Groups Routes
- [ ] Create `backend/src/routes/access-groups.routes.ts`
  - [ ] GET `/api/organization/access-groups` - List groups
  - [ ] POST `/api/organization/access-groups` - Create group
  - [ ] GET `/api/organization/access-groups/:id` - Get details
  - [ ] PATCH `/api/organization/access-groups/:id` - Update
  - [ ] DELETE `/api/organization/access-groups/:id` - Delete
  - [ ] GET `/api/organization/access-groups/:id/members` - List members
  - [ ] POST `/api/organization/access-groups/:id/members` - Add member
  - [ ] DELETE `/api/organization/access-groups/:id/members/:userId` - Remove member
- [ ] Add route tests

### Backend - Update Google Workspace Sync
- [ ] Update `backend/src/services/google-workspace.service.ts`
  - [ ] Modify `syncGroups()` to write to `access_groups` table
  - [ ] Add mapping logic for Google Groups
  - [ ] Preserve backward compatibility during migration
- [ ] Add sync tests

## Phase 3: Frontend Label System (8-10 hours)

### Frontend - Labels Context
- [ ] Create `frontend/src/contexts/LabelsContext.tsx`
  - [ ] Define Labels type interface
  - [ ] Create LabelsProvider component
  - [ ] Implement API call to fetch labels
  - [ ] Cache labels in context state
  - [ ] Handle loading and error states
- [ ] Create `frontend/src/hooks/useLabels.ts`
  - [ ] Export useLabels() hook
  - [ ] Provide type-safe access to labels
  - [ ] Return loading and error states
- [ ] Integrate LabelsProvider in `App.tsx`
  - [ ] Wrap app with LabelsProvider
  - [ ] Fetch labels after authentication
- [ ] Add context tests

### Frontend - Define Canonical Names
- [ ] Create `frontend/src/config/entities.ts`
  - [ ] Export CANONICAL constant with all entity names
  - [ ] Add TypeScript types for canonical names
  - [ ] Document each canonical entity
- [ ] Add type definitions

### Frontend - Refactor Navigation
- [ ] Update `frontend/src/App.tsx`
  - [ ] Replace "Users" with `{labels.entity.user.plural}`
  - [ ] Replace "Groups" with Workspaces + Access Groups
    - [ ] Add "Workspaces" nav item: `{labels.entity.workspace.plural}`
    - [ ] Add "Groups" nav item: `{labels.entity.access_group.plural}`
  - [ ] Replace "Org Units" with `{labels.entity.policy_container.plural}`
  - [ ] Update page routing for workspaces and access_groups
- [ ] Test navigation labels update dynamically

### Frontend - Create Workspaces Page
- [ ] Create `frontend/src/pages/Workspaces.tsx`
  - [ ] List view for workspaces
  - [ ] Create workspace button
  - [ ] Search and filter
  - [ ] Uses `{labels.entity.workspace.singular/plural}`
- [ ] Create `frontend/src/pages/WorkspaceDetail.tsx`
  - [ ] Workspace details
  - [ ] Members list
  - [ ] Settings
- [ ] Add workspace service
  - [ ] Create `frontend/src/services/workspaces.service.ts`
  - [ ] CRUD operations
- [ ] Add CSS files

### Frontend - Refactor Groups to Access Groups
- [ ] Rename `frontend/src/pages/Groups.tsx` → `AccessGroups.tsx`
  - [ ] Update API calls to `/access-groups`
  - [ ] Replace hardcoded "Groups" with `{labels.entity.access_group.plural}`
  - [ ] Update "Create Group" to "Create {labels.entity.access_group.singular}"
- [ ] Rename `frontend/src/pages/GroupDetail.tsx` → `AccessGroupDetail.tsx`
  - [ ] Update all label references
- [ ] Update access groups service
  - [ ] Update `frontend/src/services/groups.service.ts`
  - [ ] Point to new `/access-groups` endpoints
- [ ] Update routing in App.tsx

### Frontend - Refactor Users Page
- [ ] Update `frontend/src/pages/Users.tsx`
  - [ ] Replace "Users" with `{labels.entity.user.plural}`
  - [ ] Replace "User" with `{labels.entity.user.singular}`
  - [ ] Update page title, table headers, buttons
  - [ ] Test singular/plural usage

### Frontend - Refactor Other Pages
- [ ] Update `frontend/src/pages/OrgUnits.tsx`
  - [ ] Replace "Org Units" with `{labels.entity.policy_container.plural}`
- [ ] Update `frontend/src/pages/AssetManagement.tsx`
  - [ ] Replace "Devices" with `{labels.entity.device.plural}`
- [ ] Update dashboard stats
  - [ ] Use labels in stat cards
- [ ] Update search placeholder
  - [ ] Dynamic: "Search {labels.entity.user.plural}, {labels.entity.workspace.plural}..."

## Phase 4: Fix Customization Settings UI (4-6 hours)

### Settings - Remove localStorage
- [ ] Update `frontend/src/components/Settings.tsx`
  - [ ] Remove `customLabels` state from localStorage
  - [ ] Fetch labels from API via useLabels()
  - [ ] Remove localStorage save logic

### Settings - Redesign Customization Tab
- [ ] Update Customization tab UI
  - [ ] Remove: Devices, Workflows, Templates (not implemented)
  - [ ] Remove: Department (move to user profile section)
  - [ ] Add entity.user fields (singular, plural)
  - [ ] Add entity.workspace fields (singular, plural)
  - [ ] Add entity.access_group fields (singular, plural)
  - [ ] Add entity.policy_container fields (singular, plural)
  - [ ] Add character limit display (30/30)
  - [ ] Add contextual help text for each entity
- [ ] Add validation
  - [ ] Client-side: Max 30 characters
  - [ ] Client-side: No empty strings
  - [ ] Show validation errors
- [ ] Add preview
  - [ ] Show how labels will appear in navigation
- [ ] Add save functionality
  - [ ] PATCH to Label Service API
  - [ ] Show success/error messages
  - [ ] Update LabelsContext immediately
- [ ] Add "Reset to Defaults" button
  - [ ] Confirm dialog
  - [ ] Restore default labels
- [ ] Update CSS for new layout

### Settings - Add User Profile Attributes Section
- [ ] Create new "User Profile Fields" section
  - [ ] Show: Department, Job Title, Manager, etc.
  - [ ] Label customization for profile attributes
  - [ ] Separate from top-level entity navigation

## Phase 5: Testing & Documentation (6-8 hours)

### Unit Tests
- [ ] Label validation tests
  - [ ] Test all validation rules
  - [ ] Test edge cases (Unicode, emojis, etc.)
- [ ] Label resolution tests
  - [ ] Test singular/plural selection
  - [ ] Test fallback to defaults
- [ ] Component tests
  - [ ] Test LabelsContext provider
  - [ ] Test useLabels hook
  - [ ] Test label updates propagate

### Integration Tests
- [ ] Label Service API tests
  - [ ] Test CRUD operations
  - [ ] Test authorization
  - [ ] Test validation
- [ ] Groups migration tests
  - [ ] Test user_groups → access_groups migration
  - [ ] Test no data loss
  - [ ] Test rollback

### E2E Tests
- [ ] Create `openspec/testing/tests/canonical-model.test.ts`
  - [ ] Test: Customize labels via Settings
  - [ ] Test: Labels appear in navigation
  - [ ] Test: Labels persist after reload
  - [ ] Test: Create workspace uses custom label
  - [ ] Test: Create access group uses custom label
  - [ ] Test: Reset to defaults works
  - [ ] Test: Character limit enforced
  - [ ] Test: Admin-only access to customization
- [ ] Create `openspec/testing/tests/workspaces.test.ts`
  - [ ] Test: Create workspace
  - [ ] Test: List workspaces
  - [ ] Test: Add members to workspace
- [ ] Create `openspec/testing/tests/access-groups.test.ts`
  - [ ] Test: Create access group
  - [ ] Test: List access groups
  - [ ] Test: Add members to group

### Documentation
- [ ] Create `docs/canonical-data-model.md`
  - [ ] Architecture overview
  - [ ] Canonical entity reference
  - [ ] Adding new entities (developer guide)
- [ ] Create `docs/custom-labels-user-guide.md`
  - [ ] How to customize labels
  - [ ] Best practices
  - [ ] Examples
- [ ] Update `docs/api-reference.md`
  - [ ] Document Label Service endpoints
  - [ ] Document Workspaces endpoints
  - [ ] Document Access Groups endpoints
- [ ] Update `README.md`
  - [ ] Add Canonical Data Model section
  - [ ] Link to documentation

## Phase 6: Deployment & Migration (2-3 hours)

### Pre-Deployment
- [ ] Review all code changes
- [ ] Run full test suite
- [ ] Test migration on staging database
- [ ] Create rollback plan
- [ ] Document breaking changes (if any)

### Deployment
- [ ] Run database migration
  - [ ] Create custom_labels table
  - [ ] Create workspaces and access_groups tables
  - [ ] Migrate existing groups data
  - [ ] Seed default labels for all organizations
- [ ] Deploy backend changes
  - [ ] Label Service API
  - [ ] Workspaces/Access Groups routes
  - [ ] Updated Google Workspace sync
- [ ] Deploy frontend changes
  - [ ] LabelsContext
  - [ ] Refactored navigation
  - [ ] Updated pages
  - [ ] New Settings UI
- [ ] Verify health checks pass
- [ ] Smoke test all features

### Post-Deployment
- [ ] Monitor error rates
- [ ] Verify labels loading correctly
- [ ] Check Google Workspace sync still works
- [ ] Test customization flow end-to-end
- [ ] Collect user feedback
- [ ] Address any issues

## Success Checklist

- [ ] Custom labels stored in database
- [ ] All organizations have default labels
- [ ] Label Service API working
- [ ] LabelsContext provides labels to all components
- [ ] Navigation uses label tokens (no hardcoded strings)
- [ ] Groups split into Workspaces and Access Groups
- [ ] Department removed from top-level customization
- [ ] Settings > Customization has singular/plural fields
- [ ] Character limits enforced (30 chars)
- [ ] Contextual help text added
- [ ] All existing tests passing
- [ ] New E2E tests passing (100%)
- [ ] Documentation complete
- [ ] Migration successful with no data loss
- [ ] Backward compatible (existing features work)

## Notes

- Keep tasks small and testable (1-3 hours each)
- Complete in order (backend → frontend → tests)
- Run tests after each major milestone
- Mark with `[x]` when done, not before
- Each phase can be deployed independently if needed
- Maintain backward compatibility throughout

## Estimated Timeline

- Phase 1: 6-8 hours
- Phase 2: 8-10 hours
- Phase 3: 8-10 hours
- Phase 4: 4-6 hours
- Phase 5: 6-8 hours
- Phase 6: 2-3 hours
- **Total: 34-45 hours (4-6 work days)**

This is a significant refactoring but essential for the platform's long-term architecture.
