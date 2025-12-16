import React from 'react';
import {
  Home,
  Users as UsersIcon,
  UsersRound,
  Package,
  Shield,
  PenTool,
  AlertCircle,
  Zap,
  TrendingUp,
  Settings as SettingsIcon,
  Network,
  MessageSquare,
  ClipboardList,
  Image,
  UserPlus,
  UserMinus,
  Clock,
  BarChart2,
  Share2,
} from 'lucide-react';
import { useLabels } from '../../contexts/LabelsContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { ENTITIES } from '../../config/entities';

interface AdminNavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  sidebarCollapsed: boolean;
  labelsLoading: boolean;
}

/**
 * Admin Console Navigation
 *
 * Shows admin-only features:
 * - Dashboard (admin stats)
 * - Directory (Users, Groups, Devices)
 * - Security (Email Security, Signatures, Security Events)
 * - Automation (Workflows, Templates)
 * - Insights (Reports, Analytics)
 * - Settings
 */
export const AdminNavigation: React.FC<AdminNavigationProps> = ({
  currentPage,
  onNavigate,
  sidebarCollapsed: _sidebarCollapsed,
  labelsLoading,
}) => {
  const { labels, isEntityAvailable } = useLabels();
  const { isEnabled } = useFeatureFlags();

  return (
    <nav className="nav">
      <button
        className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
        onClick={() => onNavigate('dashboard')}
        data-testid="nav-admin-dashboard"
      >
        <Home size={16} className="nav-icon" />
        <span>Dashboard</span>
      </button>

      <div className="nav-section" data-labels-loaded={labelsLoading ? 'false' : 'true'}>
        <div className="nav-section-title">Directory</div>

        {/* Users - Always available (core entity) */}
        <button
          className={`nav-item ${currentPage === 'users' ? 'active' : ''}`}
          onClick={() => onNavigate('users')}
          data-testid="nav-users"
        >
          <UsersIcon size={16} className="nav-icon" />
          <span>{labels[ENTITIES.USER]?.plural || 'Users'}</span>
        </button>

        {/* Access Groups - Only if GWS or M365 enabled */}
        {isEntityAvailable(ENTITIES.ACCESS_GROUP) && (
          <button
            className={`nav-item ${currentPage === 'groups' ? 'active' : ''}`}
            onClick={() => onNavigate('groups')}
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
            onClick={() => onNavigate('workspaces')}
            data-testid="nav-workspaces"
          >
            <MessageSquare size={16} className="nav-icon" />
            <span>{labels[ENTITIES.WORKSPACE]?.plural || 'Teams'}</span>
          </button>
        )}

        {/* Org Chart - Shows manager relationships */}
        <button
          className={`nav-item ${currentPage === 'orgChart' ? 'active' : ''}`}
          onClick={() => onNavigate('orgChart')}
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
          onClick={() => onNavigate('assets')}
          data-testid="nav-assets"
        >
          <Package size={16} className="nav-icon" />
          <span>IT Assets</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'files-assets' ? 'active' : ''}`}
          onClick={() => onNavigate('files-assets')}
          data-testid="nav-files-assets"
        >
          <Image size={16} className="nav-icon" />
          <span>Media Files</span>
        </button>
      </div>

      <div className="nav-section">
        <div className="nav-section-title">Security</div>
        <button
          className={`nav-item ${currentPage === 'email-security' ? 'active' : ''}`}
          onClick={() => onNavigate('email-security')}
          data-testid="nav-email-security"
        >
          <Shield size={16} className="nav-icon" />
          <span>Email Security</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'signatures' ? 'active' : ''}`}
          onClick={() => onNavigate('signatures')}
          data-testid="nav-signatures"
        >
          <PenTool size={16} className="nav-icon" />
          <span>Signatures</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'security-events' ? 'active' : ''}`}
          onClick={() => onNavigate('security-events')}
          data-testid="nav-security-events"
        >
          <AlertCircle size={16} className="nav-icon" />
          <span>Security Events</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'audit-logs' ? 'active' : ''}`}
          onClick={() => onNavigate('audit-logs')}
          data-testid="nav-audit-logs"
        >
          <ClipboardList size={16} className="nav-icon" />
          <span>Audit Logs</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'external-sharing' ? 'active' : ''}`}
          onClick={() => onNavigate('external-sharing')}
          data-testid="nav-external-sharing"
        >
          <Share2 size={16} className="nav-icon" />
          <span>External Sharing</span>
        </button>
      </div>

      <div className="nav-section">
        <div className="nav-section-title">Automation</div>
        <button
          className={`nav-item ${currentPage === 'onboarding-templates' ? 'active' : ''}`}
          onClick={() => onNavigate('onboarding-templates')}
          data-testid="nav-onboarding-templates"
        >
          <UserPlus size={16} className="nav-icon" />
          <span>Onboarding</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'offboarding-templates' ? 'active' : ''}`}
          onClick={() => onNavigate('offboarding-templates')}
          data-testid="nav-offboarding-templates"
        >
          <UserMinus size={16} className="nav-icon" />
          <span>Offboarding</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'scheduled-actions' ? 'active' : ''}`}
          onClick={() => onNavigate('scheduled-actions')}
          data-testid="nav-scheduled-actions"
        >
          <Clock size={16} className="nav-icon" />
          <span>Scheduled Actions</span>
        </button>
        {/* Workflows - Only shown if feature flag enabled */}
        {isEnabled('nav.workflows') && (
          <button className="nav-item" data-testid="nav-workflows">
            <span className="nav-icon"><Zap size={16} /></span>
            <span>Workflows</span>
          </button>
        )}
      </div>

      <div className="nav-section">
        <div className="nav-section-title">Insights</div>
        {/* Team Analytics - Only shown if feature flag enabled */}
        {isEnabled('insights.team_analytics') && (
          <button
            className={`nav-item ${currentPage === 'team-analytics' ? 'active' : ''}`}
            onClick={() => onNavigate('team-analytics')}
            data-testid="nav-team-analytics"
          >
            <BarChart2 size={16} className="nav-icon" />
            <span>Team Analytics</span>
          </button>
        )}
        {/* Reports - Only shown if feature flag enabled */}
        {isEnabled('nav.reports') && (
          <button className="nav-item" data-testid="nav-reports">
            <span className="nav-icon"><TrendingUp size={16} /></span>
            <span>Reports</span>
          </button>
        )}
      </div>

      <button
        className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
        data-testid="nav-settings"
      >
        <SettingsIcon size={16} className="nav-icon" />
        <span>Settings</span>
      </button>
    </nav>
  );
};

export default AdminNavigation;
