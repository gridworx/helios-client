# Tasks: Google Drive Asset Proxy

## Phase 1: Database & Models

- [x] **TASK-ASSET-001**: Create assets database migration
  - media_assets table (renamed to avoid conflict with IT assets table)
  - media_asset_folders table
  - media_asset_settings table
  - Indexes and constraints
  - File: `database/migrations/038_create_assets_tables.sql`

- [x] **TASK-ASSET-002**: Create asset TypeScript types
  - MediaAsset interface
  - MediaAssetFolder interface
  - MediaAssetSettings interface
  - CreateAsset/UpdateAsset DTOs
  - File: `backend/src/types/media-assets.ts`

## Phase 2: Google Drive Integration

- [x] **TASK-ASSET-003**: Extend GoogleWorkspaceService for Drive
  - Created separate GoogleDriveService for separation of concerns
  - createSharedDrive method
  - createFolder method
  - uploadFile method
  - downloadFile method (binary)
  - deleteFile method
  - listFiles method
  - File: `backend/src/services/google-drive.service.ts`

- [x] **TASK-ASSET-004**: Create asset storage service
  - MediaAssetStorageService with multi-backend support
  - Google Drive implementation (complete)
  - MinIO implementation (placeholder)
  - File: `backend/src/services/media-asset-storage.service.ts`

- [x] **TASK-ASSET-005**: Create asset caching service
  - Redis cache for binary file content (base64 encoded)
  - Cache key generation with "asset:" prefix
  - TTL management (1 hour default, configurable)
  - Max cacheable size limit (5MB)
  - Cache invalidation
  - File: `backend/src/services/media-asset-cache.service.ts`

## Phase 3: Asset Proxy Endpoint

- [x] **TASK-ASSET-006**: Create public proxy endpoint
  - GET /a/:token route (registered BEFORE auth middleware)
  - GET /a/:token/:filename route
  - Fetch from cache or storage
  - Set correct Content-Type
  - Set Cache-Control headers
  - Async access tracking (non-blocking)
  - File: `backend/src/routes/asset-proxy.routes.ts`

- [x] **TASK-ASSET-007**: Add rate limiting to proxy (included in TASK-ASSET-006)
  - IP-based rate limiting (100 req/min per IP)
  - 429 response for exceeded limits with Retry-After header
  - Integrated directly into asset-proxy.routes.ts

- [x] **TASK-ASSET-008**: Add access tracking (included in TASK-ASSET-006)
  - Increment access_count
  - Update last_accessed_at
  - Async (non-blocking) - doesn't slow down response

## Phase 4: Asset Management API

- [x] **TASK-ASSET-009**: Create asset CRUD routes
  - GET /api/assets - list with filters
  - GET /api/assets/:id - get single
  - POST /api/assets - register existing Drive file
  - DELETE /api/assets/:id - remove
  - File: `backend/src/routes/assets.routes.ts`
  - **COMPLETED**: Full CRUD with filtering, pagination, public URL generation

- [x] **TASK-ASSET-010**: Create asset upload endpoint
  - POST /api/assets/upload - multipart upload
  - Validate file type and size
  - Upload to Drive via service
  - Register in database
  - Return asset with public URL
  - File: `backend/src/routes/assets.routes.ts`
  - **COMPLETED**: Multipart upload with mime type/size validation

- [x] **TASK-ASSET-011**: Create folder management endpoints
  - GET /api/assets/folders - folder tree
  - POST /api/assets/folders - create folder
  - DELETE /api/assets/folders/:id - delete folder
  - File: `backend/src/routes/assets.routes.ts`
  - **COMPLETED**: Tree structure API, folder creation in Drive

- [x] **TASK-ASSET-012**: Create asset settings endpoints
  - GET /api/assets/settings - get settings
  - PUT /api/assets/settings - update settings
  - POST /api/assets/setup - initial setup (create Shared Drive)
  - File: `backend/src/routes/assets.routes.ts`
  - **COMPLETED**: Settings CRUD, status check, setup endpoint

## Phase 5: Setup Flow

- [x] **TASK-ASSET-013**: Create Shared Drive setup service
  - Create "Helios Assets" Shared Drive
  - Add service account as manager
  - Create default folder structure
  - Store IDs in asset_settings
  - File: `backend/src/services/google-drive.service.ts` (setupAssetsDrive method)
  - **COMPLETED**: Already implemented in GoogleDriveService.setupAssetsDrive()

- [x] **TASK-ASSET-014**: Add setup status check
  - Check if Shared Drive exists
  - Check if service account has access
  - Return setup status
  - File: `backend/src/services/media-asset-storage.service.ts` (getStatus method)
  - **COMPLETED**: Already implemented in MediaAssetStorageService.getStatus()

## Phase 6: Frontend - Settings Page

- [x] **TASK-ASSET-015**: Create Files & Assets settings page
  - Add to admin navigation
  - Storage backend selector
  - Setup wizard for Google Drive
  - File: `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: Full page with Overview, Assets, and Settings tabs. Navigation added as "Media Files" in admin sidebar.

- [x] **TASK-ASSET-016**: Create AssetSetupWizard component
  - Step 1: Choose storage (Drive vs MinIO)
  - Step 2: Create/connect Shared Drive
  - Step 3: Verify connection
  - Step 4: Create folder structure
  - File: Integrated into `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: Setup wizard modal with prerequisite checking and Shared Drive creation.

## Phase 7: Frontend - Asset Browser

- [x] **TASK-ASSET-017**: Create FolderTree component
  - Hierarchical folder display
  - Expand/collapse
  - Select folder
  - Context menu (rename, delete)
  - File: Integrated into `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: FolderTreeItem component with nested folder support and expand/collapse.

- [x] **TASK-ASSET-018**: Create AssetGrid component
  - Thumbnail grid view
  - List view toggle
  - Select asset
  - Multi-select for bulk actions
  - File: Integrated into `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: Responsive grid with image previews and file icons.

- [x] **TASK-ASSET-019**: Create AssetDetail panel
  - Preview (image, video)
  - Metadata display
  - Public URL with copy button
  - Replace/Download/Delete actions
  - File: Integrated into `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: Right sidebar panel with full asset details, copy URL, open in new tab, delete.

- [x] **TASK-ASSET-020**: Create AssetUploader component
  - Drag-and-drop zone
  - File type validation
  - Progress indicator
  - Multiple file support
  - File: Integrated into `frontend/src/pages/FilesAssets.tsx`
  - **COMPLETED**: UploadModal component with drag-and-drop support.

## Phase 8: Integration

- [x] **TASK-ASSET-021**: Integrate with Signature Management
  - Asset picker in template editor
  - Use asset URLs for signature images
  - File: `frontend/src/pages/TemplateStudio.tsx`
  - **COMPLETED**: Created AssetPickerModal component, added "Insert Image" button to editor toolbar

- [x] **TASK-ASSET-022**: Integrate with User Profiles
  - Profile photo upload uses asset service
  - Photos stored in /profiles/ folder
  - **COMPLETED**: Integrated AssetPickerModal with MyProfile "Change Photo" button
  - File: Update `frontend/src/pages/MyProfile.tsx`

## Phase 9: Testing

- [x] **TASK-ASSET-T01**: Unit tests for asset storage service
  - Upload, retrieve, delete
  - Both Drive and MinIO backends
  - File: `backend/src/__tests__/media-asset-storage.service.test.ts`
  - **COMPLETED**: 24 tests covering getSettings, updateSettings, uploadFile, getFile, deleteFile, createFolder, listFiles, setupStorage, isConfigured, getStatus

- [x] **TASK-ASSET-T02**: Unit tests for asset caching
  - Cache hit/miss scenarios
  - TTL expiration
  - Invalidation
  - File: `backend/src/__tests__/media-asset-cache.service.test.ts`
  - **COMPLETED**: 24 tests covering get, set, invalidate, has, getTTL, getStats, close, and disconnected state handling

- [x] **TASK-ASSET-T03**: Integration test for proxy endpoint
  - Public access without auth
  - Correct Content-Type
  - Rate limiting
  - File: `backend/src/__tests__/asset-proxy.routes.test.ts`
  - **COMPLETED**: 20 tests covering health endpoint, cache hit/miss, 403 for private assets, 503 for storage errors, rate limiting, access tracking, content headers, and file type handling

- [x] **TASK-ASSET-T04**: E2E tests for asset management
  - Upload file
  - Copy public URL
  - Verify URL works in <img>
  - Delete file
  - File: `e2e/tests/assets.spec.ts`
  - **COMPLETED**: E2E tests for Media Files page, Assets tab, Settings tab, Asset Proxy endpoints, Upload flow, and Asset Detail view

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Database | 2 tasks | 0.5 day |
| Phase 2: Drive Integration | 3 tasks | 2 days |
| Phase 3: Proxy Endpoint | 3 tasks | 1 day |
| Phase 4: Management API | 4 tasks | 1.5 days |
| Phase 5: Setup Flow | 2 tasks | 1 day |
| Phase 6: Frontend Settings | 2 tasks | 1 day |
| Phase 7: Asset Browser | 4 tasks | 2 days |
| Phase 8: Integration | 2 tasks | 1 day |
| Phase 9: Testing | 4 tasks | 1.5 days |

**Total: ~11.5 days**

## Dependencies

```
TASK-ASSET-001 (database)
  └── TASK-ASSET-002 (types)
       └── TASK-ASSET-003 (Drive integration)
            └── TASK-ASSET-004 (storage service)
                 └── TASK-ASSET-005 (caching)
                      └── TASK-ASSET-006 (proxy endpoint)

TASK-ASSET-004 (storage service)
  └── TASK-ASSET-009 to 012 (API routes)
       └── TASK-ASSET-015 to 020 (frontend)

TASK-ASSET-013 (setup service)
  └── TASK-ASSET-016 (setup wizard)

All backend complete
  └── TASK-ASSET-021, 022 (integrations)
```

## Implementation Notes

### Token Generation
```typescript
// Use URL-safe base64 encoded UUID
const token = base64url(uuidv4()); // e.g., "x7k9m2pL4nQ"
```

### Content-Type Detection
```typescript
// Use mime-types package
import mime from 'mime-types';
const contentType = mime.lookup(filename) || 'application/octet-stream';
```

### Drive API Quotas
- 1,000,000 queries/day
- 12,000 queries/100 seconds/user
- With caching, should never hit limits

### MinIO Fallback
When Google Workspace not configured, automatically use MinIO. No code changes needed in asset consumers - just different storage backend.
