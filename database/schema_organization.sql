-- ============================================================================
-- Helios Client Portal - Complete Database Schema
-- Single Organization Management System
-- ============================================================================
-- This schema creates all tables needed for a fresh installation.
-- No migrations needed - this is the complete state.
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTIONS (needed before tables)
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias for compatibility
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CORE: ORGANIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    logo TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    is_setup_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization settings (key-value store)
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- ============================================================================
-- CORE: USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    email_verification_token VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),

    -- Extended profile fields
    job_title VARCHAR(255),
    organizational_unit VARCHAR(500),
    location VARCHAR(255),
    reporting_manager_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    employee_id VARCHAR(100),
    employee_type VARCHAR(50) DEFAULT 'Full Time',
    cost_center VARCHAR(100),
    start_date DATE,
    end_date DATE,
    bio TEXT,

    -- Contact information
    mobile_phone VARCHAR(50),
    work_phone VARCHAR(50),
    work_phone_extension VARCHAR(20),
    timezone VARCHAR(100) DEFAULT 'UTC',
    preferred_language VARCHAR(10) DEFAULT 'en',

    -- Platform integration IDs
    google_workspace_id VARCHAR(255),
    microsoft_365_id VARCHAR(64),
    microsoft_365_upn VARCHAR(255),
    github_username VARCHAR(255),
    slack_user_id VARCHAR(255),
    jumpcloud_user_id VARCHAR(255),
    associate_id VARCHAR(100),

    -- Sync status fields
    google_workspace_sync_status VARCHAR(50) DEFAULT 'not_synced',
    google_workspace_last_sync TIMESTAMPTZ,
    microsoft_365_sync_status VARCHAR(50) DEFAULT 'not_synced',
    microsoft_365_last_sync TIMESTAMPTZ,

    -- Custom fields and preferences
    custom_fields JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',

    -- Avatar/Photo
    avatar_url VARCHAR(500),
    photo_data TEXT,

    -- Guest user support
    is_guest BOOLEAN DEFAULT false,
    guest_expires_at TIMESTAMPTZ,
    guest_invited_by UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    guest_invited_at TIMESTAMPTZ,

    -- User type (local, synced, etc.)
    user_type VARCHAR(20) DEFAULT 'local',
    status VARCHAR(20) DEFAULT 'active',

    -- Master data FKs (added later via ALTER)
    department_id UUID,
    location_id UUID,
    cost_center_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for organization_users
CREATE INDEX IF NOT EXISTS idx_org_users_email ON organization_users(email);
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_users_role ON organization_users(role);
CREATE INDEX IF NOT EXISTS idx_org_users_department ON organization_users(department);
CREATE INDEX IF NOT EXISTS idx_org_users_location ON organization_users(location);
CREATE INDEX IF NOT EXISTS idx_org_users_reporting_manager ON organization_users(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_org_users_employee_id ON organization_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_org_users_google_workspace_id ON organization_users(google_workspace_id);
CREATE INDEX IF NOT EXISTS idx_org_users_ms_id ON organization_users(microsoft_365_id) WHERE microsoft_365_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_users_custom_fields ON organization_users USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_org_users_guest ON organization_users(is_guest) WHERE is_guest = true;
CREATE INDEX IF NOT EXISTS idx_org_users_guest_expired ON organization_users(guest_expires_at) WHERE is_guest = true AND guest_expires_at IS NOT NULL;

-- ============================================================================
-- AUTHENTICATION: SESSIONS (Legacy JWT-based)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- AUTHENTICATION: BETTER-AUTH TABLES
-- ============================================================================

-- Auth sessions (better-auth)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Auth accounts (SSO provider links)
CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    id_token TEXT,
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_provider ON auth_accounts(provider_id);

-- Auth verifications (email verification, password reset)
CREATE TABLE IF NOT EXISTS auth_verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_verifications_identifier ON auth_verifications(identifier);
CREATE INDEX IF NOT EXISTS idx_auth_verifications_expires_at ON auth_verifications(expires_at);

-- SSO providers configuration
CREATE TABLE IF NOT EXISTS sso_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    display_name TEXT,
    client_id TEXT,
    client_secret TEXT,
    issuer TEXT,
    authorization_url TEXT,
    token_url TEXT,
    userinfo_url TEXT,
    metadata_url TEXT,
    scopes TEXT DEFAULT 'openid profile email',
    is_enabled BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_sso_providers_org_id ON sso_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_providers_enabled ON sso_providers(organization_id, is_enabled);

-- Password setup tokens
CREATE TABLE IF NOT EXISTS password_setup_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MODULES SYSTEM
-- ============================================================================

-- Available modules (registered integrations)
CREATE TABLE IF NOT EXISTS available_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    module_key VARCHAR(100) UNIQUE,
    description TEXT,
    icon VARCHAR(100),
    version VARCHAR(50) DEFAULT '1.0.0',
    is_available BOOLEAN DEFAULT true,
    config_schema JSONB,
    requires_credentials BOOLEAN DEFAULT true,
    category VARCHAR(50) DEFAULT 'integration',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alias for modules table (legacy compatibility)
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    version VARCHAR(50) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    config_schema JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization modules (enabled per organization)
CREATE TABLE IF NOT EXISTS organization_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_id UUID NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    is_configured BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(50),
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_org_modules_org_id ON organization_modules(organization_id);

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    category VARCHAR(50) DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);

-- ============================================================================
-- MASTER DATA: DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    org_unit_id VARCHAR(255),
    org_unit_path VARCHAR(500),
    auto_sync_to_ou BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(organization_id, name),
    CHECK (parent_department_id != id)
);

CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_org_unit ON departments(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

-- ============================================================================
-- MASTER DATA: LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    type VARCHAR(50) DEFAULT 'office' CHECK (type IN ('headquarters', 'office', 'remote', 'region', 'warehouse', 'datacenter')),
    description TEXT,
    parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    timezone VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    CHECK (parent_id != id)
);

CREATE INDEX IF NOT EXISTS idx_locations_organization ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);

-- ============================================================================
-- MASTER DATA: COST CENTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    budget_amount DECIMAL(15, 2),
    budget_currency VARCHAR(3) DEFAULT 'USD',
    fiscal_year INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_organization ON cost_centers(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_department ON cost_centers(department_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON cost_centers(is_active);
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON cost_centers(code);

-- Master data settings
CREATE TABLE IF NOT EXISTS master_data_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    enforce_departments BOOLEAN DEFAULT false,
    enforce_locations BOOLEAN DEFAULT false,
    enforce_cost_centers BOOLEAN DEFAULT false,
    enforce_job_titles BOOLEAN DEFAULT false,
    departments_migrated BOOLEAN DEFAULT false,
    locations_migrated BOOLEAN DEFAULT false,
    cost_centers_migrated BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Job titles
CREATE TABLE IF NOT EXISTS job_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    level VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(organization_id, title)
);

CREATE INDEX IF NOT EXISTS idx_job_titles_org ON job_titles(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_titles_dept ON job_titles(department_id);

-- Add FKs to organization_users after master data tables exist
ALTER TABLE organization_users
    ADD CONSTRAINT fk_org_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_org_users_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_org_users_cost_center FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_users_department_id ON organization_users(department_id);
CREATE INDEX IF NOT EXISTS idx_org_users_location_id ON organization_users(location_id);
CREATE INDEX IF NOT EXISTS idx_org_users_cost_center_id ON organization_users(cost_center_id);

-- ============================================================================
-- GOOGLE WORKSPACE INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS gw_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    service_account_key TEXT NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    scopes TEXT[],
    is_valid BOOLEAN DEFAULT false,
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gw_credentials_org_id ON gw_credentials(organization_id);

CREATE TABLE IF NOT EXISTS gw_synced_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    google_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    given_name VARCHAR(255),
    family_name VARCHAR(255),
    full_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    org_unit_path VARCHAR(255),
    department VARCHAR(255),
    job_title VARCHAR(255),
    last_login_time TIMESTAMPTZ,
    creation_time TIMESTAMPTZ,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

CREATE INDEX IF NOT EXISTS idx_gw_synced_users_org_id ON gw_synced_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_gw_synced_users_email ON gw_synced_users(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_gw_synced_users_org_unit ON gw_synced_users(organization_id, org_unit_path);
CREATE INDEX IF NOT EXISTS idx_gw_synced_users_department ON gw_synced_users(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_gw_synced_users_status ON gw_synced_users(organization_id, is_suspended);

CREATE TABLE IF NOT EXISTS gw_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    google_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    description TEXT,
    member_count INTEGER DEFAULT 0,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

CREATE INDEX IF NOT EXISTS idx_gw_groups_org_id ON gw_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_gw_groups_email ON gw_groups(organization_id, email);

CREATE TABLE IF NOT EXISTS gw_org_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    google_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    parent_id VARCHAR(255),
    description TEXT,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

CREATE INDEX IF NOT EXISTS idx_gw_org_units_org_id ON gw_org_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_gw_org_units_path ON gw_org_units(organization_id, path);
CREATE INDEX IF NOT EXISTS idx_gw_org_units_parent ON gw_org_units(organization_id, parent_id);

-- ============================================================================
-- MICROSOFT 365 INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS ms_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    tenant_id VARCHAR(64) NOT NULL,
    client_id VARCHAR(64) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(50) DEFAULT 'pending',
    sync_error TEXT,
    access_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_ms_credentials_org ON ms_credentials(organization_id);

CREATE TABLE IF NOT EXISTS ms_synced_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ms_id VARCHAR(64) NOT NULL,
    upn VARCHAR(255),
    display_name VARCHAR(255),
    given_name VARCHAR(255),
    surname VARCHAR(255),
    email VARCHAR(255),
    job_title VARCHAR(255),
    department VARCHAR(255),
    office_location VARCHAR(255),
    company_name VARCHAR(255),
    mobile_phone VARCHAR(50),
    business_phones JSONB,
    is_account_enabled BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    manager_id VARCHAR(64),
    assigned_licenses JSONB,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ,
    sync_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, ms_id)
);

CREATE INDEX IF NOT EXISTS idx_ms_synced_users_org ON ms_synced_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_ms_synced_users_email ON ms_synced_users(email);
CREATE INDEX IF NOT EXISTS idx_ms_synced_users_upn ON ms_synced_users(upn);

CREATE TABLE IF NOT EXISTS ms_synced_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ms_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    mail VARCHAR(255),
    mail_enabled BOOLEAN DEFAULT false,
    security_enabled BOOLEAN DEFAULT true,
    group_types JSONB,
    member_count INTEGER DEFAULT 0,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ,
    sync_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, ms_id)
);

CREATE INDEX IF NOT EXISTS idx_ms_synced_groups_org ON ms_synced_groups(organization_id);

CREATE TABLE IF NOT EXISTS ms_group_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES ms_synced_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES ms_synced_users(id) ON DELETE CASCADE,
    membership_type VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ms_group_memberships_group ON ms_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_ms_group_memberships_user ON ms_group_memberships(user_id);

CREATE TABLE IF NOT EXISTS ms_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku_id VARCHAR(64) NOT NULL,
    sku_part_number VARCHAR(255),
    display_name VARCHAR(255),
    total_units INTEGER DEFAULT 0,
    consumed_units INTEGER DEFAULT 0,
    available_units INTEGER DEFAULT 0,
    service_plans JSONB,
    raw_data JSONB,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_ms_licenses_org ON ms_licenses(organization_id);

-- ============================================================================
-- GROUPS: USER GROUPS AND ACCESS GROUPS
-- ============================================================================

-- Legacy user groups
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    group_type VARCHAR(50) DEFAULT 'security',
    is_active BOOLEAN DEFAULT true,
    is_dynamic BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    google_group_id VARCHAR(255),
    google_workspace_group_id VARCHAR(255),
    microsoft_365_group_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_org_id ON user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_email ON user_groups(email);

-- User group memberships
CREATE TABLE IF NOT EXISTS user_group_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_memberships_user_id ON user_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group_id ON user_group_memberships(group_id);

-- Access groups (canonical)
CREATE TABLE IF NOT EXISTS access_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    platform VARCHAR(50) NOT NULL,
    group_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    external_url VARCHAR(500),
    allow_external_members BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    UNIQUE(organization_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_access_groups_org ON access_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_groups_platform ON access_groups(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_access_groups_email ON access_groups(email);
CREATE INDEX IF NOT EXISTS idx_access_groups_active ON access_groups(organization_id, is_active) WHERE is_active = true;

-- Access group members
CREATE TABLE IF NOT EXISTS access_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_group_id UUID NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    member_type VARCHAR(50) NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    synced_from_platform BOOLEAN DEFAULT true,
    UNIQUE(access_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_access_group_members_group ON access_group_members(access_group_id);
CREATE INDEX IF NOT EXISTS idx_access_group_members_user ON access_group_members(user_id);

-- Dynamic group rules
CREATE TABLE IF NOT EXISTS dynamic_group_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    logic_operator VARCHAR(10) DEFAULT 'AND',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dynamic_group_rules_group ON dynamic_group_rules(group_id);

-- ============================================================================
-- WORKSPACES (Collaboration Spaces)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    external_url VARCHAR(500),
    workspace_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    UNIQUE(organization_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_platform ON workspaces(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(organization_id, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    synced_from_platform BOOLEAN DEFAULT true,
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ============================================================================
-- ASSETS (IT Assets and User Addresses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL,
    asset_tag VARCHAR(100),
    serial_number VARCHAR(255),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    name VARCHAR(255),
    description TEXT,
    purchase_date DATE,
    warranty_expiry_date DATE,
    cost DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'available',
    location VARCHAR(255),
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_custom_fields ON assets USING GIN (custom_fields);

CREATE TABLE IF NOT EXISTS user_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID,
    return_date TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    condition_at_assignment VARCHAR(50) DEFAULT 'good',
    condition_at_return VARCHAR(50),
    notes TEXT,
    is_primary BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_asset_id ON user_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_is_primary ON user_assets(is_primary);

CREATE TABLE IF NOT EXISTS user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    address_type VARCHAR(50) DEFAULT 'work',
    street_address_1 VARCHAR(500),
    street_address_2 VARCHAR(500),
    city VARCHAR(255),
    state_province VARCHAR(255),
    postal_code VARCHAR(50),
    country VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

CREATE TABLE IF NOT EXISTS user_secondary_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) DEFAULT 'personal',
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_secondary_emails_user_id ON user_secondary_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_secondary_emails_email ON user_secondary_emails(email);

-- ============================================================================
-- MEDIA ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_asset_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    storage_backend VARCHAR(20) NOT NULL DEFAULT 'google_drive',
    drive_shared_drive_id VARCHAR(100),
    drive_root_folder_id VARCHAR(100),
    cache_ttl_seconds INTEGER DEFAULT 3600,
    max_file_size_mb INTEGER DEFAULT 10,
    allowed_mime_types TEXT[] DEFAULT ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon'],
    is_configured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_asset_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    parent_id UUID REFERENCES media_asset_folders(id) ON DELETE CASCADE,
    drive_folder_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, path)
);

CREATE INDEX IF NOT EXISTS idx_media_asset_folders_org ON media_asset_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_folders_parent ON media_asset_folders(parent_id);

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'google_drive',
    storage_path VARCHAR(500) NOT NULL,
    name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT,
    folder_id UUID REFERENCES media_asset_folders(id) ON DELETE SET NULL,
    category VARCHAR(50),
    access_token VARCHAR(100) NOT NULL UNIQUE,
    is_public BOOLEAN DEFAULT true,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_org ON media_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_token ON media_assets(access_token);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets(folder_id);

-- ============================================================================
-- AUDIT AND ACTIVITY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    source VARCHAR(50),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON security_events(organization_id, is_resolved) WHERE is_resolved = false;

-- ============================================================================
-- LIFECYCLE: ONBOARDING AND OFFBOARDING TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    google_license_sku VARCHAR(100),
    google_org_unit_path VARCHAR(500),
    google_services JSONB DEFAULT '{"gmail": true, "drive": true, "calendar": true, "meet": true, "chat": true, "docs": true, "sheets": true, "slides": true}',
    group_ids UUID[] DEFAULT '{}',
    shared_drive_access JSONB DEFAULT '[]',
    calendar_subscriptions TEXT[] DEFAULT '{}',
    signature_template_id UUID,
    default_job_title VARCHAR(255),
    default_manager_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    send_welcome_email BOOLEAN DEFAULT true,
    welcome_email_subject VARCHAR(500) DEFAULT 'Welcome to {{company_name}}',
    welcome_email_body TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_org ON onboarding_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_active ON onboarding_templates(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_department ON onboarding_templates(department_id) WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_templates_one_default ON onboarding_templates(organization_id) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS offboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    drive_action VARCHAR(50) DEFAULT 'transfer_manager',
    drive_transfer_to_user_id UUID,
    drive_archive_shared_drive_id VARCHAR(100),
    drive_delete_after_days INTEGER DEFAULT 90,
    email_action VARCHAR(50) DEFAULT 'forward_manager',
    email_forward_to_user_id UUID,
    email_forward_duration_days INTEGER DEFAULT 30,
    email_auto_reply_message TEXT,
    email_auto_reply_subject VARCHAR(500),
    calendar_decline_future_meetings BOOLEAN DEFAULT true,
    calendar_transfer_meeting_ownership BOOLEAN DEFAULT true,
    calendar_transfer_to_manager BOOLEAN DEFAULT true,
    calendar_transfer_to_user_id UUID,
    remove_from_all_groups BOOLEAN DEFAULT true,
    remove_from_shared_drives BOOLEAN DEFAULT true,
    revoke_oauth_tokens BOOLEAN DEFAULT true,
    revoke_app_passwords BOOLEAN DEFAULT true,
    sign_out_all_devices BOOLEAN DEFAULT true,
    reset_password BOOLEAN DEFAULT true,
    remove_signature BOOLEAN DEFAULT true,
    set_offboarding_signature BOOLEAN DEFAULT false,
    offboarding_signature_text TEXT,
    wipe_mobile_devices BOOLEAN DEFAULT false,
    wipe_requires_confirmation BOOLEAN DEFAULT true,
    account_action VARCHAR(50) DEFAULT 'suspend_on_last_day',
    delete_account BOOLEAN DEFAULT false,
    delete_after_days INTEGER DEFAULT 90,
    license_action VARCHAR(50) DEFAULT 'remove_on_suspension',
    notify_manager BOOLEAN DEFAULT true,
    notify_it_admin BOOLEAN DEFAULT true,
    notify_hr BOOLEAN DEFAULT false,
    notification_email_addresses TEXT[] DEFAULT '{}',
    notification_message TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offboarding_templates_org ON offboarding_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_templates_active ON offboarding_templates(organization_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_offboarding_templates_one_default ON offboarding_templates(organization_id) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS scheduled_user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    target_email VARCHAR(255),
    target_first_name VARCHAR(255),
    target_last_name VARCHAR(255),
    target_personal_email VARCHAR(255),
    action_type VARCHAR(50) NOT NULL,
    onboarding_template_id UUID REFERENCES onboarding_templates(id) ON DELETE SET NULL,
    offboarding_template_id UUID REFERENCES offboarding_templates(id) ON DELETE SET NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    config_overrides JSONB DEFAULT '{}',
    scheduled_for TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_interval VARCHAR(50),
    recurrence_until TIMESTAMPTZ,
    last_recurrence_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    current_step VARCHAR(100),
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    depends_on_action_id UUID REFERENCES scheduled_user_actions(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_by UUID,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    CONSTRAINT check_action_type CHECK (action_type IN ('onboard', 'offboard', 'suspend', 'unsuspend', 'delete', 'restore')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_actions_pending ON scheduled_user_actions(organization_id, scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_user ON scheduled_user_actions(user_id, scheduled_for DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_status ON scheduled_user_actions(organization_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_retry ON scheduled_user_actions(next_retry_at, retry_count) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_approval ON scheduled_user_actions(organization_id, requires_approval, status) WHERE requires_approval = true AND status = 'pending' AND approved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_actions_in_progress ON scheduled_user_actions(organization_id, started_at) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS user_lifecycle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    action_id UUID REFERENCES scheduled_user_actions(id) ON DELETE SET NULL,
    step_name VARCHAR(100) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSONB DEFAULT '{}',
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_logs_org ON user_lifecycle_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_logs_user ON user_lifecycle_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_logs_action ON user_lifecycle_logs(action_id);

-- ============================================================================
-- SIGNATURES AND CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS signature_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    html_content TEXT NOT NULL,
    plain_text_content TEXT,
    merge_fields JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_campaign_template BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    version INTEGER DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signature_templates_default ON signature_templates(organization_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_signature_templates_org ON signature_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_signature_templates_status ON signature_templates(organization_id, status);

CREATE TABLE IF NOT EXISTS signature_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES signature_templates(id) ON DELETE CASCADE,
    assignment_type VARCHAR(30) NOT NULL CHECK (assignment_type IN ('user', 'group', 'dynamic_group', 'department', 'ou', 'organization')),
    target_id UUID,
    target_value VARCHAR(500),
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signature_assignments_unique ON signature_assignments(organization_id, template_id, assignment_type, target_id) WHERE target_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signature_assignments_unique_value ON signature_assignments(organization_id, template_id, assignment_type, target_value) WHERE target_value IS NOT NULL AND target_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signature_assignments_unique_org ON signature_assignments(organization_id, template_id, assignment_type) WHERE assignment_type = 'organization';
CREATE INDEX IF NOT EXISTS idx_signature_assignments_priority ON signature_assignments(organization_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_signature_assignments_template ON signature_assignments(template_id);

CREATE TABLE IF NOT EXISTS user_signature_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    current_template_id UUID REFERENCES signature_templates(id) ON DELETE SET NULL,
    active_campaign_id UUID,
    assignment_source VARCHAR(50),
    assignment_id UUID REFERENCES signature_assignments(id) ON DELETE SET NULL,
    rendered_html TEXT,
    last_synced_at TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed', 'error', 'skipped')),
    sync_error TEXT,
    google_signature_hash VARCHAR(64),
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signature_status_org ON user_signature_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_signature_status_sync ON user_signature_status(organization_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_user_signature_status_pending ON user_signature_status(organization_id, last_sync_attempt_at) WHERE sync_status = 'pending';

CREATE TABLE IF NOT EXISTS signature_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id UUID NOT NULL REFERENCES signature_templates(id) ON DELETE RESTRICT,
    banner_url VARCHAR(500),
    banner_link VARCHAR(500),
    banner_alt_text VARCHAR(255),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    tracking_enabled BOOLEAN DEFAULT true,
    tracking_options JSONB DEFAULT '{"opens": true, "unique": true, "geo": true}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    auto_revert BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    launched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT campaign_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_signature_campaigns_org ON signature_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_signature_campaigns_status ON signature_campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_signature_campaigns_schedule ON signature_campaigns(status, start_date, end_date) WHERE status IN ('scheduled', 'active');
CREATE INDEX IF NOT EXISTS idx_signature_campaigns_active ON signature_campaigns(organization_id, start_date, end_date) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS campaign_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
    assignment_type VARCHAR(30) NOT NULL CHECK (assignment_type IN ('user', 'group', 'dynamic_group', 'department', 'ou', 'organization')),
    target_id UUID,
    target_value VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_assignments_unique ON campaign_assignments(campaign_id, assignment_type, target_id) WHERE target_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_assignments_unique_value ON campaign_assignments(campaign_id, assignment_type, target_value) WHERE target_value IS NOT NULL AND target_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_assignments_unique_org ON campaign_assignments(campaign_id, assignment_type) WHERE assignment_type = 'organization';
CREATE INDEX IF NOT EXISTS idx_campaign_assignments_campaign ON campaign_assignments(campaign_id);

CREATE TABLE IF NOT EXISTS signature_tracking_pixels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    pixel_token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tracking_pixels_unique UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_pixels_token ON signature_tracking_pixels(pixel_token);

CREATE TABLE IF NOT EXISTS signature_tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pixel_id UUID NOT NULL REFERENCES signature_tracking_pixels(id) ON DELETE CASCADE,
    campaign_id UUID,
    user_id UUID NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address_hash VARCHAR(64),
    user_agent TEXT,
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    is_unique BOOLEAN DEFAULT false,
    device_type VARCHAR(20),
    campaign_name VARCHAR(255),
    tracking_type VARCHAR(20) DEFAULT 'campaign' CHECK (tracking_type IN ('user', 'campaign')),
    user_tracking_id UUID
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign ON signature_tracking_events(campaign_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON signature_tracking_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_events_time ON signature_tracking_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_events_unique ON signature_tracking_events(campaign_id, is_unique) WHERE is_unique = true;

CREATE TABLE IF NOT EXISTS signature_user_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES signature_campaigns(id) ON DELETE SET NULL,
    template_id UUID REFERENCES signature_templates(id) ON DELETE SET NULL,
    tracking_token VARCHAR(100) NOT NULL UNIQUE,
    total_opens INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    last_open_at TIMESTAMPTZ,
    first_open_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sig_user_tracking_org ON signature_user_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_sig_user_tracking_user ON signature_user_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_sig_user_tracking_token ON signature_user_tracking(tracking_token);

CREATE TABLE IF NOT EXISTS signature_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'self',
    target_id UUID,
    granted_by UUID,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id, permission_type, scope, target_id)
);

CREATE INDEX IF NOT EXISTS idx_sig_permissions_org ON signature_permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sig_permissions_user ON signature_permissions(user_id);

-- Add FK for user_signature_status.active_campaign_id
ALTER TABLE user_signature_status
    ADD CONSTRAINT fk_user_signature_status_campaign
    FOREIGN KEY (active_campaign_id) REFERENCES signature_campaigns(id) ON DELETE SET NULL;

-- ============================================================================
-- AI ASSISTANT
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    primary_endpoint_url VARCHAR(500) NOT NULL,
    primary_api_key_encrypted TEXT,
    primary_model VARCHAR(100) NOT NULL,
    fallback_endpoint_url VARCHAR(500),
    fallback_api_key_encrypted TEXT,
    fallback_model VARCHAR(100),
    tool_call_model VARCHAR(100),
    is_enabled BOOLEAN DEFAULT false,
    max_tokens_per_request INT DEFAULT 4096,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    context_window_tokens INT DEFAULT 8000,
    requests_per_minute_limit INT DEFAULT 20,
    tokens_per_day_limit INT DEFAULT 100000,
    mcp_enabled BOOLEAN DEFAULT false,
    mcp_server_url VARCHAR(500),
    system_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    endpoint_used VARCHAR(50),
    model_used VARCHAR(100),
    request_type VARCHAR(50),
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms INT,
    was_tool_call BOOLEAN DEFAULT false,
    tools_invoked TEXT[],
    was_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    error_code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_date ON ai_usage_log(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_log(model_used, created_at);

CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_call_id VARCHAR(100),
    tool_name VARCHAR(100),
    page_context VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_org ON ai_chat_history(organization_id, created_at);

-- ============================================================================
-- API KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

CREATE TABLE IF NOT EXISTS api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage_logs(created_at);

-- ============================================================================
-- CUSTOM LABELS (Entity Customization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    canonical_name VARCHAR(100) NOT NULL,
    label_singular VARCHAR(30) NOT NULL,
    label_plural VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(organization_id, canonical_name),
    CHECK (char_length(label_singular) <= 30),
    CHECK (char_length(label_plural) <= 30),
    CHECK (label_singular <> ''),
    CHECK (label_plural <> '')
);

CREATE INDEX IF NOT EXISTS idx_custom_labels_org ON custom_labels(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_labels_canonical ON custom_labels(canonical_name);

-- Module entity providers
CREATE TABLE IF NOT EXISTS module_entity_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key VARCHAR(100) NOT NULL,
    entity_canonical_name VARCHAR(100) NOT NULL,
    is_primary_provider BOOLEAN DEFAULT false,
    UNIQUE(module_key, entity_canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_module_entity_providers_module ON module_entity_providers(module_key);
CREATE INDEX IF NOT EXISTS idx_module_entity_providers_entity ON module_entity_providers(entity_canonical_name);

-- ============================================================================
-- HELPDESK
-- ============================================================================

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES organization_users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    category VARCHAR(50),
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    sla_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org ON helpdesk_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_user ON helpdesk_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assigned ON helpdesk_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(status);

-- ============================================================================
-- EMAIL TEMPLATES AND SMTP
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, template_key)
);

CREATE TABLE IF NOT EXISTS smtp_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    username VARCHAR(255),
    password_encrypted TEXT,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    use_tls BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BULK OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    parameters JSONB DEFAULT '{}',
    results JSONB DEFAULT '[]',
    error_log JSONB DEFAULT '[]',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_org ON bulk_operations(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operations(status);

-- ============================================================================
-- WORKFLOWS (Future)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);

-- ============================================================================
-- USER DASHBOARD WIDGETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    widget_type VARCHAR(50) NOT NULL,
    position INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_widgets_user ON user_dashboard_widgets(user_id);

-- ============================================================================
-- PEOPLE DIRECTORY EXTENSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'minio',
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_media_user ON user_media(user_id);

CREATE TABLE IF NOT EXISTS user_fun_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_fun_facts_user ON user_fun_facts(user_id);

CREATE TABLE IF NOT EXISTS user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    interest VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);

CREATE TABLE IF NOT EXISTS user_expertise_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(20) DEFAULT 'intermediate',
    is_willing_to_help BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_expertise_user ON user_expertise_topics(user_id);

CREATE TABLE IF NOT EXISTS user_field_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'organization',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_user_field_visibility_user ON user_field_visibility(user_id);

-- ============================================================================
-- CUSTOM FIELDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    field_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'user',
    options JSONB,
    validation_rules JSONB,
    is_required BOOLEAN DEFAULT false,
    is_searchable BOOLEAN DEFAULT true,
    is_filterable BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    section VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org ON custom_field_definitions(organization_id);

CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(definition_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_def ON custom_field_values(definition_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_id, entity_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_users_updated_at
    BEFORE UPDATE ON organization_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Modules
CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_modules_updated_at
    BEFORE UPDATE ON organization_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Google Workspace
CREATE TRIGGER update_gw_credentials_updated_at
    BEFORE UPDATE ON gw_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gw_synced_users_updated_at
    BEFORE UPDATE ON gw_synced_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gw_groups_updated_at
    BEFORE UPDATE ON gw_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gw_org_units_updated_at
    BEFORE UPDATE ON gw_org_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Microsoft 365
CREATE TRIGGER update_ms_credentials_updated_at
    BEFORE UPDATE ON ms_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ms_synced_users_updated_at
    BEFORE UPDATE ON ms_synced_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ms_synced_groups_updated_at
    BEFORE UPDATE ON ms_synced_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ms_licenses_updated_at
    BEFORE UPDATE ON ms_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Departments and Master Data
CREATE TRIGGER departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cost_centers_updated_at
    BEFORE UPDATE ON cost_centers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_master_data_settings_updated_at
    BEFORE UPDATE ON master_data_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Feature flags
CREATE TRIGGER trigger_update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Signatures
CREATE TRIGGER trg_signature_templates_updated_at
    BEFORE UPDATE ON signature_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_signature_assignments_updated_at
    BEFORE UPDATE ON signature_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_signature_status_updated_at
    BEFORE UPDATE ON user_signature_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_signature_campaigns_updated_at
    BEFORE UPDATE ON signature_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lifecycle
CREATE TRIGGER onboarding_templates_updated_at
    BEFORE UPDATE ON onboarding_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER offboarding_templates_updated_at
    BEFORE UPDATE ON offboarding_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scheduled_user_actions_updated_at
    BEFORE UPDATE ON scheduled_user_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI
CREATE TRIGGER trigger_ai_config_updated_at
    BEFORE UPDATE ON ai_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Media assets
CREATE TRIGGER tr_media_assets_updated_at
    BEFORE UPDATE ON media_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_media_asset_folders_updated_at
    BEFORE UPDATE ON media_asset_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_media_asset_settings_updated_at
    BEFORE UPDATE ON media_asset_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Single tenant integrity check
CREATE OR REPLACE FUNCTION verify_single_tenant_integrity()
RETURNS BOOLEAN AS $$
DECLARE
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    IF org_count = 0 THEN
        RAISE NOTICE 'No organization found. Setup required.';
        RETURN false;
    ELSIF org_count = 1 THEN
        RAISE NOTICE 'Single-tenant integrity verified: 1 organization found.';
        RETURN true;
    ELSE
        RAISE EXCEPTION 'CRITICAL: Single-tenant violation detected! Found % organizations.', org_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get organization setting with default
CREATE OR REPLACE FUNCTION get_organization_setting(org_id UUID, setting_key TEXT, default_value TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT value INTO result
    FROM organization_settings
    WHERE organization_id = org_id AND key = setting_key;

    IF NOT FOUND AND default_value IS NOT NULL THEN
        INSERT INTO organization_settings (organization_id, key, value)
        VALUES (org_id, setting_key, default_value)
        ON CONFLICT (organization_id, key) DO NOTHING;
        RETURN default_value;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Activity logging function
CREATE OR REPLACE FUNCTION log_activity(
    p_organization_id UUID,
    p_action VARCHAR(100),
    p_user_id UUID DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(255) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO activity_logs (
        organization_id, user_id, actor_id, action,
        resource_type, resource_id, description,
        metadata, ip_address, user_agent
    ) VALUES (
        p_organization_id, p_user_id, p_actor_id, p_action,
        p_resource_type, p_resource_id, p_description,
        p_metadata, p_ip_address, p_user_agent
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Seed default labels for organization
CREATE OR REPLACE FUNCTION seed_default_labels(org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO custom_labels (organization_id, canonical_name, label_singular, label_plural)
    VALUES
        (org_id, 'entity.user', 'User', 'Users'),
        (org_id, 'entity.workspace', 'Team', 'Teams'),
        (org_id, 'entity.access_group', 'Group', 'Groups'),
        (org_id, 'entity.policy_container', 'Org Unit', 'Org Units'),
        (org_id, 'entity.device', 'Device', 'Devices')
    ON CONFLICT (organization_id, canonical_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Initialize organization labels trigger
CREATE OR REPLACE FUNCTION initialize_organization_labels()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_default_labels(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seed_labels_on_org_creation
    AFTER INSERT ON organizations
    FOR EACH ROW EXECUTE FUNCTION initialize_organization_labels();

-- Media asset token generator
CREATE OR REPLACE FUNCTION generate_media_asset_token()
RETURNS VARCHAR(100) AS $$
DECLARE
    new_token VARCHAR(100);
    token_exists BOOLEAN;
BEGIN
    LOOP
        new_token := replace(replace(encode(uuid_generate_v4()::text::bytea, 'base64'), '+', '-'), '/', '_');
        new_token := substring(new_token, 1, 22);
        SELECT EXISTS (SELECT 1 FROM media_assets WHERE access_token = new_token) INTO token_exists;
        EXIT WHEN NOT token_exists;
    END LOOP;
    RETURN new_token;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_media_asset_access_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_token IS NULL OR NEW.access_token = '' THEN
        NEW.access_token := generate_media_asset_token();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_media_assets_set_token
    BEFORE INSERT ON media_assets
    FOR EACH ROW EXECUTE FUNCTION set_media_asset_access_token();

-- Ensure single default signature template
CREATE OR REPLACE FUNCTION ensure_single_default_signature_template()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE signature_templates
        SET is_default = false
        WHERE organization_id = NEW.organization_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_default_signature
    BEFORE INSERT OR UPDATE OF is_default ON signature_templates
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_signature_template();

-- Ensure single default onboarding template
CREATE OR REPLACE FUNCTION ensure_single_default_onboarding_template()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE onboarding_templates
        SET is_default = false
        WHERE organization_id = NEW.organization_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_onboarding
    BEFORE INSERT OR UPDATE ON onboarding_templates
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_onboarding_template();

-- Ensure single default offboarding template
CREATE OR REPLACE FUNCTION ensure_single_default_offboarding_template()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE offboarding_templates
        SET is_default = false
        WHERE organization_id = NEW.organization_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_offboarding
    BEFORE INSERT OR UPDATE ON offboarding_templates
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_offboarding_template();

-- Campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id UUID)
RETURNS TABLE (
    total_opens BIGINT,
    unique_opens BIGINT,
    unique_recipients BIGINT,
    top_performer_user_id UUID,
    top_performer_opens BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_opens,
        COUNT(*) FILTER (WHERE is_unique = true)::BIGINT AS unique_opens,
        COUNT(DISTINCT ip_address_hash)::BIGINT AS unique_recipients,
        (
            SELECT ste.user_id
            FROM signature_tracking_events ste
            WHERE ste.campaign_id = p_campaign_id
            GROUP BY ste.user_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) AS top_performer_user_id,
        (
            SELECT COUNT(*)::BIGINT
            FROM signature_tracking_events ste
            WHERE ste.campaign_id = p_campaign_id
            GROUP BY ste.user_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) AS top_performer_opens
    FROM signature_tracking_events
    WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User signature permissions view (aggregates explicit + implicit permissions)
CREATE OR REPLACE VIEW user_signature_permissions AS
SELECT
    ou.id AS user_id,
    ou.organization_id,
    ou.email,
    ou.first_name,
    ou.last_name,
    COALESCE(
        CASE WHEN ou.role = 'admin' THEN 'admin' END,
        sp.permission_type,
        'viewer'
    ) AS effective_permission,
    sp.permission_type AS explicit_permission,
    sp.granted_by,
    sp.granted_at,
    sp.expires_at,
    ou.role = 'admin' AS is_org_admin
FROM organization_users ou
LEFT JOIN signature_permissions sp ON sp.user_id = ou.id
    AND sp.is_active = true
    AND (sp.expires_at IS NULL OR sp.expires_at > NOW());

-- Dashboard stats view
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    o.id as organization_id,
    o.name as organization_name,
    (SELECT COUNT(*) FROM organization_users WHERE organization_id = o.id AND is_active = true) as total_users,
    (SELECT COUNT(*) FROM organization_users WHERE organization_id = o.id AND role = 'admin') as admin_users,
    (SELECT COUNT(*) FROM organization_modules WHERE organization_id = o.id AND is_enabled = true) as enabled_modules,
    (SELECT COUNT(*) FROM gw_synced_users WHERE organization_id = o.id) as synced_google_users,
    (SELECT MAX(last_sync_at) FROM organization_modules WHERE organization_id = o.id) as last_sync,
    o.is_setup_complete,
    o.created_at
FROM organizations o;

-- Current user assets view
CREATE OR REPLACE VIEW current_user_assets AS
SELECT
    ua.*,
    u.email as user_email,
    u.first_name,
    u.last_name,
    a.asset_type,
    a.manufacturer,
    a.model,
    a.serial_number,
    a.asset_tag
FROM user_assets ua
JOIN organization_users u ON ua.user_id = u.id
JOIN assets a ON ua.asset_id = a.id
WHERE ua.returned_at IS NULL;

-- Campaign analytics summary
CREATE OR REPLACE VIEW campaign_analytics_summary AS
SELECT
    sc.id AS campaign_id,
    sc.organization_id,
    sc.name,
    sc.status,
    sc.start_date,
    sc.end_date,
    sc.tracking_enabled,
    COUNT(DISTINCT stp.user_id) AS enrolled_users,
    COUNT(ste.id) AS total_opens,
    COUNT(ste.id) FILTER (WHERE ste.is_unique = true) AS unique_opens,
    COUNT(DISTINCT ste.ip_address_hash) AS unique_recipients,
    CASE
        WHEN COUNT(DISTINCT stp.user_id) > 0
        THEN ROUND(COUNT(ste.id)::NUMERIC / COUNT(DISTINCT stp.user_id), 2)
        ELSE 0
    END AS opens_per_user
FROM signature_campaigns sc
LEFT JOIN signature_tracking_pixels stp ON stp.campaign_id = sc.id
LEFT JOIN signature_tracking_events ste ON ste.campaign_id = sc.id
GROUP BY sc.id;

-- ============================================================================
-- SEED DATA: DEFAULT MODULES
-- ============================================================================

INSERT INTO modules (name, slug, description, icon, version, is_available, config_schema) VALUES
('Google Workspace', 'google-workspace', 'Sync and manage Google Workspace users, groups, and organizational units', 'google', '1.0.0', true, '{
    "type": "object",
    "required": ["service_account_key", "admin_email", "domain"],
    "properties": {
        "service_account_key": {"type": "string", "title": "Service Account JSON Key", "format": "textarea"},
        "admin_email": {"type": "string", "title": "Admin Email", "format": "email"},
        "domain": {"type": "string", "title": "Google Workspace Domain"},
        "auto_sync": {"type": "boolean", "title": "Enable automatic synchronization", "default": true},
        "sync_interval_hours": {"type": "number", "title": "Sync interval in hours", "default": 24, "minimum": 1}
    }
}'::jsonb),
('Microsoft 365', 'microsoft-365', 'Sync and manage Microsoft 365 users and groups', 'microsoft', '1.0.0', true, '{
    "type": "object",
    "required": ["tenant_id", "client_id", "client_secret"],
    "properties": {
        "tenant_id": {"type": "string", "title": "Azure AD Tenant ID"},
        "client_id": {"type": "string", "title": "Application Client ID"},
        "client_secret": {"type": "string", "title": "Client Secret", "format": "password"}
    }
}'::jsonb),
('Slack', 'slack', 'Integrate with Slack for notifications and user management', 'slack', '1.0.0', false, null),
('Okta', 'okta', 'Single Sign-On and user provisioning with Okta', 'okta', '1.0.0', false, null)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    version = EXCLUDED.version,
    is_available = EXCLUDED.is_available,
    config_schema = EXCLUDED.config_schema,
    updated_at = NOW();

-- Also populate available_modules for compatibility
INSERT INTO available_modules (name, slug, module_key, description, icon, version, is_available, config_schema, category) VALUES
('Google Workspace', 'google-workspace', 'google_workspace', 'Sync and manage Google Workspace users, groups, and organizational units', 'google', '1.0.0', true, '{}'::jsonb, 'integration'),
('Microsoft 365', 'microsoft-365', 'microsoft_365', 'Sync and manage Microsoft 365 users and groups', 'microsoft', '1.0.0', true, '{}'::jsonb, 'integration')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA: DEFAULT FEATURE FLAGS
-- ============================================================================

INSERT INTO feature_flags (feature_key, name, description, is_enabled, category) VALUES
    ('automation.offboarding_templates', 'Offboarding Templates', 'Create and manage offboarding templates', true, 'automation'),
    ('automation.offboarding_execution', 'Offboarding Execution', 'Execute offboarding workflows', false, 'automation'),
    ('automation.onboarding_templates', 'Onboarding Templates', 'Create and manage onboarding templates', true, 'automation'),
    ('automation.onboarding_execution', 'Onboarding Execution', 'Execute onboarding workflows', true, 'automation'),
    ('automation.scheduled_actions', 'Scheduled Actions', 'View and manage scheduled automation tasks', true, 'automation'),
    ('automation.workflows', 'Workflows', 'Custom workflow builder', false, 'automation'),
    ('insights.reports', 'Reports', 'Generate and view reports', false, 'insights'),
    ('insights.team_analytics', 'Team Analytics', 'View team analytics and metrics', true, 'insights'),
    ('users.export', 'User Export', 'Export users to CSV/JSON', false, 'users'),
    ('users.delete', 'User Deletion', 'Delete users from the system', true, 'users'),
    ('integrations.google_workspace', 'Google Workspace', 'Google Workspace integration', true, 'integrations'),
    ('integrations.microsoft_365', 'Microsoft 365', 'Microsoft 365 integration', true, 'integrations'),
    ('signatures.templates', 'Signature Templates', 'Create and manage email signature templates', true, 'signatures'),
    ('signatures.campaigns', 'Signature Campaigns', 'Time-limited signature campaigns with tracking', true, 'signatures'),
    ('signatures.tracking', 'Signature Tracking', 'Track signature views with pixels', true, 'signatures'),
    ('nav.section.automation', 'Automation Section', 'Show entire Automation section in navigation', true, 'navigation'),
    ('nav.section.assets', 'Assets Section', 'Show entire Assets section in navigation', true, 'navigation'),
    ('nav.section.security', 'Security Section', 'Show entire Security section in navigation', true, 'navigation'),
    ('nav.onboarding', 'Onboarding', 'Show Onboarding in navigation menu', true, 'navigation'),
    ('nav.offboarding', 'Offboarding', 'Show Offboarding in navigation menu', true, 'navigation'),
    ('nav.scheduled_actions', 'Scheduled Actions', 'Show Scheduled Actions in navigation menu', true, 'navigation'),
    ('nav.workflows', 'Workflows Navigation', 'Show Workflows in navigation menu', false, 'navigation'),
    ('nav.signatures', 'Signatures', 'Show Signatures in navigation menu', true, 'navigation'),
    ('nav.it_assets', 'IT Assets', 'Show IT Assets in navigation menu', true, 'navigation'),
    ('nav.media_files', 'Media Files', 'Show Media Files in navigation menu', true, 'navigation'),
    ('nav.security_events', 'Security Events', 'Show Security Events in navigation menu', true, 'navigation'),
    ('nav.audit_logs', 'Audit Logs', 'Show Audit Logs in navigation menu', true, 'navigation'),
    ('nav.external_sharing', 'External Sharing', 'Show External Sharing in navigation menu', true, 'navigation')
ON CONFLICT (feature_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    updated_at = NOW();

-- ============================================================================
-- SEED DATA: MODULE ENTITY PROVIDERS
-- ============================================================================

INSERT INTO module_entity_providers (module_key, entity_canonical_name, is_primary_provider) VALUES
    ('core', 'entity.user', true),
    ('core', 'entity.policy_container', false),
    ('google_workspace', 'entity.access_group', true),
    ('google_workspace', 'entity.policy_container', true),
    ('microsoft_365', 'entity.workspace', true),
    ('microsoft_365', 'entity.access_group', false),
    ('google_chat', 'entity.workspace', false),
    ('device_management', 'entity.device', true)
ON CONFLICT (module_key, entity_canonical_name) DO NOTHING;

-- ============================================================================
-- COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Helios Client Portal Schema Created';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'All tables, indexes, triggers, and seed data are ready.';
    RAISE NOTICE 'No migrations needed - this is the complete state.';
    RAISE NOTICE '';
END $$;
