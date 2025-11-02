import { useState, useEffect } from 'react';
import { useTabPersistence } from '../hooks/useTabPersistence';
import './UserSlideOut.css';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  platforms: string[];
  lastLogin?: string;
  jobTitle?: string;
  department?: string;
  organizationalUnit?: string;
  location?: string;
  mobilePhone?: string;
  workPhone?: string;
  avatarUrl?: string;
  googleWorkspaceId?: string;
  microsoft365Id?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserSlideOutProps {
  user: User;
  organizationId: string;
  onClose: () => void;
  onUserUpdated?: () => void;
}

type TabType = 'overview' | 'groups' | 'platforms' | 'activity' | 'settings' | 'danger';

export function UserSlideOut({ user, organizationId, onClose, onUserUpdated }: UserSlideOutProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabType>('helios_user_slideout_tab', 'overview');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  useEffect(() => {
    // Fetch additional data based on active tab
    if (activeTab === 'groups') {
      fetchUserGroups();
    } else if (activeTab === 'activity') {
      fetchActivityLog();
    }
  }, [activeTab, user.id]);

  const fetchUserGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users/${user.id}/groups`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setGroups(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLog = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users/${user.id}/activity`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setActivityLog(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to change user status to ${newStatus}?`)) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users/${user.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        alert('User status updated successfully');
        onUserUpdated?.();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to update status'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?\n\nThis will soft-delete the user (can be restored within 30 days).`)) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users/${user.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        alert('User deleted successfully');
        onUserUpdated?.();
        onClose();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to delete user'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRestoreUser = async () => {
    if (!confirm(`Are you sure you want to restore ${user.firstName} ${user.lastName}?`)) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users/${user.id}/restore`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        alert('User restored successfully');
        onUserUpdated?.();
        onClose();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to restore user'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, { icon: string; color: string; title: string }> = {
      google_workspace: { icon: 'G', color: '#4285F4', title: 'Google Workspace' },
      microsoft_365: { icon: 'M', color: '#0078D4', title: 'Microsoft 365' },
      local: { icon: 'L', color: '#28a745', title: 'Local User' }
    };
    return icons[platform] || icons.local;
  };

  const getStatusBadgeClass = (status?: string) => {
    if (status === 'active') return 'status-badge-active';
    if (status === 'pending') return 'status-badge-pending';
    if (status === 'deleted') return 'status-badge-deleted';
    return 'status-badge-active';
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'groups', label: 'Groups', icon: '👥' },
    { id: 'platforms', label: 'Account Sync', icon: '🔄' },
    { id: 'activity', label: 'Activity', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'danger', label: 'Danger Zone', icon: '🗑️' }
  ];

  return (
    <div className="slideout-overlay" onClick={onClose}>
      <div className="slideout-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="slideout-header">
          <div className="slideout-user-info">
            <div className="slideout-avatar">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
              ) : (
                <span>{user.firstName[0]}{user.lastName[0]}</span>
              )}
            </div>
            <div>
              <h2>{user.firstName} {user.lastName}</h2>
              <p className="slideout-email">{user.email}</p>
              <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>
                {user.status || 'active'}
              </span>
            </div>
          </div>
          <button className="slideout-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="slideout-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`slideout-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="slideout-content">
          {loading && <div className="loading-spinner">Loading...</div>}

          {!loading && activeTab === 'overview' && (
            <div className="tab-content">
              <h3>User Information</h3>

              <div className="info-grid">
                <div className="info-item">
                  <label>Email</label>
                  <div>{user.email}</div>
                </div>
                <div className="info-item">
                  <label>Role</label>
                  <div>
                    <span className={`role-badge role-${user.role}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <label>Status</label>
                  <div>
                    <span className={`status-indicator ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? '✅ Active' : '⚠️ Inactive'}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <label>Last Login</label>
                  <div>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</div>
                </div>
              </div>

              {(user.jobTitle || user.department || user.location || user.organizationalUnit) && (
                <>
                  <h3>Profile Information</h3>
                  <div className="info-grid">
                    {user.jobTitle && (
                      <div className="info-item">
                        <label>Job Title</label>
                        <div>{user.jobTitle}</div>
                      </div>
                    )}
                    {user.department && (
                      <div className="info-item">
                        <label>Department</label>
                        <div>{user.department}</div>
                      </div>
                    )}
                    {user.location && (
                      <div className="info-item">
                        <label>Location</label>
                        <div>{user.location}</div>
                      </div>
                    )}
                    {user.organizationalUnit && (
                      <div className="info-item">
                        <label>Organizational Unit</label>
                        <div>{user.organizationalUnit}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(user.mobilePhone || user.workPhone) && (
                <>
                  <h3>Contact Information</h3>
                  <div className="info-grid">
                    {user.mobilePhone && (
                      <div className="info-item">
                        <label>Mobile Phone</label>
                        <div>{user.mobilePhone}</div>
                      </div>
                    )}
                    {user.workPhone && (
                      <div className="info-item">
                        <label>Work Phone</label>
                        <div>{user.workPhone}</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && activeTab === 'groups' && (
            <div className="tab-content">
              <h3>Group Memberships</h3>
              {groups.length === 0 ? (
                <div className="empty-state">
                  <p>This user is not a member of any groups yet.</p>
                  <button className="btn-primary">Add to Group</button>
                </div>
              ) : (
                <div className="groups-list">
                  {groups.map(group => (
                    <div key={group.id} className="group-item">
                      <div className="group-info">
                        <strong>{group.name}</strong>
                        <span className="group-email">{group.email}</span>
                      </div>
                      <button className="btn-secondary btn-sm">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'platforms' && (
            <div className="tab-content">
              <h3>Google Workspace Sync</h3>
              <p className="section-description">
                View this user's synchronization status with Google Workspace.
              </p>

              <div className="platforms-list">
                {/* Google Workspace Integration */}
                <div className="platform-card">
                  <div className="platform-header">
                    <div className="platform-icon" style={{ backgroundColor: '#4285F4' }}>
                      G
                    </div>
                    <div className="platform-info">
                      <h4>Google Workspace</h4>
                      {user.googleWorkspaceId ? (
                        <span className="sync-status connected">
                          <span className="status-dot"></span>
                          Synced from Google
                        </span>
                      ) : (
                        <span className="sync-status not-connected">
                          <span className="status-dot"></span>
                          Local User Only
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="platform-details">
                    {user.googleWorkspaceId ? (
                      <div className="sync-info">
                        <div className="info-row">
                          <label>Google Workspace ID:</label>
                          <code>{user.googleWorkspaceId}</code>
                        </div>
                        <div className="info-row">
                          <label>Sync Source:</label>
                          <span>Imported from Google Workspace</span>
                        </div>
                        {user.updatedAt && (
                          <div className="info-row">
                            <label>Last updated:</label>
                            <span>{new Date(user.updatedAt).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="sync-notice" style={{ marginTop: '12px' }}>
                          <span className="notice-icon">ℹ️</span>
                          <div>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                              This user is managed by Google Workspace. Changes to core attributes (name, email)
                              must be made in Google Admin Console.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="platform-info-box">
                        <p className="help-text" style={{ marginBottom: '12px' }}>
                          This user was created locally in Helios and does not exist in Google Workspace.
                        </p>
                        <div className="sync-notice">
                          <span className="notice-icon">ℹ️</span>
                          <div>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                              To create this user in Google Workspace, use the Google Admin Console.
                              The next sync will automatically link the accounts.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'activity' && (
            <div className="tab-content">
              <h3>Activity Log</h3>
              {activityLog.length === 0 ? (
                <div className="empty-state">
                  <p>No recent activity to display.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-icon">📝</div>
                      <div className="activity-details">
                        <strong>{activity.description || activity.action.replace(/_/g, ' ')}</strong>
                        <span className="activity-time">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                        {activity.actorEmail && (
                          <p className="activity-actor">
                            by {activity.actorFirstName} {activity.actorLastName} ({activity.actorEmail})
                          </p>
                        )}
                        {activity.ipAddress && (
                          <span className="activity-ip">IP: {activity.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'settings' && (
            <div className="tab-content">
              <h3>User Settings</h3>

              <div className="settings-section">
                <h4>Status Management</h4>
                <div className="setting-item">
                  <label>User Status</label>
                  <select
                    value={user.status || 'active'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="form-select"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="settings-section">
                <h4>Role Management</h4>
                <div className="setting-item">
                  <label>User Role</label>
                  <select
                    value={user.role}
                    className="form-select"
                    disabled
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="setting-hint">Role changes coming soon</p>
                </div>
              </div>

              <div className="settings-section">
                <h4>Password</h4>
                <button className="btn-secondary">Send Password Reset Email</button>
              </div>
            </div>
          )}

          {!loading && activeTab === 'danger' && (
            <div className="tab-content">
              <h3>Danger Zone</h3>

              <div className="danger-section">
                <div className="danger-item">
                  <div>
                    <h4>Delete User</h4>
                    <p>Soft delete this user. They can be restored within 30 days.</p>
                  </div>
                  <button className="btn-danger" onClick={handleDeleteUser}>
                    Delete User
                  </button>
                </div>

                {user.status === 'deleted' && (
                  <div className="danger-item">
                    <div>
                      <h4>Restore User</h4>
                      <p>Restore this deleted user and reactivate their account.</p>
                    </div>
                    <button className="btn-primary" onClick={handleRestoreUser}>
                      Restore User
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
