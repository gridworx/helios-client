import { useState, useEffect } from 'react';
import './Pages.css';

interface Group {
  id: string;
  name: string;
  description: string;
  email: string;
  memberCount: number;
  platform: string;
  type: string;
  createdAt: string;
}

interface GroupsProps {
  tenantId: string;
  customLabel?: string;
}

export function Groups({ tenantId, customLabel }: GroupsProps) {
  const [groups, setGroups] = useState<Group[]>([
    // Mock data for now
    {
      id: '1',
      name: 'Engineering Team',
      description: 'Software development team',
      email: 'engineering@gridworx.io',
      memberCount: 12,
      platform: 'google_workspace',
      type: 'Security',
      createdAt: '2025-01-01'
    },
    {
      id: '2',
      name: 'Sales Team',
      description: 'Sales and business development',
      email: 'sales@gridworx.io',
      memberCount: 8,
      platform: 'google_workspace',
      type: 'Email',
      createdAt: '2025-01-01'
    }
  ]);

  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      google_workspace: { icon: 'G', color: '#4285F4' },
      microsoft_365: { icon: 'M', color: '#0078D4' },
      default: { icon: '?', color: '#666' }
    };
    return icons[platform] || icons.default;
  };

  const filteredGroups = groups.filter(group => {
    const matchesPlatform = filterPlatform === 'all' || group.platform === filterPlatform;
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          group.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p>Manage groups and distribution lists from connected platforms</p>
        </div>
        <button className="btn-primary">
          ➕ Create Group
        </button>
      </div>

      <div className="page-controls">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="all">All Platforms</option>
          <option value="google_workspace">Google Workspace</option>
          <option value="microsoft_365">Microsoft 365</option>
        </select>

        <button className="btn-secondary">
          🔄 Sync Groups
        </button>
      </div>

      <div className="data-grid">
        <div className="grid-header">
          <div className="col-wide">Group Name</div>
          <div className="col-medium">Members</div>
          <div className="col-small">Platform</div>
          <div className="col-small">Type</div>
          <div className="col-medium">Email</div>
          <div className="col-small">Actions</div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <h3>No groups found</h3>
            <p>Start by syncing groups from your connected platforms</p>
          </div>
        ) : (
          <div className="grid-body">
            {filteredGroups.map(group => {
              const platform = getPlatformIcon(group.platform);
              return (
                <div key={group.id} className="grid-row">
                  <div className="col-wide">
                    <div className="item-info">
                      <div className="item-icon">👥</div>
                      <div>
                        <div className="item-name">{group.name}</div>
                        <div className="item-description">{group.description}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-medium">
                    <span className="member-count">{group.memberCount} members</span>
                  </div>
                  <div className="col-small">
                    <div
                      className="platform-badge"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.icon}
                    </div>
                  </div>
                  <div className="col-small">
                    <span className="type-badge">{group.type}</span>
                  </div>
                  <div className="col-medium">
                    <span className="email-text">{group.email}</span>
                  </div>
                  <div className="col-small">
                    <div className="action-buttons">
                      <button className="btn-icon" title="View members">👁️</button>
                      <button className="btn-icon" title="Edit group">✏️</button>
                      <button className="btn-icon danger" title="Delete group">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}