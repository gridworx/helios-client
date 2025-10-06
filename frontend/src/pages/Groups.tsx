import { useState, useEffect } from 'react';
import { googleWorkspaceService } from '../services/google-workspace.service';
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
  organizationId: string;
  customLabel?: string;
  onSelectGroup?: (groupId: string) => void;
}

export function Groups({ organizationId, customLabel, onSelectGroup }: GroupsProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
  }, [organizationId]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await googleWorkspaceService.getGroups(organizationId);

      if (result.success && result.data?.groups) {
        const formattedGroups = result.data.groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description || '',
          email: group.email,
          memberCount: group.directMembersCount || 0,
          platform: 'google_workspace',
          type: group.adminCreated ? 'Admin' : 'User',
          createdAt: group.createdAt || new Date().toISOString()
        }));
        setGroups(formattedGroups);
      } else {
        setGroups([]);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch groups');
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncGroups = async () => {
    try {
      setIsSyncing(true);
      setError(null);

      const result = await googleWorkspaceService.syncGroups(organizationId);

      if (result.success) {
        await fetchGroups();
      } else {
        setError(result.error || 'Failed to sync groups');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync groups');
    } finally {
      setIsSyncing(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading groups...</div>
      </div>
    );
  }

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

      {error && (
        <div className="error-message" style={{ margin: '1rem 0', padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
          {error}
        </div>
      )}

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

        <button
          className="btn-secondary"
          onClick={handleSyncGroups}
          disabled={isSyncing}
        >
          {isSyncing ? '⏳ Syncing...' : '🔄 Sync Groups'}
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
                <div
                  key={group.id}
                  className="grid-row"
                  onClick={() => onSelectGroup && onSelectGroup(group.id)}
                  style={{ cursor: onSelectGroup ? 'pointer' : 'default' }}
                >
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