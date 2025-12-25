-- Helios Client Portal Database Schema
-- Single Organization Management System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types (drop if they exist first to avoid conflicts)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS audit_action CASCADE;

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'password_change', 'settings_change');

-- Organizations table (single record per installation)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    logo TEXT, -- URL or base64 encoded image
    primary_color VARCHAR(7), -- hex color code
    secondary_color VARCHAR(7),
    is_setup_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization settings table
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- Organization users table
CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    email_verification_token VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modules table (integration modules)
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    version VARCHAR(50) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    config_schema JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization modules (enabled modules per organization)
CREATE TABLE organization_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    is_configured BOOLEAN DEFAULT false,
    config JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50),
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, module_id)
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES organization_users(id),
    action audit_action NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Workspace module specific tables
CREATE TABLE gw_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    service_account_key TEXT NOT NULL, -- encrypted JSON key
    admin_email VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    scopes TEXT[],
    is_valid BOOLEAN DEFAULT false,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Workspace synced users
CREATE TABLE gw_synced_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    last_login_time TIMESTAMP WITH TIME ZONE,
    creation_time TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

-- Google Workspace groups
CREATE TABLE gw_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    google_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    description TEXT,
    member_count INTEGER DEFAULT 0,
    raw_data JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

-- Google Workspace organizational units
CREATE TABLE gw_org_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    google_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    parent_id VARCHAR(255),
    description TEXT,
    raw_data JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, google_id)
);

-- Create indexes for performance
CREATE INDEX idx_org_users_email ON organization_users(email);
CREATE INDEX idx_org_users_org_id ON organization_users(organization_id);
CREATE INDEX idx_org_users_role ON organization_users(role);
CREATE INDEX idx_org_settings_org_id ON organization_settings(organization_id);
CREATE INDEX idx_org_settings_key ON organization_settings(organization_id, key);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_org_modules_org_id ON organization_modules(organization_id);
CREATE INDEX idx_gw_synced_users_org_id ON gw_synced_users(organization_id);
CREATE INDEX idx_gw_groups_org_id ON gw_groups(organization_id);
CREATE INDEX idx_gw_org_units_org_id ON gw_org_units(organization_id);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_users_updated_at
    BEFORE UPDATE ON organization_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organization_modules_updated_at
    BEFORE UPDATE ON organization_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

-- Insert default modules
INSERT INTO modules (name, slug, description, icon, version, is_available, config_schema) VALUES
('Google Workspace', 'google_workspace', 'Sync and manage Google Workspace users, groups, and organizational units', 'google', '1.0.0', true, '{
    "type": "object",
    "required": ["service_account_key", "admin_email", "domain"],
    "properties": {
        "service_account_key": {"type": "string", "title": "Service Account JSON Key", "format": "textarea"},
        "admin_email": {"type": "string", "title": "Admin Email", "format": "email"},
        "domain": {"type": "string", "title": "Google Workspace Domain"},
        "auto_sync": {"type": "boolean", "title": "Enable automatic synchronization", "default": true},
        "sync_interval_hours": {"type": "number", "title": "Sync interval in hours", "default": 24, "minimum": 1}
    }
}'),
('Microsoft 365', 'microsoft_365', 'Sync and manage Microsoft 365 users and groups', 'microsoft', '1.0.0', false, '{
    "type": "object",
    "required": ["tenant_id", "client_id", "client_secret"],
    "properties": {
        "tenant_id": {"type": "string", "title": "Azure AD Tenant ID"},
        "client_id": {"type": "string", "title": "Application Client ID"},
        "client_secret": {"type": "string", "title": "Client Secret", "format": "password"}
    }
}'),
('Slack', 'slack', 'Integrate with Slack for notifications and user management', 'slack', '1.0.0', false, null),
('Okta', 'okta', 'Single Sign-On and user provisioning with Okta', 'okta', '1.0.0', false, null);

-- Create view for dashboard statistics
CREATE VIEW dashboard_stats AS
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

-- Helper function to check if organization is setup
CREATE OR REPLACE FUNCTION is_organization_setup_complete()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations WHERE is_setup_complete = true LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Helper function to get organization setting
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