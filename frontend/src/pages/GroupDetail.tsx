import { useState, useEffect } from 'react';
import './Pages.css';

interface GroupMember {
  id: string;
  email: string;
  role: string;
  type: string;
  status: string;
}

interface GroupDetailProps {
  organizationId: string;
  groupId: string;
  onBack: () => void;
}

export function GroupDetail({ organizationId, groupId, onBack }: GroupDetailProps) {

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    fetchGroupDetails();
    fetchGroupMembers();
  }, [groupId, organizationId]);

  const fetchGroupDetails = async () => {
    try {
      // First get group info from the groups list
      const response = await fetch(
        `http://localhost:3001/api/google-workspace/groups/${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
          }
        }
      );

      const result = await response.json();

      if (result.success && result.data?.groups) {
        const groupData = result.data.groups.find((g: any) => g.id === groupId);
        setGroup(groupData);
      }
    } catch (err: any) {
      console.error('Failed to fetch group details:', err);
      setError(err.message);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3001/api/google-workspace/groups/${groupId}/members?organizationId=${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
          }
        }
      );

      const result = await response.json();

      if (result.success && result.data?.members) {
        setMembers(result.data.members);
      } else {
        setError(result.error || 'Failed to fetch group members');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch group members');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'OWNER': '#dc2626',
      'MANAGER': '#ea580c',
      'MEMBER': '#059669'
    };
    return colors[role] || '#6b7280';
  };

  if (!group && !isLoading) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Group not found</h3>
          <button onClick={onBack} className="btn-secondary">
            ← Back to Groups
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <button
            onClick={onBack}
            className="btn-link"
            style={{ marginBottom: '0.5rem', display: 'block' }}
          >
            ← Back to Groups
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="item-icon" style={{ fontSize: '2rem' }}>👥</div>
            <div>
              <h1>{group?.name || 'Loading...'}</h1>
              <p style={{ margin: '0.25rem 0', color: '#6b7280' }}>
                {group?.email} • {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span className="platform-badge" style={{ backgroundColor: '#4285F4' }}>
                  G
                </span>
                <span className="type-badge">{group?.adminCreated ? 'Admin' : 'User'} Created</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '1rem 0', padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container" style={{ marginTop: '2rem', borderBottom: '2px solid #e5e7eb' }}>
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'members' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'members' ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === 'members' ? '600' : '400',
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          Members ({members.length})
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'settings' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'settings' ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === 'settings' ? '600' : '400',
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          Settings
        </button>
        <button
          className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'activity' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'activity' ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === 'activity' ? '600' : '400',
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content" style={{ marginTop: '2rem' }}>
        {activeTab === 'members' && (
          <div>
            <div className="page-controls" style={{ marginBottom: '1rem' }}>
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search members..."
                />
              </div>
              <button className="btn-primary">
                ➕ Add Member
              </button>
            </div>

            {isLoading ? (
              <div className="loading-spinner">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">👤</span>
                <h3>No members found</h3>
                <p>This group doesn't have any members yet</p>
              </div>
            ) : (
              <div className="data-grid">
                <div className="grid-header">
                  <div className="col-wide">Email</div>
                  <div className="col-medium">Role</div>
                  <div className="col-small">Type</div>
                  <div className="col-small">Status</div>
                  <div className="col-small">Actions</div>
                </div>
                <div className="grid-body">
                  {members.map(member => (
                    <div key={member.id} className="grid-row">
                      <div className="col-wide">
                        <div className="item-info">
                          <div className="item-icon">👤</div>
                          <div>
                            <div className="item-name">{member.email}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-medium">
                        <span
                          className="role-badge"
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: getRoleBadgeColor(member.role) + '20',
                            color: getRoleBadgeColor(member.role)
                          }}
                        >
                          {member.role}
                        </span>
                      </div>
                      <div className="col-small">
                        <span className="type-badge">{member.type}</span>
                      </div>
                      <div className="col-small">
                        <span className="type-badge">{member.status || 'ACTIVE'}</span>
                      </div>
                      <div className="col-small">
                        <button className="btn-icon danger" title="Remove member">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="empty-state">
            <span className="empty-icon">⚙️</span>
            <h3>Group Settings</h3>
            <p>Group settings will be available here</p>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <h3>Group Activity</h3>
            <p>Group activity log will be available here</p>
          </div>
        )}
      </div>
    </div>
  );
}
