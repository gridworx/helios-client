import { useState, useEffect } from 'react';
import { googleWorkspaceService } from '../services/google-workspace.service';
import { useEntityLabels } from '../contexts/LabelsContext';
import { ENTITIES } from '../config/entities';
import { Search, RefreshCw, Plus, Users } from 'lucide-react';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { GroupSlideOut } from '../components/GroupSlideOut';
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

export function Groups({ organizationId, customLabel: _customLabel, onSelectGroup }: GroupsProps) {
  const labels = useEntityLabels(ENTITIES.ACCESS_GROUP);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupEmail, setNewGroupEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [organizationId]);

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from new access_groups API
      const token = localStorage.getItem('helios_token');
      const response = await fetch(`http://localhost:3001/api/organization/access-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Groups API error:', response.status, errorData);
        if (response.status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError(errorData.error || 'Failed to load groups');
        }
        setGroups([]);
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        const formattedGroups = result.data.map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description || '',
          email: group.email,
          memberCount: parseInt(group.member_count) || parseInt(group.metadata?.directMembersCount) || group.directMembersCount || 0,
          platform: group.platform || 'google_workspace',
          type: group.group_type || (group.metadata?.adminCreated ? 'Admin' : 'User'),
          createdAt: group.created_at || group.createdAt || new Date().toISOString()
        }));
        setGroups(formattedGroups);
      } else {
        setGroups([]);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err: any) {
      console.error('Groups fetch error:', err);
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

  const handleCreateGroup = async () => {
    if (!newGroupEmail || !newGroupName) {
      setError('Please provide both email and group name');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3001/api/google-workspace/groups`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('helios_token')}`
          },
          body: JSON.stringify({
            organizationId,
            email: newGroupEmail,
            name: newGroupName,
            description: newGroupDescription
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setShowCreateModal(false);
        setNewGroupEmail('');
        setNewGroupName('');
        setNewGroupDescription('');
        await fetchGroups(); // Refresh groups list
      } else {
        setError(result.error || 'Failed to create group');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
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
          <h1>{labels.plural}</h1>
          <p>Manage groups and distribution lists from connected platforms</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={14} /> Create Group
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '1rem 0', padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div className="page-controls">
        <div className="search-box">
          <Search className="search-icon" size={18} />
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
          <option value="all">All Sources</option>
          <option value="google_workspace">Google Workspace</option>
          <option value="manual">Local Only</option>
        </select>

        <button
          className="btn-secondary"
          onClick={handleSyncGroups}
          disabled={isSyncing}
        >
          <RefreshCw size={14} className={isSyncing ? 'spinning' : ''} />
          {isSyncing ? 'Syncing...' : 'Sync Groups'}
        </button>
      </div>

      <div className="data-grid">
        <div className="grid-header" style={{ gridTemplateColumns: '2fr 1fr 80px 1.5fr' }}>
          <div className="col-wide">Group Name</div>
          <div className="col-medium">Members</div>
          <div className="col-small">Platform</div>
          <div className="col-medium">Email</div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" size={48} strokeWidth={1.5} />
            <h3>No groups found</h3>
            <p>Start by syncing groups from your connected platforms</p>
          </div>
        ) : (
          <div className="grid-body">
            {filteredGroups.map(group => {
              const handleRowClick = () => {
                if (onSelectGroup) {
                  onSelectGroup(group.id);
                } else {
                  setSelectedGroupId(group.id);
                }
              };

              return (
                <div
                  key={group.id}
                  className="grid-row"
                  onClick={handleRowClick}
                  style={{ cursor: 'pointer', gridTemplateColumns: '2fr 1fr 80px 1.5fr' }}
                >
                  <div className="col-wide">
                    <div className="item-info">
                      <Users className="item-icon" size={20} />
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
                    <PlatformIcon
                      platform={group.platform === 'google_workspace' ? 'google' : group.platform === 'microsoft_365' ? 'microsoft' : 'helios'}
                      size={28}
                    />
                  </div>
                  <div className="col-medium">
                    <span className="email-text">{group.email}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create New Group</h2>

            {error && (
              <div className="error-message" style={{ margin: '1rem 0', padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Group Email <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                value={newGroupEmail}
                onChange={(e) => setNewGroupEmail(e.target.value)}
                placeholder="group@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
                disabled={isCreating}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Group Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="My Team"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
                disabled={isCreating}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Description (Optional)
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Group description..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                disabled={isCreating}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewGroupEmail('');
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setError(null);
                }}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateGroup}
                disabled={isCreating || !newGroupEmail || !newGroupName}
              >
                <Plus size={14} />
                {isCreating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group SlideOut */}
      {selectedGroupId && (
        <GroupSlideOut
          groupId={selectedGroupId}
          organizationId={organizationId}
          onClose={() => setSelectedGroupId(null)}
          onGroupUpdated={() => {
            fetchGroups();
          }}
        />
      )}
    </div>
  );
}