# Tasks: User Lifecycle Management

## Phase 1: Database Schema

- [x] **TASK-LIFE-001**: Create onboarding_templates table migration
  - Table with all fields from proposal
  - Foreign keys to organizations, departments (signature_templates FK prepared but nullable)
  - JSONB for services and shared drive access
  - File: `database/migrations/040_create_onboarding_templates.sql`
  - **DONE**: Created table with triggers for updated_at and single default enforcement

- [x] **TASK-LIFE-002**: Create offboarding_templates table migration
  - Data handling options (drive, email, calendar)
  - Access revocation flags
  - Account action settings
  - File: `database/migrations/041_create_offboarding_templates.sql`
  - **DONE**: Created comprehensive table with all offboarding options

- [x] **TASK-LIFE-003**: Create scheduled_user_actions table migration
  - Action types: onboard, offboard, suspend, delete, restore
  - Status tracking: pending, in_progress, completed, failed, cancelled
  - Partial index for pending actions
  - Approval workflow support
  - File: `database/migrations/042_create_scheduled_user_actions.sql`
  - **DONE**: Created table with triggers, indexes, and constraints

- [x] **TASK-LIFE-004**: Create user_lifecycle_logs table migration
  - Step-by-step action logging
  - Success/failure tracking per step
  - Error message storage
  - Helper views for activity feed and action summary
  - File: `database/migrations/043_create_user_lifecycle_logs.sql`
  - **DONE**: Created table with views for lifecycle_activity_feed and lifecycle_action_summary

- [x] **TASK-LIFE-005**: Create TypeScript interfaces
  - OnboardingTemplate interface
  - OffboardingTemplate interface
  - ScheduledUserAction interface
  - LifecycleLog interface
  - All DTOs and config types
  - Step definitions as const arrays
  - File: `backend/src/types/user-lifecycle.ts`
  - **DONE**: Created comprehensive type definitions including DTOs, config types, and step constants

## Phase 2: Core Services

- [x] **TASK-LIFE-006**: Create UserOnboardingService
  - Template CRUD (getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate)
  - executeOnboarding method (orchestrates all steps)
  - executeFromTemplate method
  - Google Workspace user creation, group membership, Shared Drive access
  - Comprehensive logging via LifecycleLogService
  - File: `backend/src/services/user-onboarding.service.ts`
  - **DONE**: Full implementation with 10 onboarding steps

- [x] **TASK-LIFE-007**: Create UserOffboardingService
  - Template CRUD operations
  - executeOffboarding method with all steps
  - Drive transfer (placeholder - requires Data Transfer API)
  - Email forwarding, auto-reply setup
  - Group removal, OAuth revocation, device signout
  - Account suspension and status updates
  - File: `backend/src/services/user-offboarding.service.ts`
  - **DONE**: Full implementation with 11 offboarding steps

- [x] **TASK-LIFE-008**: Create ScheduledActionService
  - scheduleAction, cancelAction, approveAction, rejectAction
  - getPendingActions with dependency checking
  - processPendingActions for queue processing
  - Retry logic with exponential backoff
  - Recurrence support (daily/weekly/monthly)
  - File: `backend/src/services/scheduled-action.service.ts`
  - **DONE**: Full queue management with execution for all action types

- [x] **TASK-LIFE-009**: Create LifecycleLogService
  - logSuccess, logFailure, logSkipped helpers
  - getLogsForAction, getLogsForUser, getActivityFeed
  - getActionSummary, getRecentErrors
  - Uses database views for efficient queries
  - File: `backend/src/services/lifecycle-log.service.ts`
  - **DONE**: Comprehensive logging service

## Phase 3: Google Workspace Integration

- [x] **TASK-LIFE-010**: Extend GoogleWorkspaceService for user creation
  - createUser method with full options
  - setOrgUnit method
  - assignLicense method (via org unit approach)
  - File: Update `backend/src/services/google-workspace.service.ts`
  - **DONE**: Added createUser, setOrgUnit, getUser methods

- [x] **TASK-LIFE-011**: Extend GoogleWorkspaceService for user suspension
  - suspendUser method
  - deleteUser method
  - signOutUser method (all devices)
  - File: Update `backend/src/services/google-workspace.service.ts`
  - **DONE**: Added signOutAllDevices method; suspendUser/deleteUser already existed

- [x] **TASK-LIFE-012**: Extend GoogleWorkspaceService for data transfer
  - transferDriveOwnership method
  - setupAutoForwarding method
  - setVacationResponder method
  - revokeOAuthTokens method
  - File: Update `backend/src/services/google-workspace.service.ts`
  - **DONE**: All methods implemented with proper Gmail/Drive/Data Transfer API integration

## Phase 4: Template API

- [x] **TASK-LIFE-013**: Create onboarding template CRUD routes
  - GET /api/lifecycle/onboarding-templates
  - GET /api/lifecycle/onboarding-templates/:id
  - POST /api/lifecycle/onboarding-templates
  - PUT /api/lifecycle/onboarding-templates/:id
  - DELETE /api/lifecycle/onboarding-templates/:id
  - File: `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: All routes implemented with authentication

- [x] **TASK-LIFE-014**: Create offboarding template CRUD routes
  - GET /api/lifecycle/offboarding-templates
  - POST /api/lifecycle/offboarding-templates
  - PUT /api/lifecycle/offboarding-templates/:id
  - DELETE /api/lifecycle/offboarding-templates/:id
  - File: Update `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: All routes implemented

## Phase 5: Action Execution API

- [x] **TASK-LIFE-015**: Create user onboarding endpoint
  - POST /api/lifecycle/onboard
  - Accept user details + template ID
  - Support immediate or scheduled execution
  - Return created user + action log
  - File: Update `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: Supports both immediate execution and scheduling

- [x] **TASK-LIFE-016**: Create user offboarding endpoint
  - POST /api/lifecycle/offboard
  - Accept user ID + template ID + customizations
  - Support immediate or scheduled (last day)
  - Return action status
  - File: Update `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: Full implementation with scheduling support

- [x] **TASK-LIFE-017**: Create scheduled actions endpoints
  - GET /api/lifecycle/scheduled-actions
  - GET /api/lifecycle/scheduled-actions/:id
  - DELETE /api/lifecycle/scheduled-actions/:id (cancel)
  - PUT /api/lifecycle/scheduled-actions/:id (reschedule)
  - POST /api/lifecycle/scheduled-actions/:id/approve
  - POST /api/lifecycle/scheduled-actions/:id/reject
  - File: Update `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: Full CRUD with approval workflow

- [x] **TASK-LIFE-018**: Create lifecycle logs endpoint
  - GET /api/lifecycle/logs?userId=X
  - GET /api/lifecycle/logs?actionId=X
  - GET /api/lifecycle/logs/errors
  - GET /api/lifecycle/actions/:id/summary
  - File: Update `backend/src/routes/lifecycle.routes.ts`
  - **DONE**: Comprehensive logging endpoints

## Phase 6: Background Job

- [x] **TASK-LIFE-019**: Create scheduled action processor
  - Cron job runs every minute
  - Finds actions where scheduled_for <= now
  - Executes in order
  - Updates status and logs
  - File: `backend/src/jobs/scheduled-action-processor.ts`
  - **DONE**: Full processor with configurable intervals and batch sizes

- [x] **TASK-LIFE-020**: Register cron job
  - Add to backend startup
  - Configurable enable/disable
  - Error handling and retry logic
  - File: Update `backend/src/index.ts`
  - **DONE**: Registered in index.ts with graceful shutdown

## Phase 7: Frontend - Templates

- [ ] **TASK-LIFE-021**: Create OnboardingTemplateList page
  - Grid/list of templates
  - Create/Edit/Delete actions
  - Filter by department
  - File: `frontend/src/pages/admin/OnboardingTemplates.tsx`

- [ ] **TASK-LIFE-022**: Create OnboardingTemplateEditor component
  - Form for all template settings
  - Group selector (multi-select)
  - Shared Drive access configuration
  - Signature template picker
  - File: `frontend/src/components/lifecycle/OnboardingTemplateEditor.tsx`

- [ ] **TASK-LIFE-023**: Create OffboardingTemplateList page
  - List of offboarding templates
  - Set default template
  - File: `frontend/src/pages/admin/OffboardingTemplates.tsx`

- [ ] **TASK-LIFE-024**: Create OffboardingTemplateEditor component
  - Data handling options
  - Revocation checkboxes
  - Account action selection
  - File: `frontend/src/components/lifecycle/OffboardingTemplateEditor.tsx`

## Phase 8: Frontend - Onboarding Flow

- [ ] **TASK-LIFE-025**: Create NewUserOnboarding page
  - Step 1: Basic info (name, email)
  - Step 2: Select template
  - Step 3: Review & customize
  - Step 4: Confirm & create
  - File: `frontend/src/pages/admin/NewUserOnboarding.tsx`

- [ ] **TASK-LIFE-026**: Create OnboardingReview component
  - Shows what will be created
  - Allows override of template defaults
  - Preview email to send
  - File: `frontend/src/components/lifecycle/OnboardingReview.tsx`

## Phase 9: Frontend - Offboarding Flow

- [ ] **TASK-LIFE-027**: Create UserOffboarding page
  - Select user to offboard
  - Select template or customize
  - Choose immediate or scheduled
  - Confirmation dialog
  - File: `frontend/src/pages/admin/UserOffboarding.tsx`

- [ ] **TASK-LIFE-028**: Create OffboardingReview component
  - Shows what will happen
  - Data transfer preview
  - Timeline of scheduled actions
  - File: `frontend/src/components/lifecycle/OffboardingReview.tsx`

## Phase 10: Frontend - Scheduled Actions

- [ ] **TASK-LIFE-029**: Create ScheduledActions page
  - Calendar/list view of upcoming actions
  - Filter by action type
  - Edit/cancel actions
  - File: `frontend/src/pages/admin/ScheduledActions.tsx`

- [ ] **TASK-LIFE-030**: Create ActionTimeline component
  - Visual timeline of action execution
  - Step-by-step status
  - Error display with retry option
  - File: `frontend/src/components/lifecycle/ActionTimeline.tsx`

## Phase 11: Integration

- [ ] **TASK-LIFE-031**: Add Onboard action to People directory
  - "Onboard User" button in header
  - Opens onboarding wizard
  - File: Update `frontend/src/pages/People.tsx`

- [ ] **TASK-LIFE-032**: Add Offboard action to user context menu
  - Right-click or dropdown menu on user row
  - "Offboard User" option
  - Opens offboarding wizard
  - File: Update `frontend/src/pages/People.tsx`

- [ ] **TASK-LIFE-033**: Add lifecycle sidebar nav items
  - "User Lifecycle" section in admin nav
  - Links: Onboarding Templates, Offboarding Templates, Scheduled Actions
  - File: Update `frontend/src/components/Layout/Sidebar.tsx`

## Phase 12: Testing

- [ ] **TASK-LIFE-T01**: Unit tests for UserOnboardingService
  - Template validation
  - Step execution
  - Error handling
  - File: `backend/src/__tests__/user-onboarding.service.test.ts`

- [ ] **TASK-LIFE-T02**: Unit tests for UserOffboardingService
  - Data transfer
  - Access revocation
  - Account suspension
  - File: `backend/src/__tests__/user-offboarding.service.test.ts`

- [ ] **TASK-LIFE-T03**: Integration tests for scheduled actions
  - Schedule action
  - Execute on time
  - Handle failures
  - File: `backend/src/__tests__/scheduled-action.service.test.ts`

- [ ] **TASK-LIFE-T04**: E2E tests for onboarding flow
  - Create template
  - Onboard user with template
  - Verify user exists with correct settings
  - File: `e2e/tests/onboarding.spec.ts`

- [ ] **TASK-LIFE-T05**: E2E tests for offboarding flow
  - Offboard user
  - Verify data transfer
  - Verify account suspended
  - File: `e2e/tests/offboarding.spec.ts`

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Database | 5 tasks | 1 day |
| Phase 2: Core Services | 4 tasks | 2 days |
| Phase 3: Google Integration | 3 tasks | 2 days |
| Phase 4: Template API | 2 tasks | 0.5 day |
| Phase 5: Action API | 4 tasks | 1 day |
| Phase 6: Background Job | 2 tasks | 0.5 day |
| Phase 7: Frontend Templates | 4 tasks | 2 days |
| Phase 8: Onboarding Flow | 2 tasks | 1 day |
| Phase 9: Offboarding Flow | 2 tasks | 1 day |
| Phase 10: Scheduled Actions | 2 tasks | 1 day |
| Phase 11: Integration | 3 tasks | 1 day |
| Phase 12: Testing | 5 tasks | 2 days |

**Total: ~14 days**

## Dependencies

```
Phase 1 (Database)
  └── Phase 2 (Services)
       └── Phase 3 (Google Integration)
            └── Phase 4 (Template API)
                 └── Phase 5 (Action API)
                      └── Phase 6 (Background Job)

Phase 4 (Template API)
  └── Phase 7 (Frontend Templates)

Phase 5 (Action API)
  └── Phase 8, 9, 10 (Frontend Flows)
       └── Phase 11 (Integration)

All phases
  └── Phase 12 (Testing)
```

## Implementation Notes

### Temporary Password Generation
```typescript
function generateTempPassword(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const specialChars = '!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  return password;
}
```

### Scheduled Action Processing
```typescript
// Run every minute via cron
async function processScheduledActions() {
  const pending = await db.query(`
    SELECT * FROM scheduled_user_actions
    WHERE status = 'pending'
    AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 10
  `);

  for (const action of pending) {
    await markAsInProgress(action.id);
    try {
      await executeAction(action);
      await markAsCompleted(action.id);
    } catch (error) {
      await markAsFailed(action.id, error.message);
    }
  }
}
```

### Welcome Email Template
```typescript
const welcomeEmail = {
  subject: 'Welcome to {{company_name}}',
  body: `
    Hi {{first_name}},

    Your account has been created:
    - Email: {{work_email}}
    - Temporary Password: {{temp_password}}

    Please sign in and change your password immediately.

    Welcome to the team!
  `
};
```
