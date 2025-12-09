import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import './App.css'
import { LoginPage } from './pages/LoginPage'
import { ClientUserMenu } from './components/ClientUserMenu'
import { AccountSetup } from './components/AccountSetup'
import { Settings } from './components/Settings'
// PlatformCard - available for future use
// import { PlatformCard } from './components/PlatformCard'
import { MetricCard } from './components/MetricCard'
import { DashboardCustomizer } from './components/DashboardCustomizer'
import { Administrators } from './components/Administrators'
import { Users } from './pages/Users'
import { Groups } from './pages/Groups'
import { GroupDetail } from './pages/GroupDetail'
// OrgUnits - available for future use
// import { OrgUnits } from './pages/OrgUnits'
import OrgChart from './pages/OrgChart'
import { AssetManagement } from './pages/AssetManagement'
import { FilesAssets } from './pages/FilesAssets'
import { Workspaces } from './pages/Workspaces'
import SecurityEvents from './pages/SecurityEvents'
import { EmailSecurity } from './pages/EmailSecurity'
import Signatures from './pages/Signatures'
import AuditLogs from './pages/AuditLogs'
import { DeveloperConsole } from './pages/DeveloperConsole'
import { AddUser } from './pages/AddUser'
import { MyProfile } from './pages/MyProfile'
import { People } from './pages/People'
import { MyTeam } from './pages/MyTeam'
import { MyGroups } from './pages/MyGroups'
import { UserSettings } from './pages/UserSettings'
import { LabelsProvider, useLabels } from './contexts/LabelsContext'
import { ViewProvider, useView } from './contexts/ViewContext'
import { AdminNavigation, UserNavigation, ViewSwitcher, ViewOnboarding } from './components/navigation'
import { getWidgetData } from './utils/widget-data'
import { getEnabledWidgets, type WidgetId } from './config/widgets'
import { UserPlus, Upload, Download, RefreshCw, AlertCircle, Info, Edit3, Bell, Building, HelpCircle, Search, Users as UsersIcon } from 'lucide-react'

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

// Wrapper component for GroupDetail to extract URL params
function GroupDetailWrapper({ organizationId }: { organizationId: string }) {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  if (!groupId) {
    return <Navigate to="/admin/groups" replace />;
  }

  return (
    <GroupDetail
      organizationId={organizationId}
      groupId={groupId}
      onBack={() => navigate('/admin/groups')}
    />
  );
}

// Helper to map URL paths to page identifiers for active nav highlighting
function getPageFromPath(pathname: string): string {
  // Admin routes (with /admin prefix)
  if (pathname === '/admin' || pathname === '/admin/dashboard') return 'dashboard';
  if (pathname.startsWith('/admin/users')) return 'users';
  if (pathname.startsWith('/admin/groups')) return 'groups';
  if (pathname.startsWith('/admin/org-chart')) return 'orgChart';
  if (pathname.startsWith('/admin/workspaces')) return 'workspaces';
  if (pathname.startsWith('/admin/assets')) return 'assets';
  if (pathname.startsWith('/admin/email-security')) return 'email-security';
  if (pathname.startsWith('/admin/signatures')) return 'signatures';
  if (pathname.startsWith('/admin/security-events')) return 'security-events';
  if (pathname.startsWith('/admin/audit-logs')) return 'audit-logs';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  if (pathname.startsWith('/admin/administrators')) return 'administrators';
  if (pathname.startsWith('/admin/console')) return 'console';

  // User routes (at root level)
  if (pathname === '/' || pathname === '/home' || pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/people')) return 'people';
  if (pathname.startsWith('/my-team')) return 'my-team';
  if (pathname.startsWith('/my-groups')) return 'my-groups';
  if (pathname.startsWith('/my-profile')) return 'my-profile';
  if (pathname.startsWith('/user-settings')) return 'user-settings';

  // Special pages
  if (pathname.startsWith('/add-user')) return 'add-user';

  // Legacy routes (for backwards compatibility - these will redirect)
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname.startsWith('/settings')) return 'settings';

  return 'dashboard';
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Custom labels from LabelsContext
  const { refreshLabels, isLoading: labelsLoading } = useLabels();

  // View context for admin/user view switching
  const { currentView, setCapabilities } = useView();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<OrganizationConfig | null>(null);
  const [step, setStep] = useState<'welcome' | 'setup' | 'login' | 'dashboard' | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [_syncLoading, setSyncLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Derive current page from URL path
  const currentPage = getPageFromPath(location.pathname);

  // Navigation helper that uses React Router - routes based on current view
  const setCurrentPage = (page: string) => {
    // Admin pages use /admin prefix
    const adminPathMap: Record<string, string> = {
      'dashboard': '/admin',
      'users': '/admin/users',
      'groups': '/admin/groups',
      'orgChart': '/admin/org-chart',
      'workspaces': '/admin/workspaces',
      'assets': '/admin/assets',
      'email-security': '/admin/email-security',
      'signatures': '/admin/signatures',
      'security-events': '/admin/security-events',
      'audit-logs': '/admin/audit-logs',
      'settings': '/admin/settings',
      'administrators': '/admin/administrators',
      'console': '/admin/console',
    };

    // User pages at root level
    const userPathMap: Record<string, string> = {
      'dashboard': '/',
      'home': '/',
      'people': '/people',
      'my-team': '/my-team',
      'my-groups': '/my-groups',
      'my-profile': '/my-profile',
      'user-settings': '/user-settings',
    };

    // Use appropriate path map based on current view
    if (currentView === 'admin' && adminPathMap[page]) {
      navigate(adminPathMap[page]);
    } else if (userPathMap[page]) {
      navigate(userPathMap[page]);
    } else if (adminPathMap[page]) {
      // Fallback to admin path if user path not found
      navigate(adminPathMap[page]);
    } else {
      navigate('/');
    }
  };

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loginOrgName, setLoginOrgName] = useState<string>('');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [widgetsError, setWidgetsError] = useState<string | null>(null);

  // Helper to navigate to group detail (admin route)
  const navigateToGroup = (groupId: string) => navigate(`/admin/groups/${groupId}`);

  useEffect(() => {
    checkConfiguration();
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

  // No need to save currentPage to localStorage - React Router handles URL state

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

  const fetchOrganizationStats = async (_organizationId: string) => {
    setStatsLoading(true);
    setStatsError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`http://localhost:3001/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch dashboard stats: HTTP', response.status);
        setStatsError(`Failed to load stats (HTTP ${response.status})`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        setStatsError(null);
      } else {
        setStatsError(data.error || 'Failed to load dashboard stats');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('Dashboard stats request timed out');
        setStatsError('Request timed out. Please refresh the page.');
      } else {
        console.error('Failed to fetch dashboard stats:', err);
        setStatsError('Unable to connect to the server. Please check your connection.');
      }
    } finally {
      setStatsLoading(false);
    }
  };

  // Load user preferences for dashboard widgets
  const loadUserPreferences = async () => {
    setWidgetsLoading(true);
    setWidgetsError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`http://localhost:3001/api/dashboard/widgets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to load dashboard widgets: HTTP', response.status);
        // Use defaults on HTTP error
        const defaultWidgets = getEnabledWidgets();
        setVisibleWidgets(defaultWidgets.map(w => w.id));
        return;
      }

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
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('Dashboard widgets request timed out');
        setWidgetsError('Request timed out. Using default widgets.');
      } else {
        console.error('Failed to load dashboard widgets:', err);
      }
      // On error, use defaults
      const defaultWidgets = getEnabledWidgets();
      setVisibleWidgets(defaultWidgets.map(w => w.id));
    } finally {
      setWidgetsLoading(false);
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

          // Set user capabilities for view switching
          // Use access flags from API if available, otherwise derive from role
          const user = loginData.data.user;
          setCapabilities({
            isAdmin: user.isAdmin ?? (user.role === 'admin' || user.role === 'super_admin'),
            isEmployee: user.isEmployee ?? true, // Default to true if not specified
          });

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
          refreshLabels().then(async () => {
            setStep('dashboard');

            // Fetch organization stats and user preferences after dashboard shown
            // Run both in parallel but await completion to avoid race conditions
            if (loginData.data.organization) {
              await Promise.all([
                fetchOrganizationStats(loginData.data.organization.id),
                loadUserPreferences()
              ]);
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
                  Self-hosted administration platform for Google Workspace.
                  Sync users, groups, and organizational units with ease.
                </p>
              </div>
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
          <ViewSwitcher />
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
            onNavigateToUserSettings={() => {
              setCurrentPage('user-settings');
            }}
            onNavigateToAdministrators={() => {
              setCurrentPage('administrators');
            }}
            onNavigateToConsole={() => {
              setCurrentPage('console');
            }}
            onNavigateToMyProfile={() => {
              setCurrentPage('my-profile');
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
          {/* View-aware navigation - show admin or user navigation based on current view */}
          {currentView === 'admin' ? (
            <AdminNavigation
              currentPage={currentPage}
              onNavigate={(page) => {
                setCurrentPage(page);
                if (page === 'dashboard' && config?.organizationId) {
                  fetchOrganizationStats(config.organizationId);
                }
              }}
              sidebarCollapsed={sidebarCollapsed}
              labelsLoading={labelsLoading}
            />
          ) : (
            <UserNavigation
              currentPage={currentPage}
              onNavigate={setCurrentPage}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}
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
                {widgetsLoading || statsLoading ? (
                  <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: 'inline-block', marginRight: '0.5rem' }} />
                    Loading dashboard...
                  </div>
                ) : widgetsError ? (
                  <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
                    <AlertCircle size={20} style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {widgetsError}
                  </div>
                ) : statsError ? (
                  <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '2rem', color: '#d97706', background: '#fef3c7', borderRadius: '8px' }}>
                    <AlertCircle size={20} style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {statsError}
                    <button
                      onClick={() => config?.organizationId && fetchOrganizationStats(config.organizationId)}
                      style={{ marginLeft: '1rem', padding: '4px 12px', fontSize: '13px', background: 'white', border: '1px solid #d97706', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Retry
                    </button>
                  </div>
                ) : visibleWidgets.length === 0 ? (
                  <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No widgets configured. Click "Customize Dashboard" to add widgets.
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
                        {/* Microsoft 365 sync activity - Coming Soon */}
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

                    {/* Microsoft 365 alerts - Coming Soon */}

                    {!stats?.google?.connected && stats?.helios && stats.helios.totalUsers === 0 && (
                      <div className="alert-item info">
                        <Info size={16} className="alert-icon" />
                        <div className="alert-content">
                          <div className="alert-text">Google Workspace not connected yet</div>
                          <button className="alert-action" onClick={() => setCurrentPage('settings')}>Setup</button>
                        </div>
                      </div>
                    )}

                    {(!stats?.google?.suspendedUsers || stats.google.suspendedUsers === 0) && stats?.google?.lastSync && (
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

          {currentPage === 'groups' && (
            <Routes>
              <Route
                path="/admin/groups/:groupId"
                element={<GroupDetailWrapper organizationId={config?.organizationId || ''} />}
              />
              <Route
                path="/admin/groups"
                element={
                  <Groups
                    organizationId={config?.organizationId || ''}
                    onSelectGroup={navigateToGroup}
                  />
                }
              />
              {/* Legacy route redirect */}
              <Route
                path="/groups/:groupId"
                element={<Navigate to={`/admin/groups/${location.pathname.split('/').pop()}`} replace />}
              />
              <Route
                path="/groups"
                element={<Navigate to="/admin/groups" replace />}
              />
            </Routes>
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

          {currentPage === 'files-assets' && (
            <FilesAssets organizationId={config?.organizationId || ''} />
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

          {currentPage === 'my-profile' && (
            <MyProfile organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'people' && (
            <People organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'my-team' && (
            <MyTeam organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'my-groups' && (
            <MyGroups organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'user-settings' && (
            <UserSettings organizationId={config?.organizationId || ''} />
          )}

          {currentPage === 'add-user' && (
            <AddUser />
          )}

          {currentPage !== 'dashboard' && currentPage !== 'settings' && currentPage !== 'users' && currentPage !== 'groups' && currentPage !== 'workspaces' && currentPage !== 'orgUnits' && currentPage !== 'assets' && currentPage !== 'files-assets' && currentPage !== 'email-security' && currentPage !== 'signatures' && currentPage !== 'security-events' && currentPage !== 'audit-logs' && currentPage !== 'console' && currentPage !== 'administrators' && currentPage !== 'my-profile' && currentPage !== 'people' && currentPage !== 'my-team' && currentPage !== 'my-groups' && currentPage !== 'user-settings' && currentPage !== 'orgChart' && currentPage !== 'add-user' && (
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

      {/* View Onboarding Modal for Internal Admins */}
      <ViewOnboarding onComplete={() => {}} />

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

// Main App wrapper with BrowserRouter, LabelsProvider, and ViewProvider
function App() {
  return (
    <BrowserRouter>
      <LabelsProvider>
        <ViewProvider>
          <AppContent />
        </ViewProvider>
      </LabelsProvider>
    </BrowserRouter>
  );
}

export default App;