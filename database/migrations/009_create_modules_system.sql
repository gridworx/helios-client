-- Migration 009: Module System Architecture
-- Date: 2025-10-08
-- Description: Core module system with public asset hosting and signature management

-- =====================================================
-- 1. MODULE REGISTRY (Track Available Modules)
-- =====================================================

CREATE TABLE IF NOT EXISTS available_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key VARCHAR(100) NOT NULL UNIQUE,    -- 'public_assets', 'email_signatures', 'google_workspace', etc.
  module_name VARCHAR(255) NOT NULL,           -- Human-readable name
  module_type VARCHAR(50) NOT NULL,            -- 'infrastructure', 'integration', 'feature'
  description TEXT,
  version VARCHAR(50) DEFAULT '1.0.0',
  is_core BOOLEAN DEFAULT false,               -- Core modules can't be disabled
  requires_modules JSONB,                      -- ['public_assets'] - dependencies
  config_schema JSONB,                         -- JSON schema for module configuration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. ORGANIZATION MODULE ACTIVATION
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES available_modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB,                                -- Module-specific configuration
  enabled_at TIMESTAMP,
  enabled_by UUID REFERENCES organization_users(id),
  disabled_at TIMESTAMP,
  disabled_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, module_id)
);

-- =====================================================
-- 3. PUBLIC ASSET HOSTING MODULE (Infrastructure)
-- =====================================================

-- Asset storage table
CREATE TABLE IF NOT EXISTS public_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Asset identification
  asset_key VARCHAR(255) NOT NULL,             -- Unique key: 'logo-main', 'tracking-pixel-abc123', etc.
  asset_type VARCHAR(50) NOT NULL,             -- 'image', 'tracking_pixel', 'signature_banner', 'logo', 'icon'
  module_source VARCHAR(100),                  -- Which module created this: 'email_signatures', 'branding', etc.

  -- File details
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,             -- Local storage path
  cdn_url VARCHAR(500),                        -- CDN URL (if using CDN)
  public_url VARCHAR(500) NOT NULL,            -- Public-facing URL

  -- File metadata
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  width INTEGER,
  height INTEGER,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,               -- How many places use this asset
  download_count INTEGER DEFAULT 0,            -- How many times downloaded
  last_accessed_at TIMESTAMP,

  -- Asset management
  is_active BOOLEAN DEFAULT true,
  tags JSONB,                                  -- ['campaign-2024', 'black-friday', 'banner']

  -- Audit
  uploaded_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, asset_key),
  INDEX (organization_id, asset_type),
  INDEX (organization_id, module_source),
  INDEX (cdn_url),
  INDEX (public_url)
);

-- Asset usage tracking (which resources use which assets)
CREATE TABLE IF NOT EXISTS asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public_assets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What is using this asset?
  resource_type VARCHAR(100) NOT NULL,         -- 'signature_template', 'signature_campaign', 'email_template'
  resource_id UUID NOT NULL,                   -- ID of the signature/campaign/etc.

  -- Usage context
  usage_context JSONB,                         -- {'field': 'banner_image', 'position': 'footer'}

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (asset_id),
  INDEX (organization_id, resource_type, resource_id)
);

-- Asset access logs (for analytics)
CREATE TABLE IF NOT EXISTS asset_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public_assets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Access details
  access_type VARCHAR(50) NOT NULL,            -- 'view', 'download', 'tracking_pixel_load'
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,

  -- Tracking-specific (for signature campaigns)
  tracking_result_id UUID,                     -- If this is a tracking pixel load

  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (asset_id, accessed_at),
  INDEX (organization_id, accessed_at),
  INDEX (tracking_result_id)
);

-- =====================================================
-- 4. EMAIL SIGNATURE MANAGEMENT MODULE
-- =====================================================

-- Signature templates
CREATE TABLE IF NOT EXISTS signature_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Template content
  html_content TEXT NOT NULL,                  -- Full HTML signature
  mobile_html_content TEXT,                    -- Mobile-optimized variant (optional)
  plain_text_content TEXT,                     -- Plain text fallback

  -- Template metadata
  thumbnail_asset_id UUID REFERENCES public_assets(id),  -- Preview image
  category VARCHAR(100),                       -- 'corporate', 'sales', 'executive', 'minimal'

  -- Template variables used (for validation)
  variables_used JSONB,                        -- ['firstName', 'lastName', 'jobTitle', 'phone']

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,            -- Default template for organization

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, name)
);

-- Signature assignments (who gets which signature)
CREATE TABLE IF NOT EXISTS signature_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES signature_templates(id) ON DELETE CASCADE,

  -- Assignment target
  assignment_type VARCHAR(50) NOT NULL,        -- 'user', 'department', 'role', 'all_users'
  assignment_value VARCHAR(255),               -- user_id, department_id, role name, or NULL for all

  -- Assignment priority (higher = wins if multiple rules match)
  priority INTEGER DEFAULT 0,

  -- Flags
  is_default BOOLEAN DEFAULT false,            -- Default for this assignment type
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (organization_id, assignment_type, assignment_value),
  INDEX (template_id)
);

-- User signature settings (overrides and preferences)
CREATE TABLE IF NOT EXISTS user_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Active signature
  current_template_id UUID REFERENCES signature_templates(id),

  -- Deployment status
  deployment_status VARCHAR(50),               -- 'pending', 'deployed', 'failed'
  last_deployed_at TIMESTAMP,
  deployment_error TEXT,

  -- Platform-specific deployment IDs
  google_workspace_signature_id VARCHAR(255),
  microsoft_365_signature_id VARCHAR(255),

  -- User preferences
  allow_user_selection BOOLEAN DEFAULT true,   -- Can user choose from approved templates?

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, organization_id)
);

-- Signature campaigns (temporary signature replacements)
CREATE TABLE IF NOT EXISTS signature_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Campaign info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Campaign template
  template_id UUID NOT NULL REFERENCES signature_templates(id) ON DELETE RESTRICT,

  -- Campaign schedule
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,

  -- Target users
  target_type VARCHAR(50) NOT NULL,            -- 'all', 'department', 'role', 'custom'
  target_value JSONB,                          -- [{departmentId: 'x'}, {role: 'sales'}]

  -- Campaign status
  status VARCHAR(50) DEFAULT 'draft',          -- 'draft', 'pending_approval', 'scheduled', 'active', 'completed', 'cancelled'

  -- Approval workflow
  created_by UUID REFERENCES organization_users(id),
  approved_by UUID REFERENCES organization_users(id),
  approved_at TIMESTAMP,
  approval_notes TEXT,

  -- Deployment tracking
  deployed_at TIMESTAMP,
  reverted_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (organization_id, status),
  INDEX (start_date, end_date),
  CHECK (end_date > start_date)
);

-- =====================================================
-- 5. TRACKING SYSTEM (For Signature Campaigns)
-- =====================================================

-- Tracking results (one per user per campaign)
CREATE TABLE IF NOT EXISTS tracking_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Campaign & User
  campaign_id UUID NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,

  -- Unique Result ID (RID) - 7-character alphanumeric (GoPhish pattern)
  rid VARCHAR(7) NOT NULL UNIQUE,

  -- Tracking URLs
  pixel_url VARCHAR(500) NOT NULL,             -- https://track.helios.io/pixel?rid=aBc123X
  link_token VARCHAR(255) NOT NULL,            -- Token for link tracking

  -- Status
  status VARCHAR(50) DEFAULT 'sent',           -- 'sent', 'opened', 'clicked'

  -- Deployment
  deployed_at TIMESTAMP,
  reverted_at TIMESTAMP,
  deployment_status VARCHAR(50),               -- 'pending', 'deployed', 'failed', 'reverted'

  -- Last activity
  last_event_at TIMESTAMP,

  -- GeoIP data (from first event)
  ip_address VARCHAR(45),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  city VARCHAR(255),
  country VARCHAR(2),                          -- ISO 3166-1 alpha-2

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (campaign_id, status),
  INDEX (rid),
  UNIQUE (campaign_id, user_id)
);

-- Tracking events (every pixel load, every click)
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Related records
  campaign_id UUID NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES tracking_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id),

  -- Event type
  event_type VARCHAR(50) NOT NULL,             -- 'email_opened', 'link_clicked'

  -- Event details (JSONB for flexibility)
  details JSONB,
  /*
    {
      "ip": "203.0.113.45",
      "user_agent": "Mozilla/5.0...",
      "destination_url": "https://company.com/promo",
      "referrer": "https://mail.google.com",
      "email_client": "Gmail Web",
      "device_type": "desktop",
      "browser": "Chrome 118",
      "os": "Windows 10"
    }
  */

  -- GeoIP data (per event for movement tracking)
  ip_address VARCHAR(45),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  city VARCHAR(255),
  country VARCHAR(2),

  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (campaign_id, event_type, occurred_at),
  INDEX (result_id, occurred_at),
  INDEX (user_id, occurred_at)
);

-- Campaign analytics (pre-aggregated stats)
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Counts
  total_users INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  links_clicked INTEGER DEFAULT 0,
  unique_openers INTEGER DEFAULT 0,
  unique_clickers INTEGER DEFAULT 0,

  -- Rates (calculated)
  open_rate DECIMAL(5, 2),                     -- (emails_opened / emails_sent) * 100
  click_rate DECIMAL(5, 2),                    -- (links_clicked / emails_sent) * 100
  click_to_open_rate DECIMAL(5, 2),            -- (links_clicked / emails_opened) * 100

  -- Geographic breakdown (JSONB for flexibility)
  geo_distribution JSONB,
  /*
    {
      "US": {"opens": 450, "clicks": 180},
      "UK": {"opens": 120, "clicks": 45}
    }
  */

  -- Email client breakdown
  email_client_stats JSONB,
  /*
    {
      "Gmail": {"count": 560, "percentage": 45},
      "Outlook": {"count": 340, "percentage": 28}
    }
  */

  -- Device type breakdown
  device_stats JSONB,

  -- Timestamps
  first_event_at TIMESTAMP,
  last_event_at TIMESTAMP,
  last_aggregated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. SEED AVAILABLE MODULES
-- =====================================================

-- Infrastructure modules (shared services)
INSERT INTO available_modules (module_key, module_name, module_type, description, is_core, requires_modules) VALUES
('public_assets', 'Public Asset Hosting', 'infrastructure', 'CDN-backed public asset hosting for images, tracking pixels, and shared resources. Used by other modules.', false, '[]'),
('audit_logging', 'Audit Logging', 'infrastructure', 'Comprehensive audit logging for all system actions.', true, '[]'),
('analytics', 'Analytics Engine', 'infrastructure', 'Real-time analytics and reporting engine.', false, '[]');

-- Integration modules (external platforms)
INSERT INTO available_modules (module_key, module_name, module_type, description, is_core, requires_modules) VALUES
('google_workspace', 'Google Workspace', 'integration', 'Sync users, groups, OUs, and manage Google Workspace resources.', false, '[]'),
('microsoft_365', 'Microsoft 365', 'integration', 'Sync users, groups, and manage Microsoft 365 resources.', false, '[]');

-- Feature modules (user-facing features)
INSERT INTO available_modules (module_key, module_name, module_type, description, is_core, requires_modules) VALUES
('email_signatures', 'Email Signature Management', 'feature', 'Centralized email signature management with templates, campaigns, and tracking.', false, '["public_assets"]'),
('email_delegation', 'Email Delegation', 'feature', 'Manage email delegation across Google Workspace and Microsoft 365.', false, '[]'),
('ooo_management', 'Out of Office Management', 'feature', 'Centralized out-of-office message management for users.', false, '[]'),
('email_forwarding', 'Email Forwarding Rules', 'feature', 'Manage email forwarding rules with admin oversight.', false, '[]');

-- =====================================================
-- 7. UPDATE EXISTING TABLES FOR MODULE INTEGRATION
-- =====================================================

-- Link departments to Google Workspace (already exists, no change needed)
-- departments table already has gw_group_id, gw_group_email, org_unit_id, etc.

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organization_modules_enabled
  ON organization_modules(organization_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_public_assets_org_type
  ON public_assets(organization_id, asset_type, is_active);

CREATE INDEX IF NOT EXISTS idx_signature_assignments_active
  ON signature_assignments(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tracking_results_campaign_status
  ON tracking_results(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign_time
  ON tracking_events(campaign_id, occurred_at DESC);

-- =====================================================
-- 9. FUNCTIONS FOR MODULE DEPENDENCY CHECKING
-- =====================================================

CREATE OR REPLACE FUNCTION check_module_dependencies(
  p_organization_id UUID,
  p_module_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_required_modules JSONB;
  v_required_module TEXT;
  v_is_enabled BOOLEAN;
BEGIN
  -- Get required modules for this module
  SELECT requires_modules INTO v_required_modules
  FROM available_modules
  WHERE module_key = p_module_key;

  -- If no dependencies, return true
  IF v_required_modules IS NULL OR jsonb_array_length(v_required_modules) = 0 THEN
    RETURN TRUE;
  END IF;

  -- Check each required module
  FOR v_required_module IN SELECT jsonb_array_elements_text(v_required_modules)
  LOOP
    -- Check if required module is enabled
    SELECT om.is_enabled INTO v_is_enabled
    FROM organization_modules om
    JOIN available_modules am ON am.id = om.module_id
    WHERE om.organization_id = p_organization_id
      AND am.module_key = v_required_module;

    -- If required module not enabled, return false
    IF v_is_enabled IS NULL OR v_is_enabled = FALSE THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  -- All dependencies met
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. TRIGGER TO INCREMENT ASSET USAGE COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION increment_asset_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public_assets
  SET usage_count = usage_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.asset_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_asset_usage
  AFTER INSERT ON asset_usage
  FOR EACH ROW
  EXECUTE FUNCTION increment_asset_usage_count();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE 'Migration 009 completed successfully!';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - available_modules';
  RAISE NOTICE '  - organization_modules';
  RAISE NOTICE '  - public_assets';
  RAISE NOTICE '  - asset_usage';
  RAISE NOTICE '  - asset_access_logs';
  RAISE NOTICE '  - signature_templates';
  RAISE NOTICE '  - signature_assignments';
  RAISE NOTICE '  - user_signatures';
  RAISE NOTICE '  - signature_campaigns';
  RAISE NOTICE '  - tracking_results';
  RAISE NOTICE '  - tracking_events';
  RAISE NOTICE '  - campaign_analytics';
  RAISE NOTICE 'Seeded 8 available modules';
END $$;
