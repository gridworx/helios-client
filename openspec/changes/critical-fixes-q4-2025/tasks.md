# Critical Fixes - Implementation Tasks

## Phase 1: Critical Bug Fixes (P0 - IMMEDIATE)

### TASK-FIX-001: Fix nginx SPA routing for page refresh
**Priority:** P0
**Files:** `nginx/nginx.conf`

**Problem:** 500 error when refreshing on routes like `/admin/users`

**Solution:**
```nginx
# Update the root location block
location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # For SPA: always return index.html for non-file requests
    proxy_intercept_errors on;
    error_page 404 = @fallback;
}

location @fallback {
    proxy_pass http://frontend/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

**Acceptance Criteria:**
- [ ] Refresh on `/admin/users` returns the app (not 500)
- [ ] Refresh on `/admin/groups` works
- [ ] Refresh on `/people` works
- [ ] Direct URL access works from another browser

---

### TASK-FIX-002: Fix dashboard error handling
**Priority:** P0
**Files:** `frontend/src/App.tsx`

**Problem:** Dashboard shows infinite spinner instead of errors

**Solution:**
```typescript
// In fetchOrganizationStats
} catch (err) {
  setStatsLoading(false);
  setStatsError(err instanceof Error ? err.message : 'Failed to load dashboard');
}

// In the JSX, improve the error display
{statsError && (
  <div className="dashboard-error">
    <AlertCircle size={24} />
    <p>{statsError}</p>
    <button onClick={retry}>Retry</button>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Network errors show error message, not spinner
- [ ] Retry button reloads data
- [ ] Timeout after 10 seconds shows timeout message

---

### TASK-FIX-003: Add cache-busting for HTML files
**Priority:** P0
**Files:** `nginx/nginx.conf`

**Problem:** Browsers cache old JavaScript with hardcoded URLs

**Solution:**
```nginx
# Add to nginx.conf
location ~* \.(html)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

**Acceptance Criteria:**
- [ ] HTML files have no-cache headers
- [ ] Static assets have long cache headers
- [ ] Changes deploy without manual cache clear

---

### TASK-FIX-004: Fix Add User functionality
**Priority:** P0
**Files:** `frontend/src/pages/AddUser.tsx`, `frontend/src/pages/NewUserOnboarding.tsx`

**Problem:** Quick Add and full onboarding don't work

**Investigation:**
1. Check API endpoint `/api/v1/lifecycle/onboarding/execute`
2. Check form validation
3. Check error display

**Acceptance Criteria:**
- [ ] Quick Add creates a user
- [ ] Full onboarding wizard completes
- [ ] Errors displayed to user
- [ ] Success redirects appropriately

---

### TASK-FIX-005: Fix template creation
**Priority:** P0
**Files:** `frontend/src/components/lifecycle/OnboardingTemplateEditor.tsx`

**Problem:** Cannot create onboarding/offboarding templates

**Acceptance Criteria:**
- [ ] Can create new onboarding template
- [ ] Can create new offboarding template
- [ ] Can create multiple templates
- [ ] Templates show in list
- [ ] Templates can be selected when onboarding

---

### TASK-FIX-006: Fix Quick Actions
**Priority:** P1
**Files:** `frontend/src/App.tsx`

**Problem:** Quick action buttons do nothing

**Current code:**
```tsx
<button className="quick-action-btn primary" onClick={() => setCurrentPage('users')}>
  <UserPlus size={20} />
  <span>Add User</span>
</button>
```

**Fix:** Update handlers to navigate properly:
```tsx
<button className="quick-action-btn primary" onClick={() => navigate('/admin/users/new')}>
  <UserPlus size={20} />
  <span>Add User</span>
</button>
```

**Acceptance Criteria:**
- [ ] "Add User" opens add user page
- [ ] "Import CSV" opens import modal or page
- [ ] "Export Report" triggers download or opens export page

---

## Phase 2: Dashboard & UX Polish (P1)

### TASK-FIX-007: Fix widget persistence
**Priority:** P1
**Files:** `frontend/src/App.tsx`, `backend/src/routes/dashboard.routes.ts`

**Problem:** Dashboard customization doesn't persist on refresh

**Investigation:**
1. Check PUT `/api/v1/dashboard/widgets` is called on save
2. Check GET `/api/v1/dashboard/widgets` returns saved data
3. Check database table `user_dashboard_widgets`

**Acceptance Criteria:**
- [ ] Customizing and saving persists
- [ ] Refresh shows saved configuration
- [ ] Different users have different configurations

---

### TASK-FIX-008: Add loading timeouts and retry
**Priority:** P1
**Files:** `frontend/src/App.tsx`

**Add:**
```typescript
const LOAD_TIMEOUT = 10000; // 10 seconds

// Add timeout to fetch calls
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  // ...
} catch (err) {
  if (err.name === 'AbortError') {
    setError('Request timed out. Please try again.');
  }
}
```

**Acceptance Criteria:**
- [ ] Loads timeout after 10 seconds
- [ ] Timeout shows friendly message
- [ ] Retry button visible on error

---

## Phase 3: Microsoft 365 Integration (P2)

### TASK-MS-001: Create Microsoft module database schema
**Priority:** P2
**File:** `database/migrations/050_create_microsoft_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS ms_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    client_id VARCHAR(64) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,  -- AES encrypted
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS ms_synced_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ms_id VARCHAR(64) NOT NULL,  -- Microsoft user ID
    display_name VARCHAR(255),
    email VARCHAR(255),
    job_title VARCHAR(255),
    department VARCHAR(255),
    is_account_enabled BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, ms_id)
);
```

---

### TASK-MS-002: Create Microsoft Graph API service
**Priority:** P2
**File:** `backend/src/services/microsoft-graph.service.ts`

**Methods:**
- `getAccessToken()` - Client credentials flow
- `listUsers()` - GET /users
- `getUser(id)` - GET /users/{id}
- `listGroups()` - GET /groups
- `getLicenseUsage()` - GET /subscribedSkus

---

### TASK-MS-003: Create Microsoft module routes
**Priority:** P2
**File:** `backend/src/routes/microsoft.routes.ts`

**Endpoints:**
- POST `/api/v1/microsoft/connect` - Save credentials
- POST `/api/v1/microsoft/test` - Test connection
- POST `/api/v1/microsoft/sync` - Trigger sync
- GET `/api/v1/microsoft/status` - Get sync status
- DELETE `/api/v1/microsoft/disconnect` - Remove credentials

---

### TASK-MS-004: Create Microsoft setup wizard UI
**Priority:** P2
**File:** `frontend/src/components/microsoft/MicrosoftSetupWizard.tsx`

**Steps:**
1. Enter Tenant ID, Client ID, Client Secret
2. Test connection
3. Configure sync options
4. Initial sync

---

### TASK-MS-005: Create Microsoft 365 setup guide
**Priority:** P2
**File:** `docs/guides/MICROSOFT-365-SETUP-GUIDE.md`

User-facing guide with screenshots for:
1. Creating app registration in Azure
2. Configuring permissions
3. Creating client secret
4. Granting admin consent
5. Entering credentials in Helios

---

## Phase 4: Google External Sharing Manager (P3)

### TASK-SHARE-001: Create sharing audit service
**Priority:** P3
**File:** `backend/src/services/drive-sharing-audit.service.ts`

**Methods:**
- `scanSharedFiles(driveId)` - Scan for externally shared files
- `getExternalShares()` - List all external shares
- `revokeAccess(fileId, email)` - Remove external access
- `bulkRevoke(shares[])` - Remove multiple accesses

---

### TASK-SHARE-002: Create sharing manager UI
**Priority:** P3
**File:** `frontend/src/pages/admin/ExternalSharingManager.tsx`

**Features:**
- Overview stats (total shared, risk levels)
- File list with sharing details
- Bulk actions (revoke, export)
- Filters (by risk, by domain, by date)

---

## Summary

| Phase | Tasks | Priority | Estimated Effort |
|-------|-------|----------|------------------|
| 1. Bug Fixes | FIX-001 to FIX-006 | P0 | 1-2 days |
| 2. UX Polish | FIX-007 to FIX-008 | P1 | 1-2 days |
| 3. Microsoft 365 | MS-001 to MS-005 | P2 | 5-7 days |
| 4. External Sharing | SHARE-001 to SHARE-002 | P3 | 7-10 days |

**Agent should start with Phase 1 immediately.**
