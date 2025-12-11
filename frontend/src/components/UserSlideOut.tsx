import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTabPersistence } from '../hooks/useTabPersistence';
import { ClipboardList, Users, RefreshCw, BarChart3, Settings, Trash2, CheckCircle, AlertTriangle, FileText, PenTool } from 'lucide-react';
import { UserSignatureStatus } from './signatures';
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
  managerId?: string;
  managerName?: string;
}

interface UserSlideOutProps {
  user: User;
  organizationId: string;
  onClose: () => void;
  onUserUpdated?: () => void;
}

type TabType = 'overview' | 'groups' | 'signature' | 'platforms' | 'activity' | 'settings' | 'danger';

export function UserSlideOut({ user, organizationId, onClose, onUserUpdated }: UserSlideOutProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabType>('helios_user_slideout_tab', 'overview');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [googleAction, setGoogleAction] = useState<'keep' | 'suspend' | 'delete'>('delete');
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<User>(user);
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown data for edit mode
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [availableOrgUnits, setAvailableOrgUnits] = useState<any[]>([]);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [selectedNewGroupIds, setSelectedNewGroupIds] = useState<string[]>([]);

  useEffect(() => {
    // Fetch additional data based on active tab
    if (activeTab === 'groups') {
      fetchUserGroups();
    } else if (activeTab === 'activity') {
      fetchActivityLog();
    }
  }, [activeTab, user.id]);

  // Fetch dropdown data when entering edit mode
  useEffect(() => {
    if (isEditing) {
      fetchDropdownData();
    }
  }, [isEditing]);

  const fetchDropdownData = async () => {
    const token = localStorage.getItem('helios_token');

    // Fetch available managers (all active users)
    try {
      const managersResponse = await fetch(
        `/api/v1/organization/users?status=active`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (managersResponse.ok) {
        const managersData = await managersResponse.json();
        setAvailableManagers(managersData.data || []);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }

    // Groups are now fetched when needed in the Groups tab

    // Fetch organizational units from Google Workspace
    try {
      const orgUnitsResponse = await fetch(
        `/api/v1/google-workspace/org-units/${organizationId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (orgUnitsResponse.ok) {
        const orgUnitsData = await orgUnitsResponse.json();
        if (orgUnitsData.success && orgUnitsData.data) {
          setAvailableOrgUnits(orgUnitsData.data);
        }
      }
    } catch (error) {
      console.error('Error fetching org units:', error);
    }
  };

  const fetchUserGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `/api/v1/organization/users/${user.id}/groups`,
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
        `/api/v1/organization/users/${user.id}/activity`,
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

  const handleSaveUser = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `/api/v1/organization/users/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            firstName: editedUser.firstName,
            lastName: editedUser.lastName,
            jobTitle: editedUser.jobTitle,
            department: editedUser.department,
            location: editedUser.location,
            organizationalUnit: editedUser.organizationalUnit,
            mobilePhone: editedUser.mobilePhone,
            workPhone: editedUser.workPhone,
            role: editedUser.role,
            managerId: editedUser.managerId || null
          })
        }
      );

      if (response.ok) {
        alert('User updated successfully');
        setIsEditing(false);
        onUserUpdated?.();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to update user'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to change user status to ${newStatus}?`)) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `/api/v1/organization/users/${user.id}/status`,
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
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `/api/v1/organization/users/${user.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            googleAction: user.googleWorkspaceId ? googleAction : undefined
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'User deleted successfully');
        setShowDeleteModal(false);
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
        `/api/v1/organization/users/${user.id}/restore`,
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

  const handleAddToGroups = async () => {
    if (selectedNewGroupIds.length === 0) {
      alert('Please select at least one group');
      return;
    }

    try {
      const token = localStorage.getItem('helios_token');
      const errors: string[] = [];
      let successCount = 0;

      // Add user to each selected group
      for (const groupId of selectedNewGroupIds) {
        try {
          const response = await fetch(
            `/api/v1/organization/access-groups/${groupId}/members`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: user.id,
                memberType: 'member'
              })
            }
          );

          if (response.ok) {
            successCount++;
          } else {
            const data = await response.json();
            const groupName = availableGroups.find(g => g.id === groupId)?.name || groupId;
            errors.push(`${groupName}: ${data.error || 'Failed'}`);
          }
        } catch (error: any) {
          const groupName = availableGroups.find(g => g.id === groupId)?.name || groupId;
          errors.push(`${groupName}: ${error.message}`);
        }
      }

      // Refresh groups list
      await fetchUserGroups();

      // Show results
      if (successCount > 0 && errors.length === 0) {
        // All successful
        setShowAddGroupModal(false);
        setSelectedNewGroupIds([]);
      } else if (successCount > 0 && errors.length > 0) {
        // Partial success
        alert(`Added to ${successCount} group(s). Errors:\n${errors.join('\n')}`);
        setShowAddGroupModal(false);
        setSelectedNewGroupIds([]);
      } else {
        // All failed
        alert(`Failed to add to groups:\n${errors.join('\n')}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRemoveFromGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to remove this user from the group?')) return;

    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `/api/v1/organization/access-groups/${groupId}/members/${user.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Refresh groups list
        await fetchUserGroups();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to remove user from group'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };


  const getStatusBadgeClass = (status?: string) => {
    if (status === 'active') return 'status-badge-active';
    if (status === 'pending') return 'status-badge-pending';
    if (status === 'deleted') return 'status-badge-deleted';
    return 'status-badge-active';
  };

  const tabs: { id: TabType; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <ClipboardList size={16} /> },
    { id: 'groups', label: 'Groups', icon: <Users size={16} /> },
    { id: 'signature', label: 'Signature', icon: <PenTool size={16} /> },
    { id: 'platforms', label: 'Account Sync', icon: <RefreshCw size={16} /> },
    { id: 'activity', label: 'Activity', icon: <BarChart3 size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
    { id: 'danger', label: 'Danger Zone', icon: <Trash2 size={16} /> }
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>User Information</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--theme-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Edit User
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveUser}
                      disabled={isSaving}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.5 : 1
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="info-grid">
                <div className="info-item">
                  <label>First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.firstName}
                      onChange={(e) => setEditedUser({ ...editedUser, firstName: e.target.value })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  ) : (
                    <div>{user.firstName}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.lastName}
                      onChange={(e) => setEditedUser({ ...editedUser, lastName: e.target.value })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    />
                  ) : (
                    <div>{user.lastName}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <div>{user.email}</div>
                </div>
                <div className="info-item">
                  <label>Role</label>
                  {isEditing ? (
                    <select
                      value={editedUser.role}
                      onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="user">User</option>
                    </select>
                  ) : (
                    <div>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role}
                      </span>
                    </div>
                  )}
                </div>
                <div className="info-item">
                  <label>Status</label>
                  <div>
                    <span className={`status-indicator ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? <><CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Active</> : <><AlertTriangle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Inactive</>}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <label>Last Login</label>
                  <div>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</div>
                </div>
              </div>

              {(isEditing || user.jobTitle || user.department || user.location || user.organizationalUnit) && (
                <>
                  <h3>Profile Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Job Title</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedUser.jobTitle || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, jobTitle: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        <div>{user.jobTitle || '-'}</div>
                      )}
                    </div>
                    <div className="info-item">
                      <label>Department</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedUser.department || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, department: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        <div>{user.department || '-'}</div>
                      )}
                    </div>
                    <div className="info-item">
                      <label>Reporting Manager</label>
                      {isEditing ? (
                        <select
                          value={editedUser.managerId || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, managerId: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                          <option value="">No Manager</option>
                          {availableManagers
                            .filter(m => m.id !== user.id) // Don't allow self as manager
                            .map(manager => (
                              <option key={manager.id} value={manager.id}>
                                {manager.first_name || manager.firstName} {manager.last_name || manager.lastName} ({manager.email})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <div>{user.managerName || '-'}</div>
                      )}
                    </div>
                    <div className="info-item">
                      <label>Location</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedUser.location || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, location: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        <div>{user.location || '-'}</div>
                      )}
                    </div>
                    <div className="info-item">
                      <label>Organizational Unit</label>
                      {isEditing ? (
                        <select
                          value={editedUser.organizationalUnit || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, organizationalUnit: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                          <option value="">Select Org Unit...</option>
                          {availableOrgUnits.map(ou => (
                            <option key={ou.id} value={ou.path}>
                              {ou.path}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>{user.organizationalUnit || '-'}</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(isEditing || user.mobilePhone || user.workPhone) && (
                <>
                  <h3>Contact Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Mobile Phone</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedUser.mobilePhone || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, mobilePhone: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        <div>{user.mobilePhone || '-'}</div>
                      )}
                    </div>
                    <div className="info-item">
                      <label>Work Phone</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedUser.workPhone || ''}
                          onChange={(e) => setEditedUser({ ...editedUser, workPhone: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                      ) : (
                        <div>{user.workPhone || '-'}</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && activeTab === 'groups' && (
            <div className="tab-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Group Memberships</h3>
                <button
                  className="btn-primary"
                  onClick={() => {
                    // Fetch available groups if not already loaded
                    if (availableGroups.length === 0) {
                      const token = localStorage.getItem('helios_token');
                      fetch(`/api/v1/organization/access-groups`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      }).then(res => res.json()).then(data => {
                        if (data.success) setAvailableGroups(data.data || []);
                      });
                    }
                    setShowAddGroupModal(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--theme-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  + Add to Group
                </button>
              </div>

              {groups.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <p>This user is not a member of any groups yet.</p>
                </div>
              ) : (
                <div className="groups-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groups.map(group => (
                    <div key={group.id} className="group-item" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div className="group-info">
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{group.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{group.email || group.description}</div>
                      </div>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => handleRemoveFromGroup(group.id)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: 'white',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'signature' && (
            <div className="tab-content">
              <h3>Email Signature</h3>
              <p className="section-description">
                View and manage this user's email signature status.
              </p>
              <UserSignatureStatus
                userId={user.id}
                userName={`${user.firstName} ${user.lastName}`}
                userEmail={user.email}
                showPreview={true}
                onSyncComplete={() => {
                  // Optionally refresh user data after sync
                  onUserUpdated?.();
                }}
              />
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
                      <div className="activity-icon"><FileText size={16} /></div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete User: {user.firstName} {user.lastName}</h2>

            {user.googleWorkspaceId ? (
              <>
                <p>This user is synced from Google Workspace.</p>
                <p><strong>What should happen in Google Workspace?</strong></p>

                <div className="delete-options">
                  <label className={`delete-option ${googleAction === 'keep' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="googleAction"
                      value="keep"
                      checked={googleAction === 'keep'}
                      onChange={(e) => setGoogleAction(e.target.value as 'keep')}
                    />
                    <div className="option-content">
                      <strong>Keep Google account active</strong>
                      <p>User can still access Gmail, Drive, Calendar. You will continue to be billed.</p>
                    </div>
                  </label>

                  <label className={`delete-option ${googleAction === 'suspend' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="googleAction"
                      value="suspend"
                      checked={googleAction === 'suspend'}
                      onChange={(e) => setGoogleAction(e.target.value as 'suspend')}
                    />
                    <div className="option-content">
                      <strong>Suspend Google account</strong>
                      <p className="warning-text">User cannot login BUT you are STILL billed for this license!</p>
                    </div>
                  </label>

                  <label className={`delete-option ${googleAction === 'delete' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="googleAction"
                      value="delete"
                      checked={googleAction === 'delete'}
                      onChange={(e) => setGoogleAction(e.target.value as 'delete')}
                    />
                    <div className="option-content">
                      <strong>Permanently delete from Google Workspace (Recommended)</strong>
                      <p className="success-text">License will be freed immediately.</p>
                      <p className="warning-text">All data will be permanently deleted.</p>
                    </div>
                  </label>
                </div>

                {googleAction === 'delete' && (
                  <div className="warning-box">
                    <p><strong>Warning:</strong> Permanent deletion cannot be undone. Consider transferring important data first.</p>
                  </div>
                )}
              </>
            ) : (
              <p>This will soft-delete the user in Helios. They can be restored within 30 days.</p>
            )}

            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDelete}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Groups Modal */}
      {showAddGroupModal && (
        <div className="modal-overlay" onClick={() => setShowAddGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Add to Groups</h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Select groups to add {user.firstName} {user.lastName} to:
                </label>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {selectedNewGroupIds.length > 0 && (
                    <span>{selectedNewGroupIds.length} group(s) selected</span>
                  )}
                </div>
              </div>

              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: 'white'
              }}>
                {availableGroups.filter(g => !groups.some(ug => ug.id === g.id)).length === 0 ? (
                  <p style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                    User is already a member of all available groups.
                  </p>
                ) : (
                  availableGroups
                    .filter(g => !groups.some(ug => ug.id === g.id)) // Filter out groups user is already in
                    .map(group => (
                      <label
                        key={group.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: '12px 16px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          backgroundColor: selectedNewGroupIds.includes(group.id) ? '#f5f3ff' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (!selectedNewGroupIds.includes(group.id)) {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selectedNewGroupIds.includes(group.id)) {
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNewGroupIds.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNewGroupIds([...selectedNewGroupIds, group.id]);
                            } else {
                              setSelectedNewGroupIds(selectedNewGroupIds.filter(id => id !== group.id));
                            }
                          }}
                          style={{ marginRight: '12px', marginTop: '2px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '2px' }}>
                            {group.name}
                          </div>
                          {group.description && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {group.description}
                            </div>
                          )}
                          {group.member_count !== undefined && (
                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                              {group.member_count} current member(s)
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddGroupModal(false);
                  setSelectedNewGroupIds([]);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAddToGroups}
                disabled={selectedNewGroupIds.length === 0}
                style={{
                  opacity: selectedNewGroupIds.length === 0 ? 0.5 : 1,
                  cursor: selectedNewGroupIds.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Add to {selectedNewGroupIds.length > 0 ? `${selectedNewGroupIds.length} ` : ''}Group{selectedNewGroupIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
