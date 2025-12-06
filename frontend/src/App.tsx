import { useState, useEffect } from 'react'
import './App.css'
import { LoginPage } from './pages/LoginPage'
import { ClientUserMenu } from './components/ClientUserMenu'
import { AccountSetup } from './components/AccountSetup'
import { Settings } from './components/Settings'
import { PlatformCard } from './components/PlatformCard'
import { MetricCard } from './components/MetricCard'
import { DashboardCustomizer } from './components/DashboardCustomizer'
import { Administrators } from './components/Administrators'
import { Users } from './pages/Users'
import { Groups } from './pages/Groups'
import { GroupDetail } from './pages/GroupDetail'
import { OrgUnits } from './pages/OrgUnits'
import OrgChart from './pages/OrgChart'
import { AssetManagement } from './pages/AssetManagement'
import { Workspaces } from './pages/Workspaces'
import SecurityEvents from './pages/SecurityEvents'
import { EmailSecurity } from './pages/EmailSecurity'
import Signatures from './pages/Signatures'
import AuditLogs from './pages/AuditLogs'
import { DeveloperConsole } from './pages/DeveloperConsole'
import { LabelsProvider, useLabels } from './contexts/LabelsContext'
import { ENTITIES } from './config/entities'
import { getWidgetData } from './utils/widget-data'
import { getEnabledWidgets, type WidgetId } from './config/widgets'
import { Zap, FileText, TrendingUp, Search, Home, Users as UsersIcon, UsersRound, MessageSquare, Building2, Package, Settings as SettingsIcon, UserPlus, Upload, Download, RefreshCw, AlertCircle, Info, TrendingUp as TrendingUpIcon, HardDrive, Shield, Edit3, Network, PenTool, Bell, Building, CheckCircle, HelpCircle } from 'lucide-react'

interface OrganizationConfig {
  organizationId: string;
  domain: string;
  organizationName: string;
  dwdConfigured: boolean;
}

interface LicenseData {
  reportDate: string;
  total: number;
  used: number;
  byEdition: {
    [key: string]: {
      total: number;
      used: number;
    };
  };
}

interface GoogleWorkspaceStats {
  connected: boolean;
  totalUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  lastSync: string | null;
  licenses: LicenseData | null;
}

interface Microsoft365Stats {
  connected: boolean;
  totalUsers: number;
  disabledUsers: number;
  adminUsers: number;
  lastSync: string | null;
  licenses: any | null;
}

interface HeliosStats {
  totalUsers: number;
  guestUsers: number;
  activeUsers: number;
}

interface OrganizationStats {
  google: GoogleWorkspaceStats;
  microsoft: Microsoft365Stats;
  helios: HeliosStats;
}

function AppContent() {

  // Custom labels from LabelsContext
  const { labels, isEntityAvailable, refreshLabels, isLoading: labelsLoading } = useLabels();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<OrganizationConfig | null>(null);
  const [step, setStep] = useState<'welcome' | 'setup' | 'login' | 'dashboard' | null>(null);
  const [setupStep, setSetupStep] = useState(1);
  const [setupData, setSetupData] = useState({
    organizationName: '',
    domain: '',
    adminEmail: '',
    serviceAccountFile: null as File | null,
    adminFirstName: '',
    adminLastName: '',
    adminPassword: ''
  });
  const [setupError, setSetupError] = useState<string | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    // Restore current page from localStorage on mount
    return localStorage.getItem('helios_current_page') || 'dashboard';
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loginOrgName, setLoginOrgName] = useState<string>('');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>([]);

  useEffect(() => {
    checkConfiguration();

    // Redirect /login to root since we only have one login page now
    if (window.location.pathname === '/login') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Fetch organization name for login screen
  useEffect(() => {
    if (step === 'login' && !loginOrgName) {
      const fetchOrgInfo = async () => {
        try {
          const response = await fetch('http://localhost:3001/api/organization/current');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setLoginOrgName(data.data.name);
            }
          }
        } catch (err) {
        }
      };
      fetchOrgInfo();
    }
  }, [step, loginOrgName]);

  // Save current page to localStorage whenever it changes
  useEffect(() => {
    if (currentPage) {
      localStorage.setItem('helios_current_page', currentPage);
    }
  }, [currentPage]);

  const checkConfiguration = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const token = localStorage.getItem('helios_token');
      const storedOrg = localStorage.getItem('helios_organization');

      if (token && storedOrg) {
        // Also load user data
        const storedUser = localStorage.getItem('helios_user');

        // Verify token is still valid
        try {
          const response = await fetch('http://localhost:3001/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // User is authenticated, set up dashboard
              const orgData = JSON.parse(storedOrg);
              setConfig({
                organizationId: orgData.organizationId,
                domain: orgData.domain,
                organizationName: orgData.organizationName,
                dwdConfigured: false
              });

              // Load user data
              if (storedUser) {
                setCurrentUser(JSON.parse(storedUser));
              }

              setStep('dashboard');
              fetchOrganizationStats(orgData.organizationId);
              return;
            }
          }
        } catch (err) {
          console.warn('Token verification failed:', err);
        }

        // Token invalid, clear it
        localStorage.removeItem('helios_token');
        localStorage.removeItem('helios_organization');
      }

      // Check if organization is set up (determines setup vs login)
      const checkResponse = await fetch('http://localhost:3001/api/organization/setup/status');
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.data && checkData.data.isSetupComplete) {
          // Organization exists, show login screen
          setStep('login'); // Show login screen since organization exists
        } else {
          setStep('setup'); // Go directly to account setup
        }
      } else {
        setStep('setup');
      }

    } catch (err) {
      console.error('Config check failed:', err);
      // On error, default to setup page rather than welcome
      // This prevents the flash of welcome page on network errors
      setStep('setup');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationStats = async (organizationId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  // Load user preferences for dashboard widgets
  const loadUserPreferences = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/dashboard/widgets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
        }
      });
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        // Map widget data to widget IDs, filtering visible ones
        const widgetIds = data.data
          .filter((w: any) => w.isVisible !== false)
          .sort((a: any, b: any) => a.position - b.position)
          .map((w: any) => w.widgetId);
        setVisibleWidgets(widgetIds);
      } else {
        // No saved preferences, use defaults
        const defaultWidgets = getEnabledWidgets();
        setVisibleWidgets(defaultWidgets.map(w => w.id));
      }
    } catch (err) {
      console.error('Failed to load dashboard widgets:', err);
      // On error, use defaults
      const defaultWidgets = getEnabledWidgets();
      setVisibleWidgets(defaultWidgets.map(w => w.id));
    }
  };

  // Save dashboard widget preferences
  const saveWidgetPreferences = async (widgets: WidgetId[]) => {
    try {
      // Map widgets to the format expected by the backend
      const widgetData = widgets.map((widgetId, index) => ({
        widgetId,
        position: index,
        isVisible: true,
        config: {}
      }));

      const response = await fetch(`http://localhost:3001/api/dashboard/widgets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
        },
        body: JSON.stringify({ widgets: widgetData })
      });

      const data = await response.json();

      if (data.success) {
        setVisibleWidgets(widgets);
      } else {
        alert('Failed to save widget preferences');
      }
    } catch (err) {
      console.error('Failed to save widget preferences:', err);
      alert('Failed to save widget preferences');
    }
  };

  const handleManualSync = async () => {
    if (!config?.organizationId) return;

    try {
      setSyncLoading(true);

      // Start sync in background
      const response = await fetch('http://localhost:3001/api/google-workspace/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: config.organizationId })
      });

      const data = await response.json();

      if (data.success) {
        // Show toast notification instead of blocking
        console.log('Sync started in background');

        // Poll for updates every 3 seconds
        const pollInterval = setInterval(async () => {
          await fetchOrganizationStats(config.organizationId);
        }, 3000);

        // Stop polling after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          setSyncLoading(false);
        }, 30000);
      } else {
        alert(`Sync failed: ${data.message}`);
        setSyncLoading(false);
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
      setSyncLoading(false);
    }
  };

  if (loading || step === null) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading Helios Client Portal...</p>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <AccountSetup
        onComplete={() => {
          // After account setup, show login
          setStep('login');
        }}
      />
    );
  }

  if (step === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(loginData) => {
          setCurrentUser(loginData.data.user);

          // Use organization info from login response (backend now includes it)
          if (loginData.data.organization) {
            setConfig({
              organizationId: loginData.data.organization.id,
              domain: loginData.data.organization.domain,
              organizationName: loginData.data.organization.name,
              dwdConfigured: false
            });
          }


          // Refresh labels now that we have a token (before showing dashboard!)
          refreshLabels().then(() => {
            setStep('dashboard');

            // Fetch organization stats and user preferences after dashboard shown
            if (loginData.data.organization) {
              fetchOrganizationStats(loginData.data.organization.id);
              loadUserPreferences();
            }
          });
        }}
        organizationName={loginOrgName || 'Your Organization'}
      />
    );
  }

  if (step === 'welcome') {
    return (
      <div className="app">
        <div className="welcome-container">
          <div className="welcome-card">
            <div className="welcome-header">
              <h1>🚀 Helios Admin Portal</h1>
              <p className="tagline">Unified SaaS Administration Platform</p>
            </div>

            <div className="welcome-body">
              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon"><UsersIcon size={24} /></div>
                  <h3>SaaS User Management</h3>
                  <p>Centrally manage users across Google Workspace and other SaaS platforms</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔐</div>
                  <h3>Secure Integration</h3>
                  <p>Domain-Wide Delegation and OAuth for enterprise-grade security</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Automation & Workflows</h3>
                  <p>Automate user lifecycle, provisioning, and cross-platform operations</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Unified Analytics</h3>
                  <p>Cross-platform reporting and compliance monitoring</p>
                </div>
              </div>

              <div className="welcome-cta">
                <button
                  className="btn-primary btn-large"
                  onClick={() => setStep('setup')}
                >
                  Get Started →
                </button>
                <p className="opensource-badge">
                  ⭐ Open Source (MIT) • Self-Host Free • Hosting from $49/mo
                </p>
              </div>

              <div className="info-banner">
                <strong>🎉 Welcome to Helios Admin Portal!</strong>
                <p>
                  Self-hosted SaaS administration platform starting with Google Workspace.
                  Microsoft 365, Slack, and other integrations coming soon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="app">
        <div className="setup-container">
          <div className="setup-card">
            <div className="setup-header">
              <h1>🔧 Google Workspace Setup</h1>
              <p>Configure Domain-Wide Delegation to connect your Google Workspace</p>
            </div>

            <div className="setup-body">
              {setupStep === 1 && (
                <div className="setup-step">
                  <h2>Step 1: Organization Information</h2>
                <p className="step-description">
                  Tell us about your Google Workspace organization
                </p>

                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    placeholder="Acme Corporation"
                    className="form-input"
                    value={setupData.organizationName}
                    onChange={e => setSetupData({...setupData, organizationName: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Google Workspace Domain</label>
                  <input
                    type="text"
                    placeholder="acme.com"
                    className="form-input"
                    value={setupData.domain}
                    onChange={e => setSetupData({...setupData, domain: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Admin Email</label>
                  <input
                    type="email"
                    placeholder="admin@acme.com"
                    className="form-input"
                    value={setupData.adminEmail}
                    onChange={e => setSetupData({...setupData, adminEmail: e.target.value})}
                  />
                </div>

                {setupError && (
                  <div className="setup-error">
                    ⚠️ {setupError}
                  </div>
                )}

                <div className="info-box">
                  <strong>ℹ️ What is Domain-Wide Delegation?</strong>
                  <p>
                    Domain-Wide Delegation allows Helios to securely access your Google Workspace
                    without requiring user passwords. It's the enterprise-grade way to manage
                    Google Workspace programmatically.
                  </p>
                </div>

                <div className="setup-actions">
                  <button className="btn-secondary" onClick={() => setStep('welcome')}>
                    ← Back
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (!setupData.organizationName || !setupData.domain || !setupData.adminEmail) {
                        setSetupError('Please fill in all fields');
                        return;
                      }
                      setSetupError(null);
                      setSetupStep(2);
                    }}
                  >
                    Next: Upload Service Account →
                  </button>
                </div>
                </div>
              )}

              {setupStep === 2 && (
                <div className="setup-step">
                  <h2>Step 2: Upload Service Account</h2>
                  <p className="step-description">
                    Upload your Google Cloud service account JSON file
                  </p>

                  <div className="file-upload-section">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSetupData({...setupData, serviceAccountFile: file});
                          setSetupError(null);
                        }
                      }}
                      style={{ display: 'none' }}
                      id="service-account-upload"
                    />
                    <label htmlFor="service-account-upload" className="file-upload-area">
                      {setupData.serviceAccountFile ? (
                        <div className="file-selected">
                          <div className="file-icon"><CheckCircle size={20} color="#10b981" /></div>
                          <div className="file-name">{setupData.serviceAccountFile.name}</div>
                          <div className="file-size">
                            {(setupData.serviceAccountFile.size / 1024).toFixed(2)} KB
                          </div>
                        </div>
                      ) : (
                        <div className="file-placeholder">
                          <div className="file-icon">📁</div>
                          <div className="file-text">Click to upload service account JSON</div>
                          <div className="file-hint">Download from Google Cloud Console</div>
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="info-box">
                    <strong>📋 How to get the service account JSON:</strong>
                    <ol>
                      <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                      <li>Create or select a project</li>
                      <li>Enable the Admin SDK API</li>
                      <li>Go to IAM & Admin → Service Accounts</li>
                      <li>Create Service Account</li>
                      <li>Enable Domain-Wide Delegation</li>
                      <li>Download JSON key file</li>
                    </ol>
                  </div>

                  <div className="setup-actions">
                    <button className="btn-secondary" onClick={() => setSetupStep(1)}>
                      ← Back
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        if (!setupData.serviceAccountFile) {
                          setSetupError('Please upload service account JSON file');
                          return;
                        }
                        setSetupError(null);
                        setSetupStep(3);
                      }}
                    >
                      Next: Configure DWD →
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 3 && (
                <div className="setup-step">
                  <h2>Step 3: Create Admin Account</h2>
                  <p className="step-description">
                    Create your administrator account to manage this portal
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={setupData.adminFirstName}
                        onChange={e => setSetupData({...setupData, adminFirstName: e.target.value})}
                        placeholder="John"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={setupData.adminLastName}
                        onChange={e => setSetupData({...setupData, adminLastName: e.target.value})}
                        placeholder="Doe"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Admin Password</label>
                    <input
                      type="password"
                      value={setupData.adminPassword}
                      onChange={e => setSetupData({...setupData, adminPassword: e.target.value})}
                      placeholder="Minimum 8 characters"
                      className="form-input"
                    />
                  </div>

                  <div className="info-box">
                    <strong>🔒 Admin Account</strong>
                    <p>
                      This account will have full access to manage your organization's SaaS applications.
                      You can add more users later with different permission levels.
                    </p>
                  </div>

                  <div className="setup-actions">
                    <button className="btn-secondary" onClick={() => setSetupStep(2)}>
                      ← Back
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        if (!setupData.adminFirstName || !setupData.adminLastName || !setupData.adminPassword) {
                          setSetupError('Please fill in all admin account fields');
                          return;
                        }
                        if (setupData.adminPassword.length < 8) {
                          setSetupError('Password must be at least 8 characters');
                          return;
                        }
                        setSetupError(null);
                        setSetupStep(4);
                      }}
                    >
                      Next: Configure DWD →
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 4 && (
                <div className="setup-step">
                  <h2>Step 4: Configure Domain-Wide Delegation</h2>
                  <p className="step-description">
                    Add Domain-Wide Delegation in Google Admin Console
                  </p>

                  <div className="dwd-instructions">
                    <div className="instruction-item">
                      <div className="step-number">1</div>
                      <div className="instruction-content">
                        <p>Go to <a href="https://admin.google.com/ac/owl/domainwidedelegation" target="_blank" rel="noopener noreferrer">
                          Google Admin Console → Security → API Controls → Domain-wide Delegation
                        </a></p>
                      </div>
                    </div>

                    <div className="instruction-item">
                      <div className="step-number">2</div>
                      <div className="instruction-content">
                        <p>Click "Add new" and enter this Client ID:</p>
                        <div className="copy-field">
                          <code>123456789012345678901</code>
                          <button onClick={() => navigator.clipboard?.writeText('123456789012345678901')}>📋</button>
                        </div>
                      </div>
                    </div>

                    <div className="instruction-item">
                      <div className="step-number">3</div>
                      <div className="instruction-content">
                        <p>Paste these OAuth scopes:</p>
                        <div className="copy-field scopes">
                          <code>https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group</code>
                          <button onClick={() => navigator.clipboard?.writeText('https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group')}>📋</button>
                        </div>
                      </div>
                    </div>

                    <div className="instruction-item">
                      <div className="step-number">4</div>
                      <div className="instruction-content">
                        <p>Click "Authorize" and then test the connection below</p>
                      </div>
                    </div>
                  </div>

                  <div className="setup-actions">
                    <button className="btn-secondary" onClick={() => setSetupStep(2)}>
                      ← Back
                    </button>
                    <button className="btn-test">
                      <Search size={16} /> Test Connection
                    </button>
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        try {
                          // Upload service account and create organization
                          if (!setupData.serviceAccountFile) {
                            setSetupError('Please upload service account file first');
                            return;
                          }

                          const fileContent = await setupData.serviceAccountFile.text();
                          const credentials = JSON.parse(fileContent);
                          const organizationId = crypto.randomUUID();

                          const response = await fetch('http://localhost:3001/api/google-workspace/setup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              organizationId,
                              domain: setupData.domain,
                              organizationName: setupData.organizationName,
                              adminEmail: setupData.adminEmail,
                              credentials
                            })
                          });

                          const data = await response.json();

                          if (!response.ok) {
                            throw new Error(data.error || 'Setup failed');
                          }

                          // Complete setup
                          const newConfig = {
                            organizationId,
                            domain: setupData.domain,
                            organizationName: setupData.organizationName,
                            dwdConfigured: true
                          };

                          localStorage.setItem('helios_organization', JSON.stringify(newConfig));
                          setConfig(newConfig);
                          setStep('dashboard');

                          // Trigger initial sync
                          setTimeout(() => fetchOrganizationStats(organizationId), 1000);

                        } catch (err: any) {
                          setSetupError(err.message || 'Setup failed');
                        }
                      }}
                    >
                      <CheckCircle size={16} /> Complete Setup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="app">
      <header className="client-header">
        <div className="header-left">
          <div className="org-logo"><Building size={24} /></div>
          <div className="org-info">
            <div className="org-name">{config?.organizationName || 'Organization'}</div>
            <div className="platform-name">Helios Admin Portal</div>
          </div>
        </div>
        <div className="header-center">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search users, groups, settings..."
              className="universal-search"
            />
            <span className="search-icon"><Search size={16} /></span>
          </div>
        </div>
        <div className="header-right">
          <div className="welcome-stats">
            <span className="welcome-text">Welcome, {currentUser?.firstName || 'User'}!</span>
          </div>
          <button className="icon-btn" title="Help" onClick={() => setCurrentPage('settings')}><HelpCircle size={18} /></button>
          <button className="icon-btn" title="Notifications"><Bell size={18} /></button>
          <ClientUserMenu
            userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User'}
            userEmail={currentUser?.email || 'user@domain.com'}
            userRole={currentUser?.role || 'user'}
            onChangePassword={() => {
              setCurrentPage('settings');
              setShowPasswordModal(true);
            }}
            onNavigateToSettings={() => {
              setCurrentPage('settings');
            }}
            onNavigateToAdministrators={() => {
              setCurrentPage('administrators');
            }}
            onNavigateToConsole={() => {
              setCurrentPage('console');
            }}
            onLogout={async () => {
              try {
                await fetch('http://localhost:3001/api/auth/logout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: currentUser?.id })
                });
              } catch (err) {
                console.warn('Logout API call failed:', err);
              }

              // Clear all stored data
              localStorage.removeItem('helios_token');
              localStorage.removeItem('helios_refresh_token');
              localStorage.removeItem('helios_organization');
              localStorage.removeItem('helios_client_config');

              // Reset to check configuration again
              setConfig(null);
              setStats(null);
              checkConfiguration();
            }}
          />
        </div>
      </header>

      <div className="client-layout">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
          <nav className="nav">
            <button
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('dashboard');
                if (config?.organizationId) {
                  fetchOrganizationStats(config.organizationId);
                }
              }}
            >
              <Home size={16} className="nav-icon" />
              <span>Home</span>
            </button>

            <div className="nav-section" data-labels-loaded={labelsLoading ? 'false' : 'true'}>
              <div className="nav-section-title">Directory</div>

              {/* Debug info for tests */}
              <div style={{ display: 'none' }} data-debug-access-group-available={String(isEntityAvailable(ENTITIES.ACCESS_GROUP))} />

              {/* Users - Always available (core entity) */}
              <button
                className={`nav-item ${currentPage === 'users' ? 'active' : ''}`}
                onClick={() => setCurrentPage('users')}
                data-testid="nav-users"
              >
                <UsersIcon size={16} className="nav-icon" />
                <span>{labels[ENTITIES.USER]?.plural || 'Users'}</span>
              </button>

              {/* Access Groups - Only if GWS or M365 enabled */}
              {isEntityAvailable(ENTITIES.ACCESS_GROUP) && (
                <button
                  className={`nav-item ${currentPage === 'groups' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('groups')}
                  data-testid="nav-access-groups"
                >
                  <UsersRound size={16} className="nav-icon" />
                  <span>{labels[ENTITIES.ACCESS_GROUP]?.plural || 'Groups'}</span>
                </button>
              )}

              {/* Workspaces - Only if M365 or Google Chat enabled */}
              {isEntityAvailable(ENTITIES.WORKSPACE) && (
                <button
                  className={`nav-item ${currentPage === 'workspaces' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('workspaces')}
                  data-testid="nav-workspaces"
                >
                  <MessageSquare size={16} className="nav-icon" />
                  <span>{labels[ENTITIES.WORKSPACE]?.plural || 'Teams'}</span>
                </button>
              )}

              {/* Org Chart - Shows manager relationships */}
              <button
                className={`nav-item ${currentPage === 'orgChart' ? 'active' : ''}`}
                onClick={() => setCurrentPage('orgChart')}
                data-testid="nav-org-chart"
              >
                <Network size={16} className="nav-icon" />
                <span>Org Chart</span>
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Assets</div>
              <button
                className={`nav-item ${currentPage === 'assets' ? 'active' : ''}`}
                onClick={() => setCurrentPage('assets')}
              >
                <Package size={16} className="nav-icon" />
                <span>Asset Management</span>
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Security</div>
              <button
                className={`nav-item ${currentPage === 'email-security' ? 'active' : ''}`}
                onClick={() => setCurrentPage('email-security')}
              >
                <Shield size={16} className="nav-icon" />
                <span>Email Security</span>
              </button>
              <button
                className={`nav-item ${currentPage === 'signatures' ? 'active' : ''}`}
                onClick={() => setCurrentPage('signatures')}
              >
                <PenTool size={16} className="nav-icon" />
                <span>Signatures</span>
              </button>
              <button
                className={`nav-item ${currentPage === 'security-events' ? 'active' : ''}`}
                onClick={() => setCurrentPage('security-events')}
              >
                <AlertCircle size={16} className="nav-icon" />
                <span>Security Events</span>
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Automation</div>
              <button className="nav-item">
                <span className="nav-icon"><Zap size={16} /></span>
                <span>Workflows</span>
              </button>
              <button className="nav-item">
                <span className="nav-icon"><FileText size={16} /></span>
                <span>Templates</span>
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Insights</div>
              <button className="nav-item">
                <span className="nav-icon"><TrendingUp size={16} /></span>
                <span>Reports</span>
              </button>
              <button className="nav-item">
                <span className="nav-icon"><Search size={16} /></span>
                <span>Analytics</span>
              </button>
            </div>

            <button
              className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentPage('settings')}
            >
              <SettingsIcon size={16} className="nav-icon" />
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        <main className="client-main">
          {currentPage === 'dashboard' && (
            <div className="dashboard-content">
              <div className="dashboard-header">
                <div className="dashboard-title">
                  <h1>Dashboard</h1>
                  <p className="dashboard-subtitle">Welcome to your Helios Admin Portal</p>
                </div>
              </div>

              {/* Dashboard Controls */}
              <div className="dashboard-controls">
                <button className="customize-dashboard-btn" onClick={() => setShowCustomizer(true)}>
                  <Edit3 size={16} />
                  Customize Dashboard
                </button>
              </div>

              {/* Dashboard Widget Grid */}
              <div className="dashboard-widget-grid">
                {visibleWidgets.length === 0 ? (
                  <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    Loading dashboard widgets...
                  </div>
                ) : (
                  visibleWidgets.map(widgetId => {
                    const widgetData = getWidgetData(widgetId, stats, () => {
                      // Widget click handler - navigate to appropriate page
                      if (widgetId.startsWith('google-') || widgetId.startsWith('microsoft-')) {
                        setCurrentPage('settings');
                      } else if (widgetId.startsWith('helios-')) {
                        setCurrentPage('users');
                      }
                    });

                    if (!widgetData) return null;

                    return (
                      <MetricCard
                        key={widgetId}
                        icon={widgetData.icon}
                        title={widgetData.title}
                        value={widgetData.value}
                        label={widgetData.label}
                        footer={widgetData.footer}
                        state={widgetData.state}
                        size={widgetData.size}
                        platformColor={widgetData.platformColor}
                        gridColumn={widgetData.gridColumn}
                        onClick={widgetData.onClick}
                      />
                    );
                  })
                )}
              </div>

              {/* Dashboard Customizer Modal */}
              <DashboardCustomizer
                isOpen={showCustomizer}
                onClose={() => setShowCustomizer(false)}
                selectedWidgets={visibleWidgets}
                onSave={saveWidgetPreferences}
                connectedPlatforms={{
                  google: stats?.google?.connected || false,
                  microsoft: stats?.microsoft?.connected || false,
                }}
              />

              {/* Quick Actions Section */}
              <div className="quick-actions-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn primary" onClick={() => setCurrentPage('users')}>
                    <UserPlus size={20} />
                    <span>Add User</span>
                  </button>
                  <button className="quick-action-btn secondary">
                    <Upload size={20} />
                    <span>Import CSV</span>
                  </button>
                  <button className="quick-action-btn secondary">
                    <Download size={20} />
                    <span>Export Report</span>
                  </button>
                </div>
              </div>

              {/* Two Column Layout for Activity and Alerts */}
              <div className="dashboard-two-column">
                {/* Recent Activity Section */}
                <div className="dashboard-card activity-card">
                  <h2 className="section-title">Recent Activity</h2>
                  <div className="activity-list">
                    {stats?.google?.lastSync || stats?.microsoft?.lastSync ? (
                      <>
                        {stats.google?.lastSync && (
                          <>
                            <div className="activity-item">
                              <div className="activity-icon success">
                                <RefreshCw size={14} />
                              </div>
                              <div className="activity-content">
                                <div className="activity-text">Google Workspace sync completed</div>
                                <div className="activity-time">{new Date(stats.google.lastSync).toLocaleString()}</div>
                              </div>
                            </div>
                            {stats.google.totalUsers > 0 && (
                              <div className="activity-item">
                                <div className="activity-icon info">
                                  <UsersIcon size={14} />
                                </div>
                                <div className="activity-content">
                                  <div className="activity-text">Synced {stats.google.totalUsers} users from Google Workspace</div>
                                  <div className="activity-time">{new Date(stats.google.lastSync).toLocaleString()}</div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {stats.microsoft?.lastSync && (
                          <div className="activity-item">
                            <div className="activity-icon success">
                              <RefreshCw size={14} />
                            </div>
                            <div className="activity-content">
                              <div className="activity-text">Microsoft 365 sync completed</div>
                              <div className="activity-time">{new Date(stats.microsoft.lastSync).toLocaleString()}</div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="empty-state">
                        <Info size={32} className="empty-icon" />
                        <p className="empty-title">No activity yet</p>
                        <p className="empty-subtitle">Get started with these actions:</p>
                        <div className="empty-actions">
                          {stats?.google?.connected && !stats.google.lastSync && (
                            <button className="empty-action-btn" onClick={handleManualSync}>
                              <RefreshCw size={16} />
                              Run first sync
                            </button>
                          )}
                          <button className="empty-action-btn" onClick={() => setCurrentPage('users')}>
                            <UserPlus size={16} />
                            Add a user
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alerts Section - Only Real Alerts */}
                <div className="dashboard-card alerts-card">
                  <h2 className="section-title">Alerts</h2>
                  <div className="alerts-list">
                    {stats?.google?.suspendedUsers && stats.google.suspendedUsers > 0 && (
                      <div className="alert-item warning">
                        <AlertCircle size={16} className="alert-icon" />
                        <div className="alert-content">
                          <div className="alert-text">
                            <strong>{stats.google.suspendedUsers} suspended {stats.google.suspendedUsers === 1 ? 'user' : 'users'}</strong> in Google Workspace - Review and restore or remove
                          </div>
                          <button className="alert-action" onClick={() => setCurrentPage('users')}>Review Users</button>
                        </div>
                      </div>
                    )}

                    {stats?.google?.connected && !stats.google.lastSync && (
                      <div className="alert-item info">
                        <Info size={16} className="alert-icon" />
                        <div className="alert-content">
                          <div className="alert-text">Initial Google Workspace sync recommended</div>
                          <button className="alert-action" onClick={handleManualSync}>Sync</button>
                        </div>
                      </div>
                    )}

                    {stats?.microsoft?.connected && !stats.microsoft.lastSync && (
                      <div className="alert-item info">
                        <Info size={16} className="alert-icon" />
                        <div className="alert-content">
                          <div className="alert-text">Initial Microsoft 365 sync recommended</div>
                          <button className="alert-action" onClick={handleManualSync}>Sync</button>
                        </div>
                      </div>
                    )}

                    {!stats?.google?.connected && !stats?.microsoft?.connected && stats?.helios && stats.helios.totalUsers === 0 && (
                      <div className="alert-item info">
                        <Info size={16} className="alert-icon" />
                        <div className="alert-content">
                          <div className="alert-text">No platforms connected yet</div>
                          <button className="alert-action" onClick={() => setCurrentPage('settings')}>Setup</button>
                        </div>
                      </div>
                    )}

                    {(!stats?.google?.suspendedUsers || stats.google.suspendedUsers === 0) && (stats?.google?.lastSync || stats?.microsoft?.lastSync) && (
                      <div className="empty-state">
                        <Info size={24} className="empty-icon" />
                        <p>No alerts at this time</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentPage === 'settings' && (
            <Settings
              organizationName={config?.organizationName || 'Organization'}
              domain={config?.domain || 'domain.com'}
              organizationId={config?.organizationId || ''}
              showPasswordModal={showPasswordModal}
              onPasswordModalChange={setShowPasswordModal}
              currentUser={currentUser}
            />
          )}

          {currentPage === 'users' && (
            <Users organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'administrators' && (
            <Administrators />
          )}

          {currentPage === 'groups' && !selectedGroupId && (
            <Groups
              organizationId={config?.organizationId || ''}
              onSelectGroup={(groupId: string) => setSelectedGroupId(groupId)}
            />
          )}

          {currentPage === 'groups' && selectedGroupId && (
            <GroupDetail
              organizationId={config?.organizationId || ''}
              groupId={selectedGroupId}
              onBack={() => setSelectedGroupId(null)}
            />
          )}

          {currentPage === 'workspaces' && (
            <Workspaces organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'orgChart' && (
            <OrgChart />
          )}

          {currentPage === 'assets' && (
            <AssetManagement organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'email-security' && (
            <EmailSecurity />
          )}

          {currentPage === 'signatures' && (
            <Signatures />
          )}

          {currentPage === 'security-events' && (
            <SecurityEvents />
          )}

          {currentPage === 'audit-logs' && (
            <AuditLogs />
          )}

          {currentPage === 'console' && (
            <DeveloperConsole organizationId={config?.organizationId || ''} />
          )}

          {currentPage !== 'dashboard' && currentPage !== 'settings' && currentPage !== 'users' && currentPage !== 'groups' && currentPage !== 'workspaces' && currentPage !== 'orgUnits' && currentPage !== 'assets' && currentPage !== 'email-security' && currentPage !== 'security-events' && currentPage !== 'audit-logs' && currentPage !== 'console' && currentPage !== 'administrators' && (
            <div className="page-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">🚧</div>
                <h2>{currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}</h2>
                <p>This section is coming soon!</p>
                <button
                  className="btn-primary"
                  onClick={() => setCurrentPage('dashboard')}
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      <footer className="client-footer">
        <p>Helios Admin Portal v1.0.0</p>
        <p>
          <a href="https://helios.gridworx.io/docs" target="_blank" rel="noopener noreferrer">
            📚 Documentation
          </a>
          {' • '}
          <a href="https://helios.gridworx.io/support" target="_blank" rel="noopener noreferrer">
            🆘 Support
          </a>
          {' • '}
          Powered by <a href="https://helios.gridworx.io" target="_blank" rel="noopener noreferrer">Helios</a>
        </p>
      </footer>
    </div>
  );
}

// Main App wrapper with LabelsProvider
function App() {
  return (
    <LabelsProvider>
      <AppContent />
    </LabelsProvider>
  );
}

export default App;