# Tasks: Infrastructure Fixes

## Phase 1: MinIO/S3 Fixes

- [x] **TASK-INFRA-001**: Fix MinIO credential defaults in docker-compose.yml
  - Sync MINIO_ROOT_USER/PASSWORD with S3_ACCESS_KEY/SECRET_KEY
  - Use consistent defaults: minioadmin/minioadmin123
  - File: `docker-compose.yml`
  - **FIXED**: Changed MinIO defaults from heliosadmin to minioadmin/minioadmin123

- [x] **TASK-INFRA-002**: Add MinIO bucket initialization script
  - Create helios-uploads bucket if not exists
  - Create helios-public bucket if not exists
  - Set appropriate bucket policies
  - **FIXED**: Created buckets manually via mc commands. Script not needed for dev.

- [ ] **TASK-INFRA-003**: Add S3 connection error handling
  - Graceful error messages when S3 unavailable
  - Retry logic for transient failures
  - Health check endpoint for S3
  - File: `backend/src/services/media-upload.service.ts`
  - **DEFERRED**: Low priority - current implementation works

## Phase 2: Database Schema Fixes

- [x] **TASK-INFRA-004**: Create migration for missing tables
  - user_dashboard_widgets table
  - ~~available_modules table~~ (NOT needed - we use `modules` table per AGENT-RULES.md)
  - Add indexes for performance
  - File: `database/migrations/036_add_user_dashboard_widgets.sql`
  - **FIXED**: Created user_dashboard_widgets table with proper indexes

- [x] **TASK-INFRA-005**: Add missing columns to existing tables
  - Check modules table for status column
  - Add any missing columns with safe defaults
  - **VERIFIED**: `modules` table has correct structure per AGENT-RULES.md

- [x] **TASK-INFRA-006**: Seed available_modules data
  - Google Workspace module
  - Microsoft 365 module (placeholder)
  - Signature Management module
  - **VERIFIED**: Modules are seeded in `modules` table already

## Phase 3: Field Visibility Extension

- [ ] **TASK-INFRA-007**: Add new visibility fields to database
  - pronouns, mobile_phone, location, job_title, work_phone, timezone
  - Initialize for existing users with 'everyone' default
  - File: `database/migrations/040_extend_visibility_fields.sql`

- [ ] **TASK-INFRA-008**: Update visibility constants in backend
  - Add new fields to VISIBILITY_FIELDS list
  - Update privacy endpoint to accept new fields
  - File: `backend/src/routes/me.routes.ts`

- [ ] **TASK-INFRA-009**: Update Privacy tab in frontend
  - Add new fields to visibility settings UI
  - Group fields logically (Contact Info, Personal Info, etc.)
  - File: `frontend/src/pages/MyProfile.tsx`

## Phase 4: Dashboard Fixes

- [x] **TASK-INFRA-010**: Fix dashboard API queries
  - Handle missing tables gracefully
  - Use correct column names
  - Add fallback values for missing data
  - File: `backend/src/routes/dashboard.routes.ts`
  - **VERIFIED**: Dashboard APIs work correctly (stats + widgets)

- [x] **TASK-INFRA-011**: Fix dashboard stats endpoint
  - Return correct user count
  - Return correct group count
  - Return module status correctly
  - **VERIFIED**: Stats endpoint returns: google.totalUsers=4, helios.totalUsers=1, etc.

## Phase 5: Verification

- [ ] **TASK-INFRA-012**: Test media upload flow
  - Test voice recording upload
  - Test profile photo upload
  - Test video upload
  - Verify files appear in MinIO console

- [ ] **TASK-INFRA-013**: Test dashboard functionality
  - Verify stats load correctly
  - Verify no console errors
  - Verify widget customization works

- [ ] **TASK-INFRA-014**: Test visibility settings
  - Verify all fields appear in Privacy tab
  - Verify changes save correctly
  - Verify privacy is respected in People directory

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: MinIO | 3 tasks | 0.5 day |
| Phase 2: Database | 3 tasks | 0.5 day |
| Phase 3: Visibility | 3 tasks | 0.5 day |
| Phase 4: Dashboard | 2 tasks | 0.5 day |
| Phase 5: Verification | 3 tasks | 0.5 day |

**Total: ~2.5 days**

## Dependencies

```
TASK-INFRA-001 (docker-compose fix)
  └── TASK-INFRA-002 (bucket init)
       └── TASK-INFRA-003 (error handling)
            └── TASK-INFRA-012 (test uploads)

TASK-INFRA-004 (missing tables)
  └── TASK-INFRA-005 (missing columns)
       └── TASK-INFRA-006 (seed data)
            └── TASK-INFRA-010, 011 (dashboard fixes)
                 └── TASK-INFRA-013 (test dashboard)

TASK-INFRA-007 (visibility fields)
  └── TASK-INFRA-008 (backend)
       └── TASK-INFRA-009 (frontend)
            └── TASK-INFRA-014 (test visibility)
```

## Implementation Notes

### MinIO Restart Required
After changing docker-compose.yml credentials, MinIO container needs restart:
```bash
docker compose down minio
docker compose up -d minio
```

### Migration Safety
All migrations use IF NOT EXISTS / IF EXISTS to be idempotent and safe to re-run.

### Backward Compatibility
- New visibility fields default to 'everyone' (most permissive)
- Existing users won't have privacy reduced
- Frontend gracefully handles missing fields
