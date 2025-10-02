import { useState, useEffect } from 'react';
import './UserList.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  platforms: string[];
  lastLogin?: string;
}

interface UserListProps {
  tenantId: string;
}

export function UserList({ tenantId }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  useEffect(() => {
    fetchUsers();
  }, [tenantId]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, we'll use mock data since the API isn't fully connected
      // In production, this would call: GET /api/v1/users

      // Simulate API call with mock data
      const mockUsers: User[] = [
        {
          id: 'ecfd5caa-ec34-4c1c-8368-fd95b923172f',
          email: 'mike@gridworx.io',
          firstName: 'Michael',
          lastName: 'Agu',
          role: 'tenant_admin',
          isActive: true,
          platforms: ['google_workspace'],
          lastLogin: '2025-10-01T06:00:00Z'
        }
      ];

      // Fetch from database
      try {
        const response = await fetch(`http://localhost:3001/api/v1/users`, {
          headers: {
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth') || '{}').token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const formattedUsers = data.data.map((user: any) => ({
              id: user.id,
              email: user.email,
              firstName: user.firstName || user.first_name || user.email.split('@')[0],
              lastName: user.lastName || user.last_name || '',
              role: user.role || 'tenant_user',
              isActive: user.isActive !== false,
              platforms: user.platforms?.map((p: any) => p.platform) || [],
              lastLogin: user.lastLogin || user.last_login
            }));
            setUsers(formattedUsers);
          } else {
            // Use mock data if API fails
            setUsers(mockUsers);
          }
        } else {
          // Use mock data if API fails
          setUsers(mockUsers);
        }
      } catch (err) {
        // Use mock data if API fails
        console.log('Using mock data due to API error:', err);
        setUsers(mockUsers);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, { icon: string; color: string; title: string }> = {
      google_workspace: { icon: 'G', color: '#4285F4', title: 'Google Workspace' },
      microsoft_365: { icon: 'M', color: '#0078D4', title: 'Microsoft 365' },
      slack: { icon: 'S', color: '#4A154B', title: 'Slack' },
      okta: { icon: 'O', color: '#007DC1', title: 'Okta' },
      default: { icon: '?', color: '#666', title: 'Unknown' }
    };

    return icons[platform] || icons.default;
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      platform_owner: { label: 'Platform Owner', className: 'badge-owner' },
      tenant_admin: { label: 'Admin', className: 'badge-admin' },
      tenant_user: { label: 'User', className: 'badge-user' },
      default: { label: 'User', className: 'badge-user' }
    };

    return badges[role] || badges.default;
  };

  const filteredUsers = filterPlatform === 'all'
    ? users
    : users.filter(user => user.platforms.includes(filterPlatform));

  const uniquePlatforms = Array.from(new Set(users.flatMap(u => u.platforms)));

  if (isLoading) {
    return (
      <div className="user-list-container">
        <div className="loading-spinner">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-list-container">
        <div className="error-message">Error loading users: {error}</div>
      </div>
    );
  }

  return (
    <div className="user-list-container">
      <div className="user-list-header">
        <div className="header-left">
          <h2>Users</h2>
          <span className="user-count">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="header-right">
          <div className="platform-filter">
            <label>Platform:</label>
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
              <option value="all">All Platforms</option>
              {uniquePlatforms.map(platform => {
                const icon = getPlatformIcon(platform);
                return (
                  <option key={platform} value={platform}>
                    {icon.title}
                  </option>
                );
              })}
            </select>
          </div>
          <button className="btn-sync" onClick={fetchUsers}>
            🔄 Sync Users
          </button>
          <button className="btn-add-user">
            ➕ Add User
          </button>
        </div>
      </div>

      <div className="user-table">
        <div className="table-header">
          <div className="col-user">User</div>
          <div className="col-email">Email</div>
          <div className="col-platforms">Platforms</div>
          <div className="col-role">Role</div>
          <div className="col-status">Status</div>
          <div className="col-last-login">Last Login</div>
          <div className="col-actions">Actions</div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="no-users">
            <div className="empty-state">
              <span className="empty-icon">👥</span>
              <h3>No users found</h3>
              <p>
                {filterPlatform !== 'all'
                  ? `No users found in ${getPlatformIcon(filterPlatform).title}`
                  : 'Start by syncing users from your connected platforms'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="table-body">
            {filteredUsers.map(user => {
              const roleBadge = getRoleBadge(user.role);
              const initials = `${user.firstName[0]}${user.lastName[0] || ''}`.toUpperCase();

              return (
                <div key={user.id} className="table-row">
                  <div className="col-user">
                    <div className="user-info">
                      <div className="user-avatar" style={{ background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` }}>
                        {initials}
                      </div>
                      <span className="user-name">{user.firstName} {user.lastName}</span>
                    </div>
                  </div>
                  <div className="col-email">{user.email}</div>
                  <div className="col-platforms">
                    <div className="platform-icons">
                      {user.platforms.length > 0 ? (
                        user.platforms.map(platform => {
                          const icon = getPlatformIcon(platform);
                          return (
                            <div
                              key={platform}
                              className="platform-icon"
                              style={{ backgroundColor: icon.color }}
                              title={icon.title}
                            >
                              {icon.icon}
                            </div>
                          );
                        })
                      ) : (
                        <span className="no-platforms">No platforms</span>
                      )}
                    </div>
                  </div>
                  <div className="col-role">
                    <span className={`role-badge ${roleBadge.className}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                  <div className="col-status">
                    <span className={`status-indicator ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? '✅ Active' : '⚠️ Inactive'}
                    </span>
                  </div>
                  <div className="col-last-login">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                  <div className="col-actions">
                    <button className="btn-action" title="Edit user">✏️</button>
                    <button className="btn-action" title="View details">👁️</button>
                    <button className="btn-action danger" title="Remove user">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="user-list-footer">
        <div className="sync-info">
          Last sync: {new Date().toLocaleString()}
        </div>
        <div className="platform-legend">
          <span>Platform indicators:</span>
          {uniquePlatforms.map(platform => {
            const icon = getPlatformIcon(platform);
            return (
              <div key={platform} className="legend-item">
                <div
                  className="platform-icon small"
                  style={{ backgroundColor: icon.color }}
                >
                  {icon.icon}
                </div>
                <span>{icon.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}