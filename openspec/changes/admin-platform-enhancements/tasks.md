# Admin Platform Enhancements - Tasks

## Status: In Progress (Phase -1 Complete)

---

## Phase -1: Feature Flags System (P0 - Foundation) - COMPLETE

### -1.1 Database Schema
- [x] Create migration `052_create_feature_flags.sql`
- [x] Create simple `feature_flags` table (single-tenant, no org_id needed)
- [x] Insert default flags for all incomplete features (24 flags)
- [x] Add index on feature_key and category

**Files:**
- `database/migrations/052_create_feature_flags.sql`

### -1.2 Backend Service
- [x] Create `feature-flags.service.ts`
- [x] Implement `isEnabled(featureKey)` method (simple, no org context)
- [x] Implement `getAllFlags()` and `getAllFlagsMap()` methods
- [x] Implement `setFlag(featureKey, enabled)` method
- [x] Add caching with Redis (1 minute TTL)

**Files:**
- `backend/src/services/feature-flags.service.ts`

### -1.3 API Endpoints
- [x] Create `GET /api/v1/organization/feature-flags` endpoint
- [x] Create `GET /api/v1/organization/feature-flags/details` endpoint
- [x] Create `GET /api/v1/organization/feature-flags/categories` endpoint
- [x] Create `PUT /api/v1/organization/feature-flags/:key` (admin only)
- [x] Create `PUT /api/v1/organization/feature-flags/bulk` (admin only)
- [x] Create `POST /api/v1/organization/feature-flags` (admin only)
- [x] Create `DELETE /api/v1/organization/feature-flags/:key` (admin only)
- [x] Add OpenAPI documentation for all endpoints

**Files:**
- `backend/src/routes/feature-flags.routes.ts`
- `backend/src/index.ts`

### -1.4 Frontend Context
- [x] Create `FeatureFlagsContext` and `useFeatureFlags` hook
- [x] Create `FeatureFlagsProvider` component
- [x] Fetch flags on app load
- [x] Provide `isEnabled(key)` function to components
- [x] Provide `allEnabled()` and `anyEnabled()` for multiple flag checks
- [x] Create `FeatureGate` and `MultiFeatureGate` components

**Files:**
- `frontend/src/contexts/FeatureFlagsContext.tsx`
- `frontend/src/App.tsx` (FeatureFlagsProvider added)

### -1.5 Hide Incomplete Navigation Items
- [x] Wrap "Workflows" nav item with feature flag check (`nav.workflows`)
- [x] Wrap "Reports" nav item with feature flag check (`nav.reports`)
- [x] Wrap "Team Analytics" with feature flag check (`insights.team_analytics`)
- [x] Test navigation shows/hides correctly

**Files:**
- `frontend/src/components/navigation/AdminNavigation.tsx`

### Default Feature Flags to Create:
```
automation.offboarding_templates  = true   (UI works)
automation.offboarding_execution  = false  (TODO items remain)
automation.onboarding_templates   = true   (UI works)
automation.onboarding_execution   = false  (TODO items remain)
automation.scheduled_actions      = true   (view works)
automation.workflows              = false  (not implemented)
insights.reports                  = false  (not implemented)
console.pop_out                   = false  (not implemented)
console.pinnable_help             = false  (not implemented)
console.command_audit             = false  (not implemented)
users.export                      = false  (not implemented)
users.platform_filter             = false  (not implemented)
email_archive                     = false  (not implemented)
microsoft_365_relay               = false  (not implemented)
```

---

## Phase 0: User Offboarding Workflow (P0 - Critical)

### 0.1 Data Transfer API
- [x] Create `POST /api/v1/organization/users/:id/transfer` endpoint
- [x] Implement Google Data Transfer API integration (via transparent proxy)
- [x] Support Drive transfer to user
- [x] Support Calendar transfer to user
- [ ] Track transfer progress and status (future: poll transfer status)
- [ ] Handle partial failures gracefully

**Files:**
- `backend/src/routes/organization.routes.ts` (added)
- `backend/src/services/data-transfer.service.ts` (existing)

### 0.2 Email Forwarding & Delegation
- [ ] Create `POST /api/v1/organization/users/:id/email-settings` endpoint
- [ ] Implement Gmail forwarding via Admin SDK
- [ ] Implement Gmail delegation via Admin SDK
- [ ] Enforce 25-delegate limit per Google

**Files:**
- `backend/src/routes/users.routes.ts`
- `backend/src/services/gmail-settings.service.ts`

### 0.3 Delegate Validation
- [x] Create `GET /api/v1/organization/users/validate-delegate` endpoint
- [x] Check user exists in Google Workspace
- [x] Check user is NOT suspended
- [x] Check user is NOT archived
- [x] Check user is NOT pending deletion
- [x] Return warning if not in Helios
- [ ] Real-time validation in UI (frontend integration)

**Files:**
- `backend/src/routes/organization.routes.ts` (added)

### 0.4 Direct Reports Reassignment
- [x] Create `POST /api/v1/organization/users/:id/reassign-reports` endpoint
- [x] Support "all_to_one" mode (reassign all to single manager)
- [x] Support "individual" mode (custom assignments per report)
- [x] Add Step 2 to UserOffboarding.tsx for direct reports
- [x] Frontend calls reassign-reports API before lifecycle offboard

**Files:**
- `backend/src/routes/organization.routes.ts` (added)
- `frontend/src/pages/UserOffboarding.tsx` (updated)
- `frontend/src/pages/UserOffboarding.css` (updated)

### 0.5 Offboarding Wizard UI
- [x] Existing UserOffboarding.tsx component
- [x] Step 1: Select user
- [x] Step 2: Direct Reports reassignment (NEW)
- [x] Step 3: Template selection
- [x] Step 4: Schedule configuration
- [x] Step 5: Confirmation with summary
- [ ] Inline validation for delegate fields (DelegateValidator component)
- [ ] Progress tracking during execution

**Files:**
- `frontend/src/pages/UserOffboarding.tsx` (enhanced)
- `frontend/src/pages/UserOffboarding.css` (enhanced)

### 0.6 Bulk Access Revocation
- [x] Force sign-out via Admin SDK (in organization.routes.ts /block endpoint)
- [x] Password reset to random value (in organization.routes.ts /block endpoint)
- [x] Revoke OAuth tokens (in organization.routes.ts /block endpoint)
- [ ] Remove from all groups
- [ ] Wipe mobile devices (if MDM enabled)

**Files:**
- `backend/src/routes/organization.routes.ts` (existing /block endpoint)

---

## Phase 1: Users Page Critical Fixes (P0)

### 1.1 Fix Table Layout
- [ ] Change grid to flexbox for responsive columns
- [ ] Set appropriate min-widths for each column
- [ ] Test with long email addresses and names
- [ ] Ensure table is scrollable on small screens

**Files:**
- `frontend/src/components/UserList.css`
- `frontend/src/components/UserList.tsx`

### 1.2 Implement Export Functionality
- [ ] Create backend endpoint `GET /api/v1/organization/users/export`
- [ ] Support CSV and JSON formats via query param
- [ ] Apply current filters to export
- [ ] Add Export dropdown menu in UI
- [ ] Trigger file download

**Files:**
- `backend/src/routes/users.routes.ts`
- `frontend/src/pages/Users.tsx`

### 1.3 Implement Actions Dropdown
- [ ] Create dropdown component with action items
- [ ] Wire up Bulk Suspend to existing handler
- [ ] Wire up Bulk Activate to existing handler
- [ ] Wire up Bulk Delete to existing handler
- [ ] Add "Sync from Google" action
- [ ] Add "Import from CSV" action (navigate to import page)

**Files:**
- `frontend/src/pages/Users.tsx`
- `frontend/src/components/UserList.tsx`

### 1.4 Add Platform Filter
- [ ] Add platform filter dropdown in action bar
- [ ] Update `fetchUsers` to include platform filter param
- [ ] Update backend to filter by platform/source
- [ ] Show filter state visually
- [ ] Options: All, Local Only, Google Workspace, Microsoft 365

**Files:**
- `frontend/src/pages/Users.tsx`
- `frontend/src/components/UserList.tsx`
- `backend/src/routes/users.routes.ts`

### 1.5 Actor Attribution in Audit Logs
- [ ] Create migration to add actor fields to `activity_logs` table
- [ ] Add columns: actor_type, api_key_id, vendor_name, vendor_technician_name, vendor_technician_email, ticket_reference, service_name, result
- [ ] Add indexes for actor_type and vendor_name
- [ ] Update transparent-proxy to populate actor fields from API key context
- [ ] Enforce X-Actor-Name, X-Actor-Email headers for vendor keys with requireActorAttribution
- [ ] Return 400 if vendor key requires attribution but headers missing

**Files:**
- `database/migrations/046_add_actor_attribution_to_activity_logs.sql`
- `backend/src/middleware/transparent-proxy.ts`
- `backend/src/middleware/api-key-auth.ts`

### 1.6 Console Command Audit Logging
- [ ] Create `POST /api/v1/organization/audit-logs/console` endpoint
- [ ] Log command, duration, result status
- [ ] Include actor_type='internal' and user context
- [ ] Update DeveloperConsole to POST after each command
- [ ] Add console commands to audit log viewer

**Files:**
- `backend/src/routes/audit-logs.routes.ts`
- `frontend/src/pages/DeveloperConsole.tsx`

### 1.7 Audit Log Viewer Filters
- [ ] Add actor_type filter dropdown (All / Internal / Service / Vendor)
- [ ] Add vendor name filter (only shown when vendor selected)
- [ ] Add technician filter
- [ ] Add ticket reference search
- [ ] Add result filter (success / failure / denied)
- [ ] Update API to support new filter parameters

**Files:**
- `frontend/src/pages/AuditLogs.tsx`
- `backend/src/routes/audit-logs.routes.ts`

---

## Phase 2: Developer Console UX (P1)

### 2.1 Pinnable Help Panel
- [ ] Create `ConsoleHelpPanel` component
- [ ] Add dock left/right toggle buttons
- [ ] Save dock preference to localStorage
- [ ] Implement search within commands
- [ ] Add Insert button for each command
- [ ] Style panel to match console theme

**Files:**
- `frontend/src/components/ConsoleHelpPanel.tsx`
- `frontend/src/components/ConsoleHelpPanel.css`
- `frontend/src/pages/DeveloperConsole.tsx`

### 2.2 Insert Command Button
- [ ] Each command/example has [Insert] button
- [ ] Clicking inserts template into command input
- [ ] Optionally highlight placeholders (e.g., `<email>`)
- [ ] Focus input after insert

**Files:**
- `frontend/src/components/ConsoleHelpPanel.tsx`
- `frontend/src/pages/DeveloperConsole.tsx`

### 2.3 Add Transfer Console Commands
- [ ] Implement `helios gw transfer drive <from> --to <to>` command
- [ ] Implement `helios gw transfer calendar <from> --to <to>` command
- [ ] Implement `helios gw delegates add <user> --delegate <delegate>` command
- [ ] Implement `helios gw forwarding set <user> --to <target>` command
- [ ] Add to help/examples

**Files:**
- `frontend/src/pages/DeveloperConsole.tsx`

### 2.4 Add User CRUD Commands
- [ ] Implement `helios gw users create` command
- [ ] Implement `helios gw users delete` command
- [ ] Implement `helios gw users password` command
- [ ] Implement `helios gw users update` command
- [ ] Add to help/examples

**Files:**
- `frontend/src/pages/DeveloperConsole.tsx`

### 2.5 Add Offboarding Console Command
- [ ] Implement `helios gw users offboard <email>` command
- [ ] Support flags: `--transfer-to`, `--archive-email`, `--delete-after`
- [ ] Validate all delegates before proceeding
- [ ] Show progress and summary

**Files:**
- `frontend/src/pages/DeveloperConsole.tsx`

---

## Phase 3: Email Archive Feature (P2 - Strategic)

### 3.1 Database Schema
- [ ] Create `email_archives` table
- [ ] Create `email_archive_delegates` table
- [ ] Create `email_archive_access_log` table
- [ ] Add necessary indexes

**Files:**
- `database/migrations/XXX_create_email_archives.sql`

### 3.2 Archive Storage Setup
- [ ] Configure S3 bucket for archive storage
- [ ] Set up lifecycle policies (Standard → Glacier after 90 days)
- [ ] Configure encryption at rest
- [ ] Set up IAM permissions

**Files:**
- Infrastructure/Terraform or manual setup

### 3.3 Archive Creation Service
- [ ] Implement Google Takeout API integration
- [ ] Create background job for archive processing
- [ ] Parse MBOX format to extract messages
- [ ] Upload to S3 with proper structure
- [ ] Track progress and handle failures

**Files:**
- `backend/src/services/email-archive.service.ts`
- `backend/src/jobs/archive-processor.job.ts`

### 3.4 Search Indexing
- [ ] Set up Elasticsearch (or OpenSearch)
- [ ] Create index mapping for email messages
- [ ] Index: sender, recipient, subject, body, date, attachments
- [ ] Implement search API endpoint

**Files:**
- `backend/src/services/archive-search.service.ts`
- `backend/src/routes/archives.routes.ts`

### 3.5 Archive Viewer UI
- [ ] Create archive listing page
- [ ] Create folder browser (Inbox, Sent, etc.)
- [ ] Create message list with pagination
- [ ] Create message viewer with attachments
- [ ] Create search interface with filters
- [ ] Implement export to MBOX/PST

**Files:**
- `frontend/src/pages/EmailArchives.tsx`
- `frontend/src/pages/ArchiveViewer.tsx`
- `frontend/src/components/MessageList.tsx`
- `frontend/src/components/MessageViewer.tsx`

### 3.6 Access Control
- [ ] Implement delegate management UI
- [ ] Check delegate permissions before access
- [ ] Log all archive access to audit table
- [ ] Implement retention policy enforcement
- [ ] Implement legal hold functionality

**Files:**
- `frontend/src/components/ArchiveDelegates.tsx`
- `backend/src/middleware/archive-access.ts`

---

## Phase 4: Microsoft 365 Relay (P2)

### 4.1 Microsoft Graph Transparent Proxy
- [ ] Install `@microsoft/microsoft-graph-client`
- [ ] Create `microsoft-transparent-proxy.ts` middleware
- [ ] Mount at `/api/microsoft/*`
- [ ] Implement authentication with tenant credentials
- [ ] Forward requests to Graph API
- [ ] Log all requests to audit logs

**Files:**
- `backend/src/middleware/microsoft-transparent-proxy.ts`
- `backend/src/index.ts`
- `package.json`

### 4.2 Microsoft 365 Console Commands
- [ ] Implement `helios m365 users list`
- [ ] Implement `helios m365 users get`
- [ ] Implement `helios m365 licenses list`
- [ ] Implement `helios m365 groups list`

**Files:**
- `frontend/src/pages/DeveloperConsole.tsx`

### 4.3 Microsoft 365 Offboarding
- [ ] Implement OneDrive transfer
- [ ] Implement mailbox conversion to shared
- [ ] Implement license removal
- [ ] Add to offboarding wizard

**Files:**
- `backend/src/services/microsoft-offboarding.service.ts`

---

## Phase 5: Pop-out Console (P2)

### 5.1 Pop-out Window Implementation
- [ ] Create `/console?mode=popup` route variant
- [ ] Remove duplicate header/sidebar in popup mode
- [ ] Implement `window.open()` for pop-out
- [ ] Maintain auth state in popup
- [ ] Add pop-out button to console toolbar

**Files:**
- `frontend/src/pages/DeveloperConsole.tsx`
- `frontend/src/App.tsx` (routing)

---

## Phase 6: Cleanup (P3)

### 6.1 User Avatars
- [ ] Option A: Remove initials entirely
- [ ] Option B: Implement Gravatar fallback
- [ ] Option C: Use react-avatar library
- [ ] Ensure consistent sizing

**Files:**
- `frontend/src/components/UserList.tsx`
- `frontend/src/components/UserList.css`

### 6.2 Stats Bar Redesign
- [ ] Option A: Remove stats bar entirely
- [ ] Option B: Move to horizontal bar above tabs
- [ ] Ensure stats are accurate and update on filter change

**Files:**
- `frontend/src/pages/Users.tsx`
- `frontend/src/pages/Users.css`

---

## Testing Checklist

### Offboarding Workflow
- [ ] Transfer initiates successfully
- [ ] Cannot delegate to suspended user (shows error)
- [ ] Cannot delegate to deleted user (shows error)
- [ ] Cannot delegate to archived user (shows error)
- [ ] Warning shown if delegate not in Helios
- [ ] Progress tracked during transfer
- [ ] Audit log created for all actions
- [ ] Email forwarding activates correctly
- [ ] License cost savings displayed accurately

### Users Page
- [ ] Table renders correctly with 0, 1, 10, 100+ users
- [ ] Long emails truncate with ellipsis
- [ ] Export downloads correct data
- [ ] Actions perform bulk operations
- [ ] Platform filter shows correct users
- [ ] Responsive on tablet and mobile

### Developer Console
- [ ] Help panel docks left and right
- [ ] Insert button populates command input
- [ ] Commands log to audit trail
- [ ] Pop-out window maintains session
- [ ] All transfer commands work
- [ ] Offboard command validates delegates

### Email Archives (if implemented)
- [ ] Archive creation completes successfully
- [ ] Search returns relevant results
- [ ] Message viewer displays content correctly
- [ ] Attachments downloadable
- [ ] Only delegates can access
- [ ] Access logged to audit table
- [ ] Legal hold prevents deletion

### Microsoft 365
- [ ] Proxy forwards requests to Graph API
- [ ] Responses are returned correctly
- [ ] Requests are logged to audit
- [ ] Console commands work

---

## Dependencies

- `@microsoft/microsoft-graph-client` for MS365 proxy
- `elasticsearch` or `@opensearch-project/opensearch` for archive search
- `mailparser` for MBOX parsing
- `@aws-sdk/client-s3` for archive storage

---

## Estimated Effort (Revised)

| Phase | Effort |
|-------|--------|
| Phase 0 (Offboarding Workflow) | 5-7 days |
| Phase 1 (Users Page) | 2-3 days |
| Phase 2 (Console UX) | 3-4 days |
| Phase 3 (Email Archives) | 8-12 days |
| Phase 4 (MS365 Relay) | 2-3 days |
| Phase 5 (Pop-out) | 1 day |
| Phase 6 (Cleanup) | 1 day |
| **Total** | **22-31 days** |

---

## Decision Points

### Email Archive Feature
- [ ] **Decision needed:** Implement email archiving in Helios?
  - Pro: Massive license savings for customers ($4-7/user/month → ~$0.02/user/month)
  - Pro: Differentiating feature
  - Con: 8-12 days development
  - Con: Ongoing infrastructure costs (S3, Elasticsearch)
  - Con: We become data custodian (compliance implications)

### User Avatars
- [ ] **Decision needed:** Remove initials or implement properly?
  - Option A: Remove entirely (simplest)
  - Option B: Gravatar integration
  - Option C: Upload custom avatar

### Stats Bar
- [ ] **Decision needed:** Remove or redesign?
  - Option A: Remove entirely
  - Option B: Horizontal bar above tabs
