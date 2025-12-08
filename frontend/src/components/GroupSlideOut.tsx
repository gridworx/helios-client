import { useState, useEffect } from 'react';
import { X, Users, Info, Settings, Shield, Trash2, RefreshCw, UserPlus, UserMinus, Search, Check, AlertTriangle } from 'lucide-react';
import { useTabPersistence } from '../hooks/useTabPersistence';
import { PlatformIcon } from './ui/PlatformIcon';
import './GroupSlideOut.css';

interface GroupMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  member_type: string;
  is_active: boolean;
  joined_at: string;
}

interface Group {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  email: string | null;
  platform: string;
  group_type: string;
  external_id: string | null;
  external_url: string | null;
  allow_external_members: boolean;
  is_public: boolean;
  is_active: boolean;
  metadata: any;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  synced_at: string | null;
}

interface GroupSlideOutProps {
  groupId: string;
  organizationId: string;
  onClose: () => void;
  onGroupUpdated?: () => void;
}

type TabType = 'overview' | 'members' | 'sync' | 'settings' | 'danger';

export function GroupSlideOut({ groupId, organizationId: _organizationId, onClose, onGroupUpdated }: GroupSlideOutProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabType>('helios_group_slideout_tab', 'overview');
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedGroup, setEditedGroup] = useState<Partial<Group>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Add member modal state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/access-groups/${groupId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch group details');
      }

      const data = await response.json();
      if (data.success) {
        setGroup(data.data.group);
        setMembers(data.data.members || []);
        setEditedGroup(data.data.group);
      } else {
        throw new Error(data.error || 'Failed to fetch group details');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!group) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/access-groups/${groupId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: editedGroup.name,
            description: editedGroup.description,
            email: editedGroup.email
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        setGroup({ ...group, ...editedGroup });
        setIsEditing(false);
        onGroupUpdated?.();
      } else {
        throw new Error(data.error || 'Failed to update group');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedGroup(group || {});
    setIsEditing(false);
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setAvailableUsers([]);
      return;
    }

    setSearchLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/users?search=${encodeURIComponent(query)}&status=active`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter out users who are already members
        const memberIds = new Set(members.map(m => m.user_id));
        const filtered = (data.data || []).filter((u: any) => !memberIds.has(u.id));
        setAvailableUsers(filtered);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (showAddMemberModal) {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, showAddMemberModal]);

  const handleAddMember = async (userId: string) => {
    setAddingUserId(userId);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/access-groups/${groupId}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId, memberType: 'member' })
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchGroupDetails();
        setSearchQuery('');
        setAvailableUsers([]);
        onGroupUpdated?.();
      } else {
        throw new Error(data.error || 'Failed to add member');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this group?`)) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/access-groups/${groupId}/members/${userId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchGroupDetails();
        onGroupUpdated?.();
      } else {
        throw new Error(data.error || 'Failed to remove member');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/organization/access-groups/${groupId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        onGroupUpdated?.();
        onClose();
      } else {
        throw new Error(data.error || 'Failed to delete group');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'google_workspace': return 'Google Workspace';
      case 'microsoft_365': return 'Microsoft 365';
      case 'manual': return 'Manual';
      default: return platform;
    }
  };

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'static': return 'Static';
      case 'dynamic': return 'Dynamic';
      case 'manual': return 'Manual';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="slideout-overlay" onClick={onClose}>
        <div className="slideout-panel group-slideout" onClick={(e) => e.stopPropagation()}>
          <div className="slideout-loading">
            <RefreshCw className="spinning" size={24} />
            <span>Loading group details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="slideout-overlay" onClick={onClose}>
        <div className="slideout-panel group-slideout" onClick={(e) => e.stopPropagation()}>
          <div className="slideout-error">
            <AlertTriangle size={24} />
            <span>{error || 'Group not found'}</span>
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slideout-overlay" onClick={onClose}>
      <div className="slideout-panel group-slideout" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="slideout-header">
          <div className="slideout-group-info">
            <div className="slideout-group-icon">
              <Users size={28} />
            </div>
            <div className="slideout-group-details">
              <h2>{group.name}</h2>
              {group.email && <div className="slideout-email">{group.email}</div>}
              <div className="slideout-badges">
                <span className={`type-badge type-${group.group_type}`}>
                  {getGroupTypeLabel(group.group_type)}
                </span>
                <span className="member-count-badge">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>
          <button className="slideout-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="slideout-tabs">
          <button
            className={`slideout-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Info size={18} className="tab-icon" />
            <span className="tab-label">Overview</span>
          </button>
          <button
            className={`slideout-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={18} className="tab-icon" />
            <span className="tab-label">Members</span>
          </button>
          <button
            className={`slideout-tab ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            <RefreshCw size={18} className="tab-icon" />
            <span className="tab-label">Sync</span>
          </button>
          <button
            className={`slideout-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} className="tab-icon" />
            <span className="tab-label">Settings</span>
          </button>
          <button
            className={`slideout-tab ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveTab('danger')}
          >
            <Shield size={18} className="tab-icon" />
            <span className="tab-label">Danger</span>
          </button>
        </div>

        {/* Content */}
        <div className="slideout-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="tab-header">
                <h3>Group Details</h3>
                {!isEditing ? (
                  <button className="btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="btn-secondary btn-sm" onClick={handleCancelEdit} disabled={isSaving}>
                      Cancel
                    </button>
                    <button className="btn-primary btn-sm" onClick={handleSaveGroup} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className="info-grid">
                <div className="info-item">
                  <label>Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedGroup.name || ''}
                      onChange={(e) => setEditedGroup({ ...editedGroup, name: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    <div>{group.name}</div>
                  )}
                </div>

                <div className="info-item">
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedGroup.email || ''}
                      onChange={(e) => setEditedGroup({ ...editedGroup, email: e.target.value })}
                      className="edit-input"
                      placeholder="group@example.com"
                    />
                  ) : (
                    <div>{group.email || <span className="text-muted">Not set</span>}</div>
                  )}
                </div>

                <div className="info-item full-width">
                  <label>Description</label>
                  {isEditing ? (
                    <textarea
                      value={editedGroup.description || ''}
                      onChange={(e) => setEditedGroup({ ...editedGroup, description: e.target.value })}
                      className="edit-textarea"
                      rows={3}
                      placeholder="Group description..."
                    />
                  ) : (
                    <div>{group.description || <span className="text-muted">No description</span>}</div>
                  )}
                </div>

                <div className="info-item">
                  <label>Platform</label>
                  <div className="platform-indicator">
                    <PlatformIcon
                      platform={group.platform === 'google_workspace' ? 'google' : group.platform === 'microsoft_365' ? 'microsoft' : 'helios'}
                      size={20}
                    />
                    <span>{getPlatformLabel(group.platform)}</span>
                  </div>
                </div>

                <div className="info-item">
                  <label>Group Type</label>
                  <div>
                    <span className={`type-badge type-${group.group_type}`}>
                      {getGroupTypeLabel(group.group_type)}
                    </span>
                  </div>
                </div>

                <div className="info-item">
                  <label>Created</label>
                  <div>{formatDate(group.created_at)}</div>
                </div>

                <div className="info-item">
                  <label>Last Synced</label>
                  <div>{formatDate(group.synced_at)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="tab-content">
              <div className="tab-header">
                <h3>Group Members ({members.length})</h3>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowAddMemberModal(true)}
                >
                  <UserPlus size={14} />
                  Add Member
                </button>
              </div>

              {members.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} strokeWidth={1.5} />
                  <h4>No members yet</h4>
                  <p>Add members to this group to get started</p>
                </div>
              ) : (
                <div className="members-list">
                  {members.map((member) => (
                    <div key={member.id} className="member-item">
                      <div className="member-avatar">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                      <div className="member-info">
                        <div className="member-name">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="member-email">{member.email}</div>
                      </div>
                      <div className="member-type">
                        {member.member_type}
                      </div>
                      <button
                        className="btn-icon danger"
                        title="Remove member"
                        onClick={() => handleRemoveMember(member.user_id, `${member.first_name} ${member.last_name}`)}
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <div className="tab-content">
              <h3>Platform Sync</h3>

              <div className="sync-section">
                <div className="sync-platform">
                  <div className="sync-platform-header">
                    <PlatformIcon platform="google" size={24} />
                    <span>Google Workspace</span>
                  </div>
                  {group.platform === 'google_workspace' ? (
                    <div className="sync-status">
                      <div className="sync-status-row">
                        <span className="status-label">Status:</span>
                        <span className="status-value connected">
                          <Check size={14} />
                          Connected
                        </span>
                      </div>
                      <div className="sync-status-row">
                        <span className="status-label">External ID:</span>
                        <span className="status-value">{group.external_id || 'N/A'}</span>
                      </div>
                      <div className="sync-status-row">
                        <span className="status-label">Last Sync:</span>
                        <span className="status-value">{formatDate(group.synced_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="sync-status">
                      <p className="text-muted">This group is not synced from Google Workspace.</p>
                    </div>
                  )}
                </div>

                <div className="sync-platform">
                  <div className="sync-platform-header">
                    <PlatformIcon platform="microsoft" size={24} />
                    <span>Microsoft 365</span>
                    <span className="coming-soon-badge">Coming Soon</span>
                  </div>
                  <div className="sync-status disabled">
                    <p className="text-muted">Microsoft 365 group sync is not yet available.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="tab-content">
              <h3>Group Settings</h3>

              <div className="settings-grid">
                <div className="setting-item">
                  <div className="setting-header">
                    <label>Allow External Members</label>
                    <span className="setting-description">
                      Allow users outside your organization to join this group
                    </span>
                  </div>
                  <span className={`setting-value ${group.allow_external_members ? 'enabled' : 'disabled'}`}>
                    {group.allow_external_members ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="setting-item">
                  <div className="setting-header">
                    <label>Public Group</label>
                    <span className="setting-description">
                      Anyone in the organization can find and join this group
                    </span>
                  </div>
                  <span className={`setting-value ${group.is_public ? 'enabled' : 'disabled'}`}>
                    {group.is_public ? 'Public' : 'Private'}
                  </span>
                </div>

                <div className="setting-item">
                  <div className="setting-header">
                    <label>Active Status</label>
                    <span className="setting-description">
                      Whether this group is active and functional
                    </span>
                  </div>
                  <span className={`setting-value ${group.is_active ? 'enabled' : 'disabled'}`}>
                    {group.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Danger Tab */}
          {activeTab === 'danger' && (
            <div className="tab-content">
              <h3>Danger Zone</h3>

              <div className="danger-section">
                <div className="danger-item">
                  <div className="danger-info">
                    <h4>Delete Group</h4>
                    <p>
                      Permanently delete this group and remove all member associations.
                      {group.platform === 'google_workspace' && (
                        <strong> This will NOT delete the group in Google Workspace.</strong>
                      )}
                    </p>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={14} />
                    Delete Group
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Member</h3>
                <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                {searchLoading ? (
                  <div className="search-loading">Searching...</div>
                ) : availableUsers.length > 0 ? (
                  <div className="user-search-results">
                    {availableUsers.map((user) => (
                      <div key={user.id} className="user-result-item">
                        <div className="user-result-avatar">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        <div className="user-result-info">
                          <div className="user-result-name">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="user-result-email">{user.email}</div>
                        </div>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleAddMember(user.id)}
                          disabled={addingUserId === user.id}
                        >
                          {addingUserId === user.id ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="no-results">No users found matching "{searchQuery}"</div>
                ) : (
                  <div className="search-hint">Start typing to search for users</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal-content danger-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <AlertTriangle size={24} className="danger-icon" />
                <h3>Delete Group</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{group.name}</strong>?</p>
                <p className="warning-text">
                  This action cannot be undone. All member associations will be removed.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  onClick={handleDeleteGroup}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Group'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
