import { useState } from 'react';
import { UserList } from '../components/UserList';
import './Directory.css';

interface DirectoryProps {
  organizationName: string;
  domain: string;
  tenantId: string;
}

export function Directory({ organizationName, domain, tenantId }: DirectoryProps) {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="directory-container">
      <div className="directory-header">
        <h1>Directory</h1>
        <p>Manage users, groups, and organizational units across all connected platforms</p>
      </div>

      <div className="directory-tabs">
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span className="tab-icon">👥</span>
          Users
        </button>
        <button
          className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <span className="tab-icon">👥</span>
          Groups
        </button>
        <button
          className={`tab-button ${activeTab === 'org-units' ? 'active' : ''}`}
          onClick={() => setActiveTab('org-units')}
        >
          <span className="tab-icon">🏢</span>
          Organizational Units
        </button>
        <button
          className={`tab-button ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <span className="tab-icon">💻</span>
          Devices
        </button>
      </div>

      <div className="directory-content">
        {activeTab === 'users' && (
          <UserList tenantId={tenantId} />
        )}

        {activeTab === 'groups' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">👥</div>
            <h2>Groups Management</h2>
            <p>Manage groups synced from Google Workspace, Microsoft 365, and other platforms.</p>
            <p className="coming-soon-label">Coming Soon</p>
          </div>
        )}

        {activeTab === 'org-units' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">🏢</div>
            <h2>Organizational Units</h2>
            <p>Manage organizational structure and hierarchy across platforms.</p>
            <p className="coming-soon-label">Coming Soon</p>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="coming-soon">
            <div className="coming-soon-icon">💻</div>
            <h2>Device Management</h2>
            <p>Manage devices enrolled in your organization's platforms.</p>
            <p className="coming-soon-label">Coming Soon</p>
          </div>
        )}
      </div>
    </div>
  );
}