import { useState, useEffect } from 'react';
import './Settings.css';
import { RolesManagement } from './RolesManagement';
import { ThemeSelector } from './ThemeSelector';
import GoogleWorkspaceWizard from './modules/GoogleWorkspaceWizard';
import Microsoft365Wizard from './modules/Microsoft365Wizard';
import { AISettings } from './settings/AISettings';
import { ApiKeyList } from './integrations/ApiKeyList';
import { ApiKeyWizard } from './integrations/ApiKeyWizard';
import { ApiKeyShowOnce } from './integrations/ApiKeyShowOnce';
import { MasterDataSection } from './settings/MasterDataSection';
import { TrackingSettings } from './settings/TrackingSettings';
import { FeatureFlagsSettings } from './settings/FeatureFlagsSettings';
import { useTabPersistence } from '../hooks/useTabPersistence';
import { Package, Building2, Shield, Lock, Palette, Settings as SettingsIcon, Key, Search as SearchIcon, RefreshCw, BarChart3, Info, MoreVertical, Power, Database, Bot } from 'lucide-react';

interface SettingsProps {
  organizationName: string;
  domain: string;
  organizationId: string;
  showPasswordModal?: boolean;
  onPasswordModalChange?: (show: boolean) => void;
  currentUser?: any;
}

interface ModuleStatus {
  isEnabled: boolean;
  userCount: number;
  lastSync: string | null;
  configuration: any;
  updatedAt?: string;
}

export function Settings({ organizationName, domain, organizationId, showPasswordModal: externalShowPasswordModal, onPasswordModalChange, currentUser }: SettingsProps) {
  const [activeTab, setActiveTab] = useTabPersistence<'modules' | 'organization' | 'roles' | 'security' | 'customization' | 'integrations' | 'masterdata' | 'ai' | 'advanced'>('helios_settings_tab', 'modules');
  const [showModuleConfig, setShowModuleConfig] = useState(false);
  const [configuringModule, setConfiguringModule] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Sync external password modal state
  useEffect(() => {
    if (externalShowPasswordModal !== undefined) {
      setShowPasswordModal(externalShowPasswordModal);
      if (externalShowPasswordModal) {
        setActiveTab('security');
      }
    }
  }, [externalShowPasswordModal]);
  const [googleWorkspaceStatus, setGoogleWorkspaceStatus] = useState<ModuleStatus>({
    isEnabled: false,
    userCount: 0,
    lastSync: null,
    configuration: null
  });
  const [microsoftStatus, setMicrosoftStatus] = useState<{
    isConfigured: boolean;
    isActive: boolean;
    syncStatus: string;
    lastSyncAt: string | null;
    stats: { users: number; groups: number; licenses: number };
  }>({
    isConfigured: false,
    isActive: false,
    syncStatus: 'not_configured',
    lastSyncAt: null,
    stats: { users: 0, groups: 0, licenses: 0 }
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  
  const [showApiKeyWizard, setShowApiKeyWizard] = useState(false);
  const [newApiKeyData, setNewApiKeyData] = useState<any>(null);
  const [showModuleMenu, setShowModuleMenu] = useState(false);

  // Fetch module status on component mount
  useEffect(() => {
    fetchModuleStatus();
  }, [organizationId]);

  const fetchModuleStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const token = localStorage.getItem('helios_token');

      // Fetch both Google and Microsoft status in parallel
      const [gwResponse, msResponse] = await Promise.all([
        fetch(`/api/v1/google-workspace/module-status/${organizationId}`),
        fetch('/api/v1/microsoft/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const gwData = await gwResponse.json();
      if (gwData.success) {
        setGoogleWorkspaceStatus(gwData.data);
      }

      const msData = await msResponse.json();
      if (msData.success) {
        setMicrosoftStatus(msData.data);
      }
    } catch (error) {
      console.error('Failed to fetch module status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your organization's configuration and modules</p>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            <button
              className={`settings-nav-item ${activeTab === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveTab('modules')}
            >
              <Package className="nav-icon" size={16} />
              <span>Modules</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'organization' ? 'active' : ''}`}
              onClick={() => setActiveTab('organization')}
            >
              <Building2 className="nav-icon" size={16} />
              <span>Organization</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <Shield className="nav-icon" size={16} />
              <span>Roles</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock className="nav-icon" size={16} />
              <span>Security</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'customization' ? 'active' : ''}`}
              onClick={() => setActiveTab('customization')}
            >
              <Palette className="nav-icon" size={16} />
              <span>Customization</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'integrations' ? 'active' : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              <Key className="nav-icon" size={16} />
              <span>Integrations</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'masterdata' ? 'active' : ''}`}
              onClick={() => setActiveTab('masterdata')}
            >
              <Database className="nav-icon" size={16} />
              <span>Master Data</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Bot className="nav-icon" size={16} />
              <span>AI Assistant</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              <SettingsIcon className="nav-icon" size={16} />
              <span>Advanced</span>
            </button>
          </nav>
        </div>

        <div className="settings-content">
          {activeTab === 'modules' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Modules</h2>
                <p>Enable and configure SaaS integrations for your organization</p>
              </div>

              <div className="modules-grid">
                <div className="module-card">
                  <div className="module-header">
                    <div className="module-info">
                      <div className="module-icon"><Package size={24} /></div>
                      <div className="module-details">
                        <h3>Google Workspace</h3>
                        <p>Manage users, groups, and settings</p>
                        {googleWorkspaceStatus.isEnabled && (
                          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
                            {googleWorkspaceStatus.userCount} user{googleWorkspaceStatus.userCount !== 1 ? 's' : ''} synced
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="module-status">
                      {isLoadingStatus ? (
                        <span className="status-badge" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>Loading...</span>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Connection Status Indicator */}
                            {googleWorkspaceStatus.isEnabled && (
                              <div
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: googleWorkspaceStatus.configuration ? '#4CAF50' : '#ff9800',
                                  animation: googleWorkspaceStatus.configuration ? 'none' : 'pulse 2s infinite',
                                  boxShadow: googleWorkspaceStatus.configuration ? '0 0 5px rgba(76,175,80,0.5)' : '0 0 5px rgba(255,152,0,0.5)'
                                }}
                                title={googleWorkspaceStatus.configuration ? 'Connected' : 'Not configured'}
                              />
                            )}
                            <span className={`status-badge ${googleWorkspaceStatus.isEnabled ? 'enabled' : 'disabled'}`}>
                              {googleWorkspaceStatus.isEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          {!googleWorkspaceStatus.isEnabled && (
                            <button
                              className="enable-btn"
                              onClick={() => {
                                setConfiguringModule('google-workspace');
                                setShowModuleConfig(true);
                              }}
                            >
                              Enable
                            </button>
                          )}
                          {googleWorkspaceStatus.isEnabled && (
                            <div className="module-actions">
                              <button
                                className="btn btn-info"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('helios_token');
                                    const response = await fetch('/api/v1/google-workspace/sync-now', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ organizationId })
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                      alert(`Sync complete!\n\nTotal users: ${data.stats?.total_users || 0}\nActive: ${data.stats?.active_users || 0}\nSuspended: ${data.stats?.suspended_users || 0}\nAdmins: ${data.stats?.admin_users || 0}`);
                                      await fetchModuleStatus();
                                    } else {
                                      alert(`Sync failed: ${data.message}`);
                                    }
                                  } catch (error: any) {
                                    alert(`Sync failed: ${error.message}`);
                                  }
                                }}
                              >
                                <RefreshCw size={14} /> Sync Now
                              </button>
                              <button
                                className="btn btn-success"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('helios_token');
                                    const response = await fetch('/api/v1/google-workspace/test-connection', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ organizationId, domain })
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                      alert(`Connection successful!\n\nProject: ${data.details?.projectId}\nDomain: ${data.details?.domain}\nUsers accessible: ${data.details?.userCount || 0}`);
                                    } else {
                                      alert(`Connection failed: ${data.message || data.error}`);
                                    }
                                  } catch (error: any) {
                                    alert(`Test failed: ${error.message}`);
                                  }
                                }}
                              >
                                <SearchIcon size={14} /> Test
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setConfiguringModule('google-workspace');
                                  setShowModuleConfig(true);
                                }}
                              >
                                <SettingsIcon size={14} /> Configure
                              </button>
                              <div className="module-more-menu">
                                <button
                                  className="module-more-btn"
                                  onClick={() => setShowModuleMenu(!showModuleMenu)}
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {showModuleMenu && (
                                  <div className="module-more-dropdown">
                                    <button
                                      className="danger"
                                      onClick={async () => {
                                        setShowModuleMenu(false);
                                        if (confirm('Are you sure you want to disable Google Workspace? This will stop all synchronization.')) {
                                          try {
                                            const token = localStorage.getItem('helios_token');
                                            const response = await fetch(`/api/v1/google-workspace/disable/${organizationId}`, {
                                              method: 'POST',
                                              headers: {
                                                'Authorization': `Bearer ${token}`
                                              }
                                            });

                                            const data = await response.json();
                                            if (data.success) {
                                              alert('Google Workspace has been disabled');
                                              fetchModuleStatus();
                                            } else {
                                              alert(`Failed to disable: ${data.message}`);
                                            }
                                          } catch (error) {
                                            alert('Error disabling Google Workspace');
                                            console.error(error);
                                          }
                                        }
                                      }}
                                    >
                                      <Power size={14} /> Disable Module
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="module-description">
                    <p>Connect your Google Workspace to manage users, groups, organizational units, and automate user lifecycle operations.</p>
                    <div className="module-features">
                      <span className="feature-tag">User Management</span>
                      <span className="feature-tag">Group Management</span>
                      <span className="feature-tag">Domain-Wide Delegation</span>
                      <span className="feature-tag">Automation</span>
                    </div>
                    {googleWorkspaceStatus.isEnabled && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '600', marginBottom: '6px' }}>
                          Configuration Details:
                        </div>
                        {googleWorkspaceStatus.configuration?.projectId && (
                          <div style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px' }}>
                            <strong>Project ID:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '3px' }}>{googleWorkspaceStatus.configuration.projectId}</code>
                          </div>
                        )}
                        {googleWorkspaceStatus.configuration?.clientEmail && (
                          <div style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px' }}>
                            <strong>Service Account:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem' }}>{googleWorkspaceStatus.configuration.clientEmail}</code>
                          </div>
                        )}
                        {googleWorkspaceStatus.lastSync && (
                          <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '6px' }}>
                            <strong>Last synced:</strong> {new Date(googleWorkspaceStatus.lastSync).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="module-card">
                  <div className="module-header">
                    <div className="module-info">
                      <div className="module-icon"><Building2 size={24} /></div>
                      <div className="module-details">
                        <h3>Microsoft 365</h3>
                        <p>Manage Entra ID users, groups, and licenses</p>
                        {microsoftStatus.isConfigured && (
                          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
                            {microsoftStatus.stats.users} user{microsoftStatus.stats.users !== 1 ? 's' : ''} synced
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="module-status">
                      {isLoadingStatus ? (
                        <span className="status-badge" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>Loading...</span>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {microsoftStatus.isConfigured && (
                              <div
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: microsoftStatus.isActive ? '#4CAF50' : '#ff9800',
                                  boxShadow: microsoftStatus.isActive ? '0 0 5px rgba(76,175,80,0.5)' : '0 0 5px rgba(255,152,0,0.5)'
                                }}
                                title={microsoftStatus.isActive ? 'Connected' : 'Inactive'}
                              />
                            )}
                            <span className={`status-badge ${microsoftStatus.isConfigured ? 'enabled' : 'disabled'}`}>
                              {microsoftStatus.isConfigured ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          {!microsoftStatus.isConfigured && (
                            <button
                              className="enable-btn"
                              onClick={() => {
                                setConfiguringModule('microsoft-365');
                                setShowModuleConfig(true);
                              }}
                            >
                              Enable
                            </button>
                          )}
                          {microsoftStatus.isConfigured && (
                            <div className="module-actions">
                              <button
                                className="btn btn-info"
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('helios_token');
                                    const response = await fetch('/api/v1/microsoft/sync', {
                                      method: 'POST',
                                      headers: {
                                        'Authorization': `Bearer ${token}`
                                      }
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                      alert('Sync started! Check back in a few moments.');
                                      setTimeout(() => fetchModuleStatus(), 3000);
                                    } else {
                                      alert(`Sync failed: ${data.message || data.error?.message}`);
                                    }
                                  } catch (error: any) {
                                    alert(`Sync failed: ${error.message}`);
                                  }
                                }}
                              >
                                <RefreshCw size={14} /> Sync Now
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="module-description">
                    <p>Connect your Microsoft 365 tenant to manage Entra ID users, groups, and license assignments.</p>
                    <div className="module-features">
                      <span className="feature-tag">Entra ID</span>
                      <span className="feature-tag">User Management</span>
                      <span className="feature-tag">License Management</span>
                    </div>
                    {microsoftStatus.isConfigured && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: '600', marginBottom: '6px' }}>
                          Sync Status: {microsoftStatus.syncStatus}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '4px' }}>
                          <strong>Users:</strong> {microsoftStatus.stats.users} | <strong>Groups:</strong> {microsoftStatus.stats.groups} | <strong>Licenses:</strong> {microsoftStatus.stats.licenses}
                        </div>
                        {microsoftStatus.lastSyncAt && (
                          <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '6px' }}>
                            <strong>Last synced:</strong> {new Date(microsoftStatus.lastSyncAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Organization Settings</h2>
                <p>Configure your organization details and branding</p>
              </div>

              <div className="settings-form">
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    value={organizationName}
                    readOnly
                    className="form-input"
                  />
                  <div className="form-hint">Contact support to change organization name</div>
                </div>

                <div className="form-group">
                  <label>Primary Domain</label>
                  <input
                    type="text"
                    value={domain}
                    readOnly
                    className="form-input"
                  />
                  <div className="form-hint">Used for SaaS integrations and user authentication</div>
                </div>

                <div className="form-group">
                  <label>Organization Logo</label>
                  <div className="logo-upload">
                    <div className="logo-preview"><Building2 size={32} /></div>
                    <button className="upload-btn">Upload Logo</button>
                    <div className="form-hint">Recommended: 200x200px PNG or SVG</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <RolesManagement />
          )}

          {activeTab === 'security' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Security Policies</h2>
                <p>Configure organization-wide security settings and policies</p>
              </div>

              <div className="security-section">
                <div className="security-card">
                  <h3><Lock size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Password Policy</h3>
                  <p>Set password requirements for all users in your organization</p>
                  <div className="policy-settings">
                    <div className="policy-row">
                      <label>Minimum Password Length</label>
                      <select className="form-select" defaultValue="8">
                        <option value="8">8 characters</option>
                        <option value="10">10 characters</option>
                        <option value="12">12 characters</option>
                        <option value="14">14 characters</option>
                        <option value="16">16 characters</option>
                      </select>
                    </div>
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Require uppercase letter</span>
                      </label>
                    </div>
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Require lowercase letter</span>
                      </label>
                    </div>
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" defaultChecked />
                        <span>Require number</span>
                      </label>
                    </div>
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>Require special character</span>
                      </label>
                    </div>
                    <div className="policy-row">
                      <label>Password Expiration</label>
                      <select className="form-select" defaultValue="0">
                        <option value="0">Never</option>
                        <option value="30">Every 30 days</option>
                        <option value="60">Every 60 days</option>
                        <option value="90">Every 90 days</option>
                        <option value="180">Every 180 days</option>
                        <option value="365">Every year</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="security-card">
                  <h3><Shield size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Account Lockout</h3>
                  <p>Configure account lockout settings after failed login attempts</p>
                  <div className="policy-settings">
                    <div className="policy-row">
                      <label>Max Failed Attempts</label>
                      <select className="form-select" defaultValue="5">
                        <option value="3">3 attempts</option>
                        <option value="5">5 attempts</option>
                        <option value="10">10 attempts</option>
                        <option value="0">Unlimited (no lockout)</option>
                      </select>
                    </div>
                    <div className="policy-row">
                      <label>Lockout Duration</label>
                      <select className="form-select" defaultValue="15">
                        <option value="5">5 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="0">Until admin unlocks</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="security-card">
                  <h3><Key size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Session Settings</h3>
                  <p>Control session timeout and concurrent login policies</p>
                  <div className="policy-settings">
                    <div className="policy-row">
                      <label>Session Timeout (Idle)</label>
                      <select className="form-select" defaultValue="60">
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                        <option value="480">8 hours</option>
                        <option value="0">Never (not recommended)</option>
                      </select>
                    </div>
                    <div className="policy-row">
                      <label>Max Concurrent Sessions</label>
                      <select className="form-select" defaultValue="0">
                        <option value="1">1 session only</option>
                        <option value="3">3 sessions</option>
                        <option value="5">5 sessions</option>
                        <option value="0">Unlimited</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="security-card">
                  <h3><Shield size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Authentication Requirements</h3>
                  <p>Enforce authentication methods for all users</p>
                  <div className="policy-settings">
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" disabled />
                        <span style={{ color: '#9ca3af' }}>Require Two-Factor Authentication for all users - Coming Soon</span>
                      </label>
                    </div>
                    <div className="policy-row">
                      <label className="checkbox-label">
                        <input type="checkbox" disabled />
                        <span style={{ color: '#9ca3af' }}>Require SSO for all users - Coming Soon</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="security-card">
                  <h3><Shield size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Single Sign-On (SSO)</h3>
                  <p>Configure SAML or OAuth for your organization</p>
                  <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', color: '#6b7280', fontSize: '13px' }}>
                    SSO configuration is coming soon. Contact support if you need early access.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customization' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Customization</h2>
                <p>Customize the look and feel of your organization's portal</p>
              </div>

              <div className="customization-section">
                {/* Theme Settings - Admin Only */}
                {currentUser?.role === 'admin' ? (
                  <ThemeSelector />
                ) : (
                  <div className="customization-card">
                    <h3><Palette size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Theme Settings</h3>
                    <p>Theme customization is restricted to administrators</p>
                    <div className="info-box">
                      <Info size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                      <span>Only organization administrators can change the theme. Please contact your admin if you'd like to request a different theme.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Integrations</h2>
                <p>Manage API keys and external integrations</p>
              </div>

              <div className="integrations-section">
                <ApiKeyList
                  organizationId={organizationId}
                  onCreateKey={() => setShowApiKeyWizard(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'masterdata' && (
            <MasterDataSection organizationId={organizationId} />
          )}

          {activeTab === 'ai' && (
            <AISettings organizationId={organizationId} />
          )}

          {activeTab === 'advanced' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Advanced Settings</h2>
                <p>Configure data synchronization and advanced platform settings</p>
              </div>

              <div className="advanced-section">
                <div className="advanced-card">
                  <h3><BarChart3 size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Data Synchronization</h3>
                  <p>Configure how data syncs between Helios and connected platforms</p>

                  <div className="sync-settings">
                    <div className="sync-setting-group">
                      <div className="sync-options">
                        <label>Automatic Sync Interval:</label>
                        <select className="form-select" defaultValue="900">
                          <option value="300">Every 5 minutes</option>
                          <option value="900">Every 15 minutes (Recommended)</option>
                          <option value="1800">Every 30 minutes</option>
                          <option value="3600">Every 1 hour</option>
                          <option value="14400">Every 4 hours</option>
                          <option value="86400">Once per day</option>
                        </select>
                        <div className="form-hint">
                          How often to automatically sync data from connected platforms.
                        </div>
                      </div>

                      <div className="sync-options" style={{ marginTop: '16px' }}>
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Enable automatic synchronization</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="info-box" style={{ marginTop: '16px' }}>
                    <Info size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    <span>Sync settings are applied per-module. Configure individual module sync from the Modules tab.</span>
                  </div>
                </div>

                {/* Email Tracking Settings */}
                <div style={{ marginTop: '24px' }}>
                  <TrackingSettings />
                </div>

                {/* Feature Flags Settings */}
                <div style={{ marginTop: '24px' }}>
                  <FeatureFlagsSettings />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModuleConfig && configuringModule === 'google-workspace' && (
        <GoogleWorkspaceWizard
          onClose={() => setShowModuleConfig(false)}
          onSuccess={async () => {
            setShowModuleConfig(false);
            await fetchModuleStatus();
          }}
        />
      )}

      {showModuleConfig && configuringModule === 'microsoft-365' && (
        <Microsoft365Wizard
          onClose={() => setShowModuleConfig(false)}
          onSuccess={async () => {
            setShowModuleConfig(false);
            await fetchModuleStatus();
          }}
        />
      )}

      {showPasswordModal && (
        <div className="module-config-modal">
          <div className="modal-overlay" onClick={() => {
            setShowPasswordModal(false);
            onPasswordModalChange?.(false);
          }}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2><Key size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Change Password</h2>
              <button className="modal-close" onClick={() => {
                setShowPasswordModal(false);
                onPasswordModalChange?.(false);
              }}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  placeholder="Enter your current password"
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Enter your new password"
                />
                <div className="form-hint">Minimum 8 characters</div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Re-enter your new password"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setShowPasswordModal(false);
                onPasswordModalChange?.(false);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
              }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (passwordData.newPassword !== passwordData.confirmPassword) {
                    alert('Passwords do not match');
                    return;
                  }
                  if (passwordData.newPassword.length < 8) {
                    alert('Password must be at least 8 characters');
                    return;
                  }

                  try {
                    const token = localStorage.getItem('helios_token');
                    const user = localStorage.getItem('helios_user');
                    const userData = user ? JSON.parse(user) : null;

                    const response = await fetch('/api/v1/user/change-password', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        userId: userData?.id,
                        currentPassword: passwordData.currentPassword,
                        newPassword: passwordData.newPassword
                      })
                    });

                    const data = await response.json();
                    if (data.success) {
                      alert('Password changed successfully');
                      setShowPasswordModal(false);
                      onPasswordModalChange?.(false);
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    } else {
                      alert(`${data.error || 'Failed to change password'}`);
                    }
                  } catch (err: any) {
                    alert(`Error: ${err.message}`);
                  }
                }}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiKeyWizard && (
        <ApiKeyWizard
          organizationId={organizationId}
          onClose={() => setShowApiKeyWizard(false)}
          onSuccess={(keyData) => {
            setShowApiKeyWizard(false);
            setNewApiKeyData(keyData);
          }}
        />
      )}

      {newApiKeyData && (
        <ApiKeyShowOnce
          keyData={newApiKeyData}
          onClose={() => setNewApiKeyData(null)}
        />
      )}
    </div>
  );
}
