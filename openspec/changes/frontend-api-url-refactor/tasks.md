# Tasks: Frontend API URL Refactor

## Phase 1: Foundation (Already Done)

- [x] **TASK-URL-001**: Create nginx reverse proxy configuration
  - File: `nginx/nginx.conf`
  - Routes `/api/*`, `/a/*`, `/health` to backend, `/` to frontend
  - **DONE**: Created with asset proxy and caching

- [x] **TASK-URL-002**: Add nginx service to docker-compose
  - File: `docker-compose.yml`
  - Exposes port 80
  - **DONE**: nginx container running

- [x] **TASK-URL-003**: Create centralized API config
  - File: `frontend/src/config/api.ts`
  - Exports: `API_BASE_URL`, `API_URL`, `apiUrl()`, `wsUrl()`
  - **DONE**: Config created

- [x] **TASK-URL-003a**: Create production docker-compose
  - File: `docker-compose.prod.yml`
  - Only nginx exposed (port 80/443)
  - Required env vars for production
  - **DONE**: Created with security notes

- [x] **TASK-URL-003b**: Update .env.example with comprehensive docs
  - PUBLIC_URL configuration
  - Production deployment instructions
  - **DONE**: Full documentation added

## Phase 2: Service Files Refactor

- [ ] **TASK-URL-004**: Refactor profile.service.ts
  - Replace hardcoded URL with relative path or import from config
  - Test: Profile loading works

- [ ] **TASK-URL-005**: Refactor people.service.ts
  - Replace hardcoded URL
  - Test: People directory works

- [ ] **TASK-URL-006**: Refactor api-keys.service.ts
  - Replace hardcoded URL
  - Test: API keys management works

- [ ] **TASK-URL-007**: Refactor audit-logs.service.ts
  - Replace hardcoded URL
  - Test: Audit logs display works

- [ ] **TASK-URL-008**: Refactor helpdesk.service.ts
  - Replace hardcoded URL
  - Test: Helpdesk integration works

- [ ] **TASK-URL-009**: Refactor security-events.service.ts
  - Replace hardcoded URL
  - Test: Security events display works

- [ ] **TASK-URL-010**: Refactor google-workspace.service.ts
  - Replace hardcoded URL
  - Test: Google Workspace sync works

- [ ] **TASK-URL-011**: Refactor bulk-operations.service.ts
  - Replace hardcoded URL
  - Test: Bulk operations work

- [ ] **TASK-URL-012**: Refactor bulk-operations-socket.service.ts
  - Replace hardcoded URL with wsUrl()
  - Test: WebSocket connection works for bulk operations

## Phase 3: Core Application Files

- [ ] **TASK-URL-013**: Refactor App.tsx (8 occurrences)
  - Replace all `http://localhost:3001` with relative URLs
  - Test: App loads, auth checks work, dashboard loads

- [ ] **TASK-URL-014**: Refactor LoginPage.tsx (1 occurrence)
  - Replace hardcoded URL
  - Test: Login works from remote machine

- [ ] **TASK-URL-015**: Refactor Users.tsx (3 occurrences)
  - Replace hardcoded URLs
  - Test: Users list loads, CRUD operations work

- [ ] **TASK-URL-016**: Refactor Groups.tsx (2 occurrences)
  - Replace hardcoded URLs
  - Test: Groups list loads

- [ ] **TASK-URL-017**: Refactor Settings.tsx (5 occurrences)
  - Replace hardcoded URLs
  - Test: All settings tabs work

- [ ] **TASK-URL-018**: Refactor UserList.tsx (9 occurrences)
  - Replace hardcoded URLs
  - Test: User list displays, actions work

- [ ] **TASK-URL-019**: Refactor UserSlideOut.tsx (11 occurrences)
  - Replace hardcoded URLs
  - Test: User details slide-out works

- [ ] **TASK-URL-020**: Refactor GroupSlideOut.tsx (13 occurrences)
  - Replace hardcoded URLs
  - Test: Group details slide-out works

## Phase 4: Page Files

- [ ] **TASK-URL-021**: Refactor SetupPassword.tsx (2 occurrences)
- [ ] **TASK-URL-022**: Refactor OnboardingTemplates.tsx (6 occurrences)
- [ ] **TASK-URL-023**: Refactor OffboardingTemplates.tsx (5 occurrences)
- [ ] **TASK-URL-024**: Refactor UserOffboarding.tsx (3 occurrences)
- [ ] **TASK-URL-025**: Refactor NewUserOnboarding.tsx (5 occurrences)
- [ ] **TASK-URL-026**: Refactor ScheduledActions.tsx (5 occurrences)
- [ ] **TASK-URL-027**: Refactor AddUser.tsx (4 occurrences)
- [ ] **TASK-URL-028**: Refactor OrgChart.tsx (1 occurrence)
- [ ] **TASK-URL-029**: Refactor GroupDetail.tsx (5 occurrences)
- [ ] **TASK-URL-030**: Refactor EmailSecurity.tsx (2 occurrences)
- [ ] **TASK-URL-031**: Refactor FilesAssets.tsx (8 occurrences)
- [ ] **TASK-URL-032**: Refactor PublicAssets.tsx (8 occurrences)
- [ ] **TASK-URL-033**: Refactor TemplateStudio.tsx (7 occurrences)
- [ ] **TASK-URL-034**: Refactor Workspaces.tsx (1 occurrence)
- [ ] **TASK-URL-035**: Refactor UserSettings.tsx (1 occurrence)
- [ ] **TASK-URL-036**: Refactor DeveloperConsole.tsx (1 occurrence)

## Phase 5: Component Files

- [ ] **TASK-URL-037**: Refactor Administrators.tsx (4 occurrences)
- [ ] **TASK-URL-038**: Refactor RolesManagement.tsx (1 occurrence)
- [ ] **TASK-URL-039**: Refactor AccountSetup.tsx (1 occurrence)
- [ ] **TASK-URL-040**: Refactor ClientUserMenu.tsx (1 occurrence)
- [ ] **TASK-URL-041**: Refactor AssetPickerModal.tsx (1 occurrence)
- [ ] **TASK-URL-042**: Refactor MasterDataSection.tsx (11 occurrences)
- [ ] **TASK-URL-043**: Refactor ApiKeyWizard.tsx (1 occurrence)
- [ ] **TASK-URL-044**: Refactor ApiKeyList.tsx (2 occurrences)
- [ ] **TASK-URL-045**: Refactor OnboardingTemplateEditor.tsx (5 occurrences)
- [ ] **TASK-URL-046**: Refactor OffboardingTemplateEditor.tsx (4 occurrences)
- [ ] **TASK-URL-047**: Refactor GoogleWorkspaceWizard.tsx (3 occurrences)

## Phase 6: Context Files

- [ ] **TASK-URL-048**: Refactor LabelsContext.tsx (1 occurrence)
- [ ] **TASK-URL-049**: Refactor ViewContext.tsx (1 occurrence)

## Phase 7: Backend URL Generation Fixes

- [ ] **TASK-URL-050**: Fix asset URL generation in assets.routes.ts
  - File: `backend/src/routes/assets.routes.ts`
  - Change `getPublicUrl()` to use `PUBLIC_URL` env var or relative URLs
  - When PUBLIC_URL is empty, generate relative URLs like `/a/{token}/{filename}`
  - Test: Asset URLs work when accessed remotely

- [ ] **TASK-URL-051**: Fix S3 public URL in s3.service.ts
  - File: `backend/src/services/s3.service.ts`
  - S3_PUBLIC_URL should only be used for direct S3 access (cloud providers)
  - For MinIO behind proxy, URLs should go through backend `/a/` route
  - Test: Profile photos display correctly

- [ ] **TASK-URL-052**: Fix photo service URL in photo.service.ts
  - File: `backend/src/services/photo.service.ts`
  - Use PUBLIC_URL or relative URLs for photo URLs
  - Test: User photos work remotely

- [ ] **TASK-URL-053**: Create production Dockerfiles
  - File: `backend/Dockerfile.prod` (optimized, no dev deps)
  - File: `frontend/Dockerfile.prod` (nginx static serving)
  - Test: `docker compose -f docker-compose.prod.yml up` works

## Phase 8: Environment & Documentation (Partially Done)

- [x] **TASK-URL-054**: Update root .env.example
  - Add PUBLIC_URL configuration
  - Add clear documentation for production deployment
  - **DONE**: Comprehensive docs added

- [ ] **TASK-URL-055**: Update frontend/.env.example
  - Document VITE_API_URL options clearly
  - Recommend empty value for nginx proxy

- [ ] **TASK-URL-056**: Delete backup files
  - Remove `*.backup` and `*.backup.tsx` files
  - Clean up any test artifacts

## Phase 9: Testing & Verification

- [ ] **TASK-URL-T01**: Test local direct access
  - Set `VITE_API_URL=http://localhost:3001`
  - Access `http://localhost:3000`
  - Verify login, dashboard, all features work

- [ ] **TASK-URL-T02**: Test local nginx proxy
  - Set `VITE_API_URL=` (empty)
  - Access `http://localhost:80`
  - Verify login, dashboard, all features work

- [ ] **TASK-URL-T03**: Test remote nginx proxy
  - Set `VITE_API_URL=` (empty)
  - Access `http://<server-ip>:80` from another machine
  - Verify login, dashboard, all features work

- [ ] **TASK-URL-T04**: Verify no hardcoded URLs remain
  - Run: `grep -r "localhost:3001" frontend/src --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".backup"`
  - Should return 0 results

- [ ] **TASK-URL-T05**: Test WebSocket features
  - Bulk operations real-time updates
  - Any other WebSocket features

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Foundation | 5 tasks | DONE |
| Phase 2: Services | 9 tasks | 1 hour |
| Phase 3: Core Files | 8 tasks | 2 hours |
| Phase 4: Pages | 16 tasks | 2 hours |
| Phase 5: Components | 11 tasks | 1.5 hours |
| Phase 6: Contexts | 2 tasks | 15 min |
| Phase 7: Backend URLs | 4 tasks | 1 hour |
| Phase 8: Environment | 3 tasks | PARTIALLY DONE |
| Phase 9: Testing | 5 tasks | 1 hour |

**Total: ~9-10 hours of focused work**

## Quick Reference: Replacement Patterns

**IMPORTANT: Use /api/v1/ prefix (API versioning)**

### Simple fetch (most common)
```typescript
// BEFORE
fetch('http://localhost:3001/api/users')
// AFTER
fetch('/api/v1/users')
```

### With base URL variable
```typescript
// BEFORE
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
fetch(`${API_URL}/api/users`)
// AFTER (Option A - simplest)
fetch('/api/v1/users')
// AFTER (Option B - if base URL needed for other reasons)
import { API_URL } from '@/config/api';
fetch(`${API_URL}/api/v1/users`)
```

### WebSocket
```typescript
// BEFORE
new WebSocket('ws://localhost:3001/ws/something')
// AFTER
import { wsUrl } from '@/config/api';
new WebSocket(wsUrl('/ws/something'))
```

## Notes

### Why Not Just Find-Replace?
Some files construct URLs dynamically or have multiple patterns. Each file needs review to ensure:
1. URL is correctly replaced
2. No duplicate `/api/api/` paths
3. WebSockets use `ws://` or `wss://` correctly
4. Error handling still works

### Priority Order
1. LoginPage.tsx and App.tsx (blocks everything)
2. Core pages (Users, Groups, Dashboard)
3. Services (used by multiple components)
4. Remaining pages and components
5. Testing and cleanup
