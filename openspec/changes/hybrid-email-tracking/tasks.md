# Hybrid Email Tracking - Implementation Tasks

## Phase 1: Database Schema (2 hours)

### TASK-TRK-001: Create user tracking table migration
**File:** `database/migrations/048_create_user_tracking.sql`

```sql
-- Create signature_user_tracking table
CREATE TABLE IF NOT EXISTS signature_user_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES organization_users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pixel_token VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_tracking_org ON signature_user_tracking(organization_id);
CREATE INDEX idx_user_tracking_token ON signature_user_tracking(pixel_token);
CREATE INDEX idx_user_tracking_active ON signature_user_tracking(organization_id) WHERE is_active = true;
```

**Acceptance Criteria:**
- [ ] Table created with proper constraints
- [ ] Indexes created for performance
- [ ] Foreign keys properly reference existing tables
- [ ] Migration is idempotent (IF NOT EXISTS)

---

### TASK-TRK-002: Modify tracking events table
**File:** `database/migrations/048_create_user_tracking.sql` (same file)

```sql
-- Add tracking type column
ALTER TABLE signature_tracking_events
    ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(20) DEFAULT 'campaign'
        CHECK (tracking_type IN ('user', 'campaign'));

-- Add user tracking reference
ALTER TABLE signature_tracking_events
    ADD COLUMN IF NOT EXISTS user_tracking_id UUID REFERENCES signature_user_tracking(id) ON DELETE CASCADE;

-- Make campaign columns nullable
ALTER TABLE signature_tracking_events
    ALTER COLUMN pixel_id DROP NOT NULL,
    ALTER COLUMN campaign_id DROP NOT NULL;

-- Index for user tracking queries
CREATE INDEX IF NOT EXISTS idx_tracking_events_user_tracking
    ON signature_tracking_events(user_tracking_id, timestamp)
    WHERE tracking_type = 'user';
```

**Acceptance Criteria:**
- [ ] tracking_type column added with check constraint
- [ ] user_tracking_id column added with FK
- [ ] Existing campaign tracking still works
- [ ] New index for user tracking queries

---

### TASK-TRK-003: Add organization tracking settings
**File:** `database/migrations/048_create_user_tracking.sql` (same file)

```sql
-- Add tracking settings to organization_settings if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_settings'
        AND column_name = 'tracking_settings'
    ) THEN
        ALTER TABLE organization_settings
            ADD COLUMN tracking_settings JSONB DEFAULT '{
                "user_tracking_enabled": true,
                "campaign_tracking_enabled": true,
                "retention_days": 90,
                "show_user_dashboard": true,
                "exclude_bots": true
            }'::jsonb;
    END IF;
END $$;
```

**Acceptance Criteria:**
- [ ] Settings column added if not exists
- [ ] Default values sensible
- [ ] Existing organizations get defaults

---

## Phase 2: Token Generation Service (2 hours)

### TASK-TRK-004: Create user tracking token service
**File:** `backend/src/services/user-tracking.service.ts`

```typescript
interface UserTrackingToken {
  id: string;
  userId: string;
  organizationId: string;
  pixelToken: string;
  isActive: boolean;
  createdAt: Date;
}

class UserTrackingService {
  generateToken(): string;
  getOrCreateToken(userId: string, organizationId: string): Promise<UserTrackingToken>;
  getTokenByPixel(pixelToken: string): Promise<UserTrackingToken | null>;
  deactivateToken(userId: string): Promise<void>;
  getTokenForUser(userId: string): Promise<UserTrackingToken | null>;
}
```

**Acceptance Criteria:**
- [ ] Token generation uses crypto.randomBytes (URL-safe)
- [ ] getOrCreateToken is idempotent
- [ ] Token lookup is fast (uses index)
- [ ] Service exported as singleton

---

### TASK-TRK-005: Generate tokens for existing users
**File:** `database/migrations/048_create_user_tracking.sql` (or separate 049)

```sql
-- Generate tokens for all existing users who don't have one
INSERT INTO signature_user_tracking (user_id, organization_id, pixel_token)
SELECT
    ou.id,
    ou.organization_id,
    encode(gen_random_bytes(18), 'base64')
FROM organization_users ou
WHERE NOT EXISTS (
    SELECT 1 FROM signature_user_tracking sut WHERE sut.user_id = ou.id
)
ON CONFLICT (user_id) DO NOTHING;
```

**Acceptance Criteria:**
- [ ] All existing users get tokens
- [ ] Tokens are unique
- [ ] Migration is idempotent

---

### TASK-TRK-006: Auto-generate token on user creation
**File:** `backend/src/services/user.service.ts` (modify)

After creating a new user, call:
```typescript
await userTrackingService.getOrCreateToken(newUser.id, newUser.organizationId);
```

**Acceptance Criteria:**
- [ ] New users automatically get tracking token
- [ ] Token created in same transaction if possible
- [ ] Failure to create token doesn't block user creation (log error)

---

## Phase 3: Tracking API (6 hours)

### TASK-TRK-007: Add user tracking pixel endpoint
**File:** `backend/src/routes/tracking.routes.ts` (modify)

```typescript
// GET /api/t/u/:token.gif - User tracking pixel
router.get('/u/:token.gif', async (req, res) => {
  // Similar to campaign pixel but uses user_tracking table
  // Record event with tracking_type = 'user'
});
```

**Acceptance Criteria:**
- [ ] Returns 1x1 transparent GIF immediately
- [ ] Records event asynchronously
- [ ] Rate limiting applied
- [ ] Bot filtering applied
- [ ] Works when user tracking disabled (returns GIF, no record)

---

### TASK-TRK-008: Modify tracking events service for hybrid
**File:** `backend/src/services/tracking-events.service.ts` (modify)

```typescript
interface RecordUserEventInput {
  userTrackingToken: string;
  ipAddress?: string;
  userAgent?: string;
  // ... geo fields
}

async recordUserEvent(input: RecordUserEventInput): Promise<RecordEventResult>;
```

**Acceptance Criteria:**
- [ ] New method for user tracking events
- [ ] Sets tracking_type = 'user'
- [ ] Sets user_tracking_id instead of pixel_id
- [ ] Unique detection based on IP hash per user per day
- [ ] Existing campaign tracking unchanged

---

### TASK-TRK-009: Create user analytics service
**File:** `backend/src/services/user-analytics.service.ts` (new)

```typescript
interface UserAnalytics {
  today: { opens: number; unique: number };
  thisWeek: { opens: number; unique: number };
  thisMonth: { opens: number; unique: number };
  trend: { direction: 'up' | 'down' | 'stable'; percentage: number };
  peakHours: Array<{ hour: number; day: string; avgOpens: number }>;
  byDevice: { desktop: number; mobile: number; tablet: number };
}

class UserAnalyticsService {
  getMyStats(userId: string): Promise<UserAnalytics>;
  getDailyStats(userId: string, days: number): Promise<DailyStats[]>;
}
```

**Acceptance Criteria:**
- [ ] Efficient queries with proper indexes
- [ ] Trend calculation compares current vs previous period
- [ ] Peak hours based on historical data
- [ ] Device breakdown from user_agent parsing

---

### TASK-TRK-010: Create admin analytics service
**File:** `backend/src/services/admin-analytics.service.ts` (new)

```typescript
interface OrgAnalytics {
  totalOpens: number;
  uniqueOpens: number;
  activeUsers: number;
  topPerformers: Array<{ userId: string; name: string; opens: number }>;
  byDepartment: Array<{ department: string; opens: number; users: number }>;
}

class AdminAnalyticsService {
  getOrganizationStats(orgId: string, days: number): Promise<OrgAnalytics>;
  getUserStats(userId: string): Promise<UserAnalytics>;
}
```

**Acceptance Criteria:**
- [ ] Aggregates across all users in org
- [ ] Top performers sorted by opens
- [ ] Department breakdown with user counts
- [ ] Efficient queries (consider materialized views for large orgs)

---

### TASK-TRK-011: Create user analytics routes
**File:** `backend/src/routes/tracking-analytics.routes.ts` (new)

```typescript
// User endpoints
GET /api/tracking/my-stats
GET /api/tracking/my-stats/daily?days=30

// Admin endpoints
GET /api/admin/tracking/organization-stats?days=30
GET /api/admin/tracking/user/:userId/stats
```

**Acceptance Criteria:**
- [ ] User endpoints require authentication
- [ ] Admin endpoints require admin role
- [ ] Proper error handling
- [ ] Response format matches spec

---

### TASK-TRK-012: Add tracking settings endpoints
**File:** `backend/src/routes/settings.routes.ts` (modify)

```typescript
GET /api/settings/tracking
PUT /api/settings/tracking
```

**Acceptance Criteria:**
- [ ] Get returns current tracking settings
- [ ] Put validates and updates settings
- [ ] Admin role required
- [ ] Changes take effect immediately

---

## Phase 4: Frontend UI (8 hours)

### TASK-TRK-013: Create email engagement dashboard widget
**File:** `frontend/src/components/widgets/EmailEngagementWidget.tsx` (new)

```typescript
interface EmailEngagementWidgetProps {
  className?: string;
}

// Shows:
// - This week opens vs last week
// - 7-day chart
// - Peak engagement time
```

**Acceptance Criteria:**
- [ ] Fetches data from /api/tracking/my-stats
- [ ] Shows loading state
- [ ] Shows error state gracefully
- [ ] Responsive design
- [ ] Follows design system (no emojis in prod)

---

### TASK-TRK-014: Create engagement trend chart component
**File:** `frontend/src/components/charts/EngagementChart.tsx` (new)

```typescript
interface EngagementChartProps {
  data: Array<{ date: string; opens: number; unique: number }>;
  height?: number;
}
```

**Acceptance Criteria:**
- [ ] Bar or line chart for daily opens
- [ ] Tooltip on hover
- [ ] Responsive sizing
- [ ] Uses existing chart library (recharts)

---

### TASK-TRK-015: Add widget to user dashboard
**File:** `frontend/src/pages/Dashboard.tsx` (modify)

Add EmailEngagementWidget to the dashboard grid for non-admin users.

**Acceptance Criteria:**
- [ ] Widget appears in dashboard
- [ ] Respects org setting (show_user_dashboard)
- [ ] Proper grid placement
- [ ] Hidden if tracking disabled

---

### TASK-TRK-016: Create admin team analytics page
**File:** `frontend/src/pages/admin/TeamAnalytics.tsx` (new)

Full page showing:
- Organization total stats
- Top performers list
- Department breakdown
- Date range selector

**Acceptance Criteria:**
- [ ] Fetches from /api/admin/tracking/organization-stats
- [ ] Top performers shows name, department, opens
- [ ] Department chart (horizontal bar)
- [ ] Date range filter (7, 30, 90 days)

---

### TASK-TRK-017: Create tracking settings panel
**File:** `frontend/src/components/settings/TrackingSettings.tsx` (new)

Admin settings panel for:
- Enable/disable user tracking
- Enable/disable campaign tracking
- Show/hide user dashboard
- Data retention period
- Bot filtering toggle

**Acceptance Criteria:**
- [ ] Toggle switches for boolean settings
- [ ] Dropdown for retention days
- [ ] Save button with loading state
- [ ] Success/error feedback
- [ ] Privacy disclaimer text

---

### TASK-TRK-018: Add tracking settings to admin settings page
**File:** `frontend/src/pages/admin/Settings.tsx` (modify)

Add TrackingSettings as a new tab or section.

**Acceptance Criteria:**
- [ ] Settings accessible from admin settings
- [ ] Tab or accordion section
- [ ] Proper navigation

---

### TASK-TRK-019: Add navigation for team analytics
**File:** `frontend/src/components/Sidebar.tsx` (modify)

Add "Team Analytics" link under admin section.

**Acceptance Criteria:**
- [ ] Link visible only to admins
- [ ] Proper icon (BarChart or similar)
- [ ] Active state when on page

---

## Phase 5: Signature Integration (4 hours)

### TASK-TRK-020: Update signature rendering to include user pixel
**File:** `backend/src/services/signature-renderer.service.ts` (modify)

When rendering a signature, include the user tracking pixel if:
- Organization has user_tracking_enabled = true
- User has an active tracking token

```html
<!-- User tracking pixel -->
<img src="https://app.example.com/api/t/u/{token}.gif"
     width="1" height="1" alt="" style="display:none;">
```

**Acceptance Criteria:**
- [ ] Pixel included when tracking enabled
- [ ] Pixel excluded when tracking disabled
- [ ] Uses correct domain from org settings
- [ ] Hidden with CSS (display:none, 1x1)
- [ ] Does not interfere with campaign pixels

---

### TASK-TRK-021: Update signature preview to show tracking indicator
**File:** `frontend/src/components/SignaturePreview.tsx` (modify)

Show indicator that tracking pixel is included (for transparency).

**Acceptance Criteria:**
- [ ] Small indicator "Tracking enabled" when pixel included
- [ ] Tooltip explaining what it means
- [ ] Hidden in actual signature output

---

## Phase 6: Data Retention & Maintenance (4 hours)

### TASK-TRK-022: Create data retention background job
**File:** `backend/src/jobs/tracking-retention.job.ts` (new)

```typescript
// Runs daily, deletes events older than retention period
async function purgeOldTrackingEvents(): Promise<number>;
```

**Acceptance Criteria:**
- [ ] Respects per-org retention_days setting
- [ ] Deletes in batches to avoid lock contention
- [ ] Logs number of deleted records
- [ ] Can be triggered manually

---

### TASK-TRK-023: Add retention job to scheduler
**File:** `backend/src/jobs/scheduler.ts` (modify)

Schedule purgeOldTrackingEvents to run daily at 3am.

**Acceptance Criteria:**
- [ ] Job runs daily
- [ ] Non-blocking (runs in background)
- [ ] Error handling and alerting

---

### TASK-TRK-024: Create materialized view for analytics (optional)
**File:** `database/migrations/049_tracking_analytics_views.sql` (new)

```sql
-- Materialized view for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS user_tracking_daily_stats AS
SELECT
    user_id,
    organization_id,
    DATE(timestamp) as day,
    COUNT(*) as total_opens,
    COUNT(DISTINCT ip_address_hash) as unique_opens
FROM signature_tracking_events
WHERE tracking_type = 'user'
GROUP BY user_id, organization_id, DATE(timestamp);

-- Refresh hourly via pg_cron or app scheduler
```

**Acceptance Criteria:**
- [ ] View created with proper indexes
- [ ] Refresh mechanism documented
- [ ] Queries use view when beneficial

---

## Phase 7: Testing (4 hours)

### TASK-TRK-025: Unit tests for user tracking service
**File:** `backend/src/services/__tests__/user-tracking.service.test.ts`

**Acceptance Criteria:**
- [ ] Token generation uniqueness
- [ ] getOrCreateToken idempotency
- [ ] Token lookup by pixel
- [ ] Deactivation

---

### TASK-TRK-026: Unit tests for analytics services
**File:** `backend/src/services/__tests__/user-analytics.service.test.ts`

**Acceptance Criteria:**
- [ ] Stats calculation correctness
- [ ] Trend direction logic
- [ ] Empty data handling

---

### TASK-TRK-027: Integration tests for tracking endpoints
**File:** `backend/src/__tests__/tracking.integration.test.ts`

**Acceptance Criteria:**
- [ ] User pixel returns GIF
- [ ] Events recorded correctly
- [ ] Rate limiting works
- [ ] Bot filtering works

---

### TASK-TRK-028: E2E tests for dashboard widget
**File:** `e2e/tracking-dashboard.spec.ts`

**Acceptance Criteria:**
- [ ] Widget loads on dashboard
- [ ] Shows correct data
- [ ] Handles errors gracefully

---

### TASK-TRK-029: Load testing for pixel endpoint
**File:** `backend/src/__tests__/tracking.load.test.ts`

**Acceptance Criteria:**
- [ ] p99 < 50ms under load
- [ ] No errors under 1000 req/sec
- [ ] Memory stable

---

## Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| 1. Schema | TRK-001 to TRK-003 | 2 |
| 2. Tokens | TRK-004 to TRK-006 | 2 |
| 3. API | TRK-007 to TRK-012 | 6 |
| 4. UI | TRK-013 to TRK-019 | 8 |
| 5. Integration | TRK-020 to TRK-021 | 4 |
| 6. Retention | TRK-022 to TRK-024 | 4 |
| 7. Testing | TRK-025 to TRK-029 | 4 |
| **Total** | **29 tasks** | **~30 hours** |

## Task Dependencies

```
TRK-001 ─┬─> TRK-004 ─┬─> TRK-007 ─> TRK-013
TRK-002 ─┤            │
TRK-003 ─┘            ├─> TRK-008 ─> TRK-009 ─> TRK-011
                      │
                      └─> TRK-005 ─> TRK-006

TRK-009 ─> TRK-013 ─> TRK-015
TRK-010 ─> TRK-016

TRK-012 ─> TRK-017 ─> TRK-018

TRK-004 ─> TRK-020 ─> TRK-021

All implementation ─> TRK-022 to TRK-029 (Testing)
```

## Priority Order

1. **Must Have (P0):** TRK-001 to TRK-008, TRK-020 (core functionality)
2. **Should Have (P1):** TRK-009 to TRK-015 (analytics & UI)
3. **Nice to Have (P2):** TRK-016 to TRK-019, TRK-022 to TRK-024 (admin features)
4. **Testing (P0):** TRK-025 to TRK-029 (required before release)
