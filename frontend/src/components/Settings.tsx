import { useState, useEffect } from 'react';
import './Settings.css';
import { RolesManagement } from './RolesManagement';
// import { ThemeSelector } from './ThemeSelector';

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
  const [activeTab, setActiveTab] = useState('modules');
  const [showModuleConfig, setShowModuleConfig] = useState(false);
  const [configuringModule, setConfiguringModule] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
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
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [customLabels, setCustomLabels] = useState({
    users: 'Users',
    groups: 'Groups',
    orgUnits: 'Org Units',
    devices: 'Devices',
    workflows: 'Workflows',
    templates: 'Templates'
  });

  // Fetch module status on component mount
  useEffect(() => {
    fetchModuleStatus();
  }, [organizationId]);

  const fetchModuleStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const response = await fetch(`http://localhost:3001/api/google-workspace/module-status/${organizationId}`);
      const data = await response.json();

      if (data.success) {
        setGoogleWorkspaceStatus(data.data);
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
              <span className="nav-icon">🔧</span>
              <span>Modules</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'organization' ? 'active' : ''}`}
              onClick={() => setActiveTab('organization')}
            >
              <span className="nav-icon">🏢</span>
              <span>Organization</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <span className="nav-icon">🎭</span>
              <span>Roles</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <span className="nav-icon">🔒</span>
              <span>Security</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'customization' ? 'active' : ''}`}
              onClick={() => setActiveTab('customization')}
            >
              <span className="nav-icon">🎨</span>
              <span>Customization</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              <span className="nav-icon">⚙️</span>
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
                      <div className="module-icon">🔧</div>
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
                          <span className={`status-badge ${googleWorkspaceStatus.isEnabled ? 'enabled' : 'disabled'}`}>
                            {googleWorkspaceStatus.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
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
                            <>
                              <button
                                className="test-btn"
                                style={{ marginLeft: '8px', padding: '6px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('helios_token');
                                    const response = await fetch('http://localhost:3001/api/google-workspace/test-connection', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ organizationId, domain })
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                      alert(`✅ Connection successful!\n\nProject: ${data.details?.projectId}\nDomain: ${data.details?.domain}\nUsers accessible: ${data.details?.userCount || 0}`);
                                    } else {
                                      alert(`❌ Connection failed: ${data.message || data.error}`);
                                    }
                                  } catch (error: any) {
                                    alert(`❌ Test failed: ${error.message}`);
                                  }
                                }}
                              >
                                🔍 Test
                              </button>
                              <button
                                className="sync-btn"
                                style={{ marginLeft: '8px', padding: '6px 12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('helios_token');
                                    const response = await fetch('http://localhost:3001/api/google-workspace/sync-now', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ organizationId })
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                      alert(`✅ Sync complete!\n\nTotal users: ${data.stats?.total_users || 0}\nActive: ${data.stats?.active_users || 0}\nSuspended: ${data.stats?.suspended_users || 0}\nAdmins: ${data.stats?.admin_users || 0}`);
                                      await fetchModuleStatus(); // Refresh the display
                                    } else {
                                      alert(`❌ Sync failed: ${data.message}`);
                                    }
                                  } catch (error: any) {
                                    alert(`❌ Sync failed: ${error.message}`);
                                  }
                                }}
                              >
                                🔄 Sync
                              </button>
                              <button
                                className="configure-btn"
                                onClick={() => {
                                  setConfiguringModule('google-workspace');
                                  setShowModuleConfig(true);
                                }}
                                style={{ marginLeft: '8px' }}
                              >
                                Reconfigure
                              </button>
                              <button
                                className="disable-btn"
                                onClick={async () => {
                                  if (confirm('Are you sure you want to disable Google Workspace? This will stop all synchronization.')) {
                                    try {
                                      const authData = localStorage.getItem('auth');
                                      const token = authData ? JSON.parse(authData).token : null;

                                      const response = await fetch(`http://localhost:3001/api/google-workspace/disable/${tenantId}`, {
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
                                style={{ marginLeft: '8px' }}
                              >
                                Disable
                              </button>
                            </>
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
                    {googleWorkspaceStatus.isEnabled && googleWorkspaceStatus.lastSync && (
                      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '8px' }}>
                        Last synced: {new Date(googleWorkspaceStatus.lastSync).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="module-card">
                  <div className="module-header">
                    <div className="module-info">
                      <div className="module-icon">🏢</div>
                      <div className="module-details">
                        <h3>Microsoft 365</h3>
                        <p>Manage Azure AD, Teams, and Exchange</p>
                      </div>
                    </div>
                    <div className="module-status">
                      <span className="status-badge coming-soon">Coming Soon</span>
                    </div>
                  </div>
                  <div className="module-description">
                    <p>Connect your Microsoft 365 tenant to manage Azure AD users, Teams, Exchange Online, and SharePoint permissions.</p>
                    <div className="module-features">
                      <span className="feature-tag disabled">Azure AD</span>
                      <span className="feature-tag disabled">Teams Management</span>
                      <span className="feature-tag disabled">Exchange Online</span>
                    </div>
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
                    <div className="logo-preview">🏢</div>
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
                <h2>Security Settings</h2>
                <p>Manage API keys, authentication, and security policies</p>
              </div>

              <div className="security-section">
                <div className="security-card">
                  <h3>🔐 API Keys</h3>
                  <p>Generate API keys for external access and MSP delegation</p>
                  <button className="btn-primary">+ Create API Key</button>
                </div>

                <div className="security-card">
                  <h3>🔑 Change Password</h3>
                  <p>Update your account password</p>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      // Will implement password change modal
                      setShowPasswordModal(true);
                    }}
                  >
                    Change Password
                  </button>
                </div>

                <div className="security-card">
                  <h3>🔒 Authentication</h3>
                  <p>Configure login methods and session settings</p>
                  <div className="auth-options">
                    <label className="checkbox-label">
                      <input type="checkbox" checked readOnly />
                      <span>Email/Password Login</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" />
                      <span>Single Sign-On (SSO)</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" />
                      <span>Two-Factor Authentication</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customization' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Customization</h2>
                <p>Customize labels and terminology to match your organization's preferences</p>
              </div>

              <div className="customization-section">
                <div className="customization-card">
                  <h3>🏷️ Navigation Labels</h3>
                  <p>Customize how items appear in your navigation menu</p>

                  <div className="label-grid">
                    <div className="label-item">
                      <label>Users Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.users}
                        onChange={(e) => setCustomLabels({...customLabels, users: e.target.value})}
                        placeholder="e.g., Users, Employees, Members"
                      />
                    </div>

                    <div className="label-item">
                      <label>Groups Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.groups}
                        onChange={(e) => setCustomLabels({...customLabels, groups: e.target.value})}
                        placeholder="e.g., Groups, Teams, Divisions"
                      />
                    </div>

                    <div className="label-item">
                      <label>Org Units Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.orgUnits}
                        onChange={(e) => setCustomLabels({...customLabels, orgUnits: e.target.value})}
                        placeholder="e.g., Org Units, Departments, Divisions"
                      />
                      <div className="form-hint">This will update how organizational units are displayed throughout the platform</div>
                    </div>

                    <div className="label-item">
                      <label>Devices Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.devices}
                        onChange={(e) => setCustomLabels({...customLabels, devices: e.target.value})}
                        placeholder="e.g., Devices, Assets, Equipment"
                      />
                    </div>

                    <div className="label-item">
                      <label>Workflows Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.workflows}
                        onChange={(e) => setCustomLabels({...customLabels, workflows: e.target.value})}
                        placeholder="e.g., Workflows, Automations, Processes"
                      />
                    </div>

                    <div className="label-item">
                      <label>Templates Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={customLabels.templates}
                        onChange={(e) => setCustomLabels({...customLabels, templates: e.target.value})}
                        placeholder="e.g., Templates, Blueprints, Standards"
                      />
                    </div>
                  </div>

                  <div className="customization-actions">
                    <button className="btn-secondary" onClick={() => {
                      // Reset to defaults
                      setCustomLabels({
                        users: 'Users',
                        groups: 'Groups',
                        orgUnits: 'Org Units',
                        devices: 'Devices',
                        workflows: 'Workflows',
                        templates: 'Templates'
                      });
                    }}>
                      Reset to Defaults
                    </button>
                    <button className="btn-primary" onClick={() => {
                      // Save custom labels to localStorage or backend
                      localStorage.setItem('helios_custom_labels', JSON.stringify(customLabels));
                      alert('✅ Custom labels saved successfully!');
                    }}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Theme Settings - Temporarily disabled */}
                {/* {currentUser?.role === 'admin' ? (
                  <ThemeSelector />
                ) : (
                  <div className="customization-card">
                    <h3>🎨 Theme Settings</h3>
                    <p>Theme customization is restricted to administrators</p>
                    <div className="info-box">
                      <span className="info-icon">ℹ️</span>
                      <span>Only organization administrators can change the theme. Please contact your admin if you'd like to request a different theme.</span>
                    </div>
                  </div>
                )} */}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Advanced Settings</h2>
                <p>Configure data synchronization and advanced platform settings</p>
              </div>

              <div className="advanced-section">
                <div className="advanced-card">
                  <h3>📊 Data Synchronization</h3>
                  <p>Configure how data syncs between Helios and connected platforms</p>

                  <div className="sync-settings">
                    <div className="sync-setting-group">
                      <h4>Sync Intervals</h4>
                      <div className="sync-options">
                        <label>Automatic Sync Interval:</label>
                        <select className="form-select" defaultValue="900">
                          <option value="300">Every 5 minutes</option>
                          <option value="900">Every 15 minutes (Recommended)</option>
                          <option value="1800">Every 30 minutes</option>
                          <option value="3600">Every 1 hour</option>
                          <option value="7200">Every 2 hours</option>
                          <option value="14400">Every 4 hours</option>
                          <option value="28800">Every 8 hours</option>
                          <option value="86400">Once per day</option>
                        </select>
                        <div className="form-hint">
                          How often to automatically sync data from connected platforms. Shorter intervals provide fresher data but use more resources.
                        </div>
                      </div>

                      <div className="sync-options">
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Enable automatic synchronization</span>
                        </label>
                      </div>

                      <div className="sync-options">
                        <label className="checkbox-label">
                          <input type="checkbox" defaultChecked />
                          <span>Sync immediately after configuration changes</span>
                        </label>
                      </div>
                    </div>

                    <div className="sync-setting-group">
                      <h4>Organizational Units</h4>
                      <div className="sync-options">
                        <label>Conflict Resolution:</label>
                        <select className="form-select">
                          <option value="platform_wins">Platform Wins (Google/Microsoft data overwrites local)</option>
                          <option value="local_wins">Local Wins (Local changes override platform)</option>
                          <option value="manual">Manual Resolution (Ask each time)</option>
                        </select>
                        <div className="form-hint">
                          Determines what happens when the same data is modified in both Helios and the connected platform
                        </div>
                      </div>

                      <div className="sync-options">
                        <label>Sync Direction:</label>
                        <select className="form-select">
                          <option value="bidirectional">Bidirectional (Sync both ways)</option>
                          <option value="from_platform">From Platform Only (Read-only)</option>
                          <option value="to_platform">To Platform Only (Push changes)</option>
                        </select>
                      </div>
                    </div>

                    <div className="sync-setting-group">
                      <h4>Users</h4>
                      <div className="sync-options">
                        <label>Conflict Resolution:</label>
                        <select className="form-select">
                          <option value="platform_wins">Platform Wins</option>
                          <option value="local_wins">Local Wins</option>
                          <option value="manual">Manual Resolution</option>
                        </select>
                      </div>
                    </div>

                    <div className="sync-setting-group">
                      <h4>Groups</h4>
                      <div className="sync-options">
                        <label>Conflict Resolution:</label>
                        <select className="form-select">
                          <option value="platform_wins">Platform Wins</option>
                          <option value="local_wins">Local Wins</option>
                          <option value="manual">Manual Resolution</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button className="btn-primary" style={{ marginTop: '16px' }}>
                    Save Sync Settings
                  </button>
                </div>

                <div className="advanced-card">
                  <h3>🔧 Platform Behavior</h3>
                  <p>Configure platform-specific behavior</p>
                  <div className="platform-note">
                    <strong>Note:</strong> These settings only apply when Google Workspace or Microsoft 365 is connected.
                    If you're only using one platform, conflict resolution is not applicable.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModuleConfig && configuringModule === 'google-workspace' && (
        <div className="module-config-modal">
          <div className="modal-overlay" onClick={() => setShowModuleConfig(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>🔧 Configure Google Workspace</h2>
              <button className="modal-close" onClick={() => setShowModuleConfig(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="security-notice" style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h4 style={{ color: '#856404', marginTop: 0 }}>🔒 Security Notice</h4>
                <p style={{ color: '#856404', marginBottom: '8px' }}>
                  <strong>You must use YOUR OWN Google Cloud service account.</strong>
                </p>
                <ul style={{ color: '#856404', marginBottom: 0, paddingLeft: '20px' }}>
                  <li>Create a service account in YOUR Google Cloud project</li>
                  <li>Never share service accounts between organizations</li>
                  <li>This ensures complete data isolation and security</li>
                </ul>
                <div style={{ marginTop: '12px' }}>
                  <a
                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0066cc', textDecoration: 'underline' }}
                  >
                    Create Service Account in Google Cloud →
                  </a>
                </div>
              </div>

              <div className="config-step">
                <h3>Step 1: Admin Email</h3>
                <p>Enter the Google Workspace admin email for domain-wide delegation</p>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@yourdomain.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div className="config-step">
                <h3>Step 2: Service Account</h3>
                <p>Upload YOUR organization's Google Cloud service account JSON file with domain-wide delegation enabled</p>

                <div className="file-upload">
                  <input
                    type="file"
                    accept=".json"
                    id="service-account-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setServiceAccountFile(file);
                      }
                    }}
                  />
                  <label htmlFor="service-account-upload" className="upload-button">
                    {serviceAccountFile ? serviceAccountFile.name : '📁 Choose Service Account JSON'}
                  </label>
                </div>

                {serviceAccountFile && adminEmail && (
                  <div className="config-actions">
                    <button
                      className="configure-btn"
                      disabled={isConfiguring}
                      onClick={async () => {
                        setIsConfiguring(true);
                        try {
                          const fileContent = await serviceAccountFile.text();
                          const serviceAccount = JSON.parse(fileContent);

                          // Get the auth token from localStorage
                          const token = localStorage.getItem('helios_token');

                          const response = await fetch('http://localhost:3001/api/google-workspace/setup', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              organizationId,
                              domain,
                              organizationName,
                              adminEmail,
                              credentials: serviceAccount
                            })
                          });

                          const data = await response.json();

                          if (data.success) {
                            alert('✅ Google Workspace module enabled successfully! Starting initial sync...');
                            setShowModuleConfig(false);

                            // Trigger initial sync immediately
                            const syncResponse = await fetch('http://localhost:3001/api/google-workspace/sync-now', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({ organizationId })
                            });

                            const syncData = await syncResponse.json();
                            if (syncData.success) {
                              alert(`✅ Initial sync complete! Found ${syncData.stats?.total_users || 0} users`);
                            } else {
                              alert(`⚠️ Module configured but sync failed: ${syncData.message || 'Unknown error'}`);
                            }

                            // Refresh module status to show updated counts
                            await fetchModuleStatus();
                          } else {
                            alert(`❌ Configuration failed: ${data.error || data.message || 'Unknown error'}`);
                          }
                        } catch (err: any) {
                          console.error('Configuration error:', err);
                          alert(`❌ Configuration failed: ${err.message || 'Failed to configure Google Workspace'}`);
                        } finally {
                          setIsConfiguring(false);
                        }
                      }}
                    >
                      {isConfiguring ? 'Configuring...' : '🚀 Configure Google Workspace'}
                    </button>
                  </div>
                )}
              </div>

              <div className="info-box">
                <strong>📋 How to get the service account:</strong>
                <ol>
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                  <li>Create or select a project</li>
                  <li>Enable Admin SDK API</li>
                  <li>Create Service Account with Domain-Wide Delegation</li>
                  <li>Download JSON key file</li>
                  <li>Configure DWD in Google Admin Console</li>
                </ol>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModuleConfig(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="module-config-modal">
          <div className="modal-overlay" onClick={() => {
            setShowPasswordModal(false);
            onPasswordModalChange?.(false);
          }}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>🔑 Change Password</h2>
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

                    const response = await fetch('http://localhost:3001/api/user/change-password', {
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
                      alert('✅ Password changed successfully');
                      setShowPasswordModal(false);
                      onPasswordModalChange?.(false);
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    } else {
                      alert(`❌ ${data.error || 'Failed to change password'}`);
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
    </div>
  );
}