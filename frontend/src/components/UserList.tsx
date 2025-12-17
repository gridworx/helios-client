import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserList.css';
import { UserSlideOut } from './UserSlideOut';
import { MoreVertical, Eye, PauseCircle, PlayCircle, Lock, Copy, Trash2, CheckCircle, Users, RefreshCw, UserPlus, Loader, Mail, Key, UserMinus } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
// UserAvatar removed - showing name only in table for cleaner layout

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  platforms: string[];
  lastLogin?: string;
  // Extended fields
  jobTitle?: string;
  department?: string;
  organizationalUnit?: string;
  location?: string;
  reportingManagerId?: string;
  employeeId?: string;
  employeeType?: string;
  costCenter?: string;
  startDate?: string;
  endDate?: string;
  bio?: string;
  mobilePhone?: string;
  workPhone?: string;
  workPhoneExtension?: string;
  timezone?: string;
  preferredLanguage?: string;
  googleWorkspaceId?: string;
  microsoft365Id?: string;
  githubUsername?: string;
  slackUserId?: string;
  jumpcloudUserId?: string;
  associateId?: string;
  avatarUrl?: string;
  googleWorkspaceSyncStatus?: string;
  googleWorkspaceLastSync?: string;
  microsoft365SyncStatus?: string;
  microsoft365LastSync?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  source?: string;
  // User type system fields
  userType?: 'staff' | 'guest' | 'contact';
  isGuest?: boolean;
  guestExpiresAt?: string;
  guestInvitedBy?: string;
  guestInvitedAt?: string;
  // Contact-specific fields
  company?: string;
  contactTags?: string[];
  addedBy?: string;
  addedAt?: string;
}

interface UserListProps {
  organizationId: string;
  userType: 'staff' | 'guests' | 'contacts';
  onCountChange?: () => void;
  searchQuery?: string;
  statusFilter?: string;
  platformFilter?: string;
  onStatusCountsChange?: (counts: any) => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function UserList({ organizationId, userType, onCountChange, searchQuery = '', statusFilter, platformFilter = 'all', onStatusCountsChange, onNavigate }: UserListProps) {
  // Component for managing organization users
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [passwordMethod, setPasswordMethod] = useState<'email_link' | 'admin_set'>('email_link');
  const [alternateEmail, setAlternateEmail] = useState('');
  const [expiryHours, setExpiryHours] = useState('48');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [_showEditModal, _setShowEditModal] = useState(false);
  const [_userToEdit, _setUserToEdit] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [googleAction, setGoogleAction] = useState<'keep' | 'suspend' | 'delete'>('delete');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchUsers();
  }, [organizationId, userType, statusFilter, platformFilter]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [statusFilter, searchQuery, userType, platformFilter]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, we'll use mock data since the API isn't fully connected
      // In production, this would call: GET /api/v1/users

      // Mock data removed - using real data from API

      // Fetch from database with user type filter
      try {
        const token = localStorage.getItem('helios_token');

        // Convert plural userType to singular for API
        // UI uses: staff, guests, contacts
        // API expects: staff, guest, contact
        const apiUserType = userType === 'guests' ? 'guest' : userType === 'contacts' ? 'contact' : userType;

        // First, fetch ALL users for this type to calculate status counts accurately
        const allUsersParams = new URLSearchParams({
          userType: apiUserType,
          includeDeleted: 'true'  // Include deleted users for accurate counts
        });

        const allUsersResponse = await fetch(`/api/v1/organization/users?${allUsersParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        let allUsersForCounts = [];
        if (allUsersResponse.ok) {
          const allData = await allUsersResponse.json();
          if (allData.success && allData.data) {
            allUsersForCounts = allData.data;
          }
        }

        // Calculate status counts from ALL users (not filtered)
        const counts = {
          all: allUsersForCounts.length,
          active: allUsersForCounts.filter((u: any) => u.userStatus === 'active').length,
          pending: allUsersForCounts.filter((u: any) => u.userStatus === 'staged').length,
          suspended: allUsersForCounts.filter((u: any) => u.userStatus === 'suspended').length,
          expired: allUsersForCounts.filter((u: any) => u.userStatus === 'expired').length,
          deleted: allUsersForCounts.filter((u: any) => u.userStatus === 'deleted').length
        };

        if (onStatusCountsChange) {
          onStatusCountsChange(counts);
        }

        // Now fetch filtered users for display
        const queryParams = new URLSearchParams({
          userType: apiUserType
        });

        // Add status filter if provided
        if (statusFilter && statusFilter !== 'all') {
          queryParams.append('status', statusFilter);
        }

        // Add platform filter if provided
        if (platformFilter && platformFilter !== 'all') {
          queryParams.append('platform', platformFilter);
        }

        const response = await fetch(`/api/v1/organization/users?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${token}`
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
              platforms: user.platforms || ['local'], // Default to local if no platforms
              lastLogin: user.lastLogin || user.last_login,
              // Extended fields
              jobTitle: user.jobTitle || user.job_title,
              department: user.department,
              organizationalUnit: user.organizationalUnit || user.organizational_unit,
              location: user.location,
              reportingManagerId: user.reportingManagerId || user.reporting_manager_id,
              employeeId: user.employeeId || user.employee_id,
              employeeType: user.employeeType || user.employee_type,
              costCenter: user.costCenter || user.cost_center,
              startDate: user.startDate || user.start_date,
              endDate: user.endDate || user.end_date,
              bio: user.bio,
              mobilePhone: user.mobilePhone || user.mobile_phone,
              workPhone: user.workPhone || user.work_phone,
              workPhoneExtension: user.workPhoneExtension || user.work_phone_extension,
              timezone: user.timezone,
              preferredLanguage: user.preferredLanguage || user.preferred_language,
              googleWorkspaceId: user.googleWorkspaceId || user.google_workspace_id,
              microsoft365Id: user.microsoft365Id || user.microsoft_365_id,
              githubUsername: user.githubUsername || user.github_username,
              slackUserId: user.slackUserId || user.slack_user_id,
              jumpcloudUserId: user.jumpcloudUserId || user.jumpcloud_user_id,
              associateId: user.associateId || user.associate_id,
              avatarUrl: user.avatarUrl || user.avatar_url,
              googleWorkspaceSyncStatus: user.googleWorkspaceSyncStatus || user.google_workspace_sync_status,
              googleWorkspaceLastSync: user.googleWorkspaceLastSync || user.google_workspace_last_sync,
              microsoft365SyncStatus: user.microsoft365SyncStatus || user.microsoft_365_sync_status,
              microsoft365LastSync: user.microsoft365LastSync || user.microsoft_365_last_sync,
              createdAt: user.createdAt || user.created_at,
              updatedAt: user.updatedAt || user.updated_at,
              status: user.userStatus || (user.isActive ? "active" : "inactive"),
              source: user.source,
              // User type fields
              userType: user.userType || user.user_type,
              isGuest: user.isGuest || user.is_guest,
              guestExpiresAt: user.guestExpiresAt || user.guest_expires_at,
              guestInvitedBy: user.guestInvitedBy || user.guest_invited_by,
              guestInvitedAt: user.guestInvitedAt || user.guest_invited_at,
              // Contact-specific fields
              company: user.company,
              contactTags: user.contactTags || user.contact_tags,
              addedBy: user.addedBy || user.added_by,
              addedAt: user.addedAt || user.added_at
            }));
            setUsers(formattedUsers);
            // Call onCountChange callback to update tab counts
            if (onCountChange) {
              onCountChange();
            }
          } else {
            // API returned no data
            setUsers([]);
          }
        } else {
          // API call failed - check for authentication errors
          const errorData = await response.json().catch(() => ({}));
          console.error('Users API error:', response.status, errorData);
          if (response.status === 401) {
            setError('Session expired. Please log in again.');
          } else {
            setError(errorData.error || 'Failed to load users');
          }
          setUsers([]);
        }
      } catch (err: any) {
        // API error
        console.error('Users fetch error:', err);
        setError(err.message || 'Network error loading users');
        setUsers([]);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    setUserToDelete(user);
    setGoogleAction('delete'); // Reset to default
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setIsDeleting(true);
      const token = localStorage.getItem('helios_token');

      const response = await fetch(`/api/v1/organization/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          googleAction: userToDelete.googleWorkspaceId ? googleAction : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      // Close modal and refresh user list
      setShowDeleteModal(false);
      setUserToDelete(null);
      await fetchUsers();
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setIsCreating(true);
      setCreateError(null);

      // Validate basic fields
      if (!newUserEmail || !newUserFirstName || !newUserLastName) {
        setCreateError('Email, first name, and last name are required');
        return;
      }

      // Validate based on password method
      if (passwordMethod === 'admin_set') {
        if (!newUserPassword) {
          setCreateError('Password is required when admin sets password');
          return;
        }
        if (newUserPassword.length < 8) {
          setCreateError('Password must be at least 8 characters long');
          return;
        }
      } else if (passwordMethod === 'email_link') {
        if (!alternateEmail) {
          setCreateError('Alternate email is required for password setup link');
          return;
        }
      }

      const token = localStorage.getItem('helios_token');

      const requestBody: any = {
        email: newUserEmail,
        firstName: newUserFirstName,
        lastName: newUserLastName,
        role: newUserRole,
        passwordSetupMethod: passwordMethod
      };

      if (passwordMethod === 'admin_set') {
        requestBody.password = newUserPassword;
      } else if (passwordMethod === 'email_link') {
        requestBody.alternateEmail = alternateEmail;
        requestBody.expiryHours = parseInt(expiryHours);
      }

      const response = await fetch('/api/v1/organization/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      // Success - close modal and refresh list
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserRole('user');
      setPasswordMethod('email_link');
      setAlternateEmail('');
      setExpiryHours('48');
      await fetchUsers();

    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleBulkActivate = async () => {
    if (selectedUserIds.size === 0) return;

    if (!confirm(`Are you sure you want to activate ${selectedUserIds.size} user(s)?`)) {
      return;
    }

    try {
      setIsBulkOperating(true);
      const token = localStorage.getItem('helios_token');

      const promises = Array.from(selectedUserIds).map(userId =>
        fetch(`/api/v1/organization/users/${userId}/status`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'active' })
        })
      );

      await Promise.all(promises);

      setSelectedUserIds(new Set());
      await fetchUsers();
      alert(`Successfully activated ${selectedUserIds.size} user(s)`);
    } catch (err: any) {
      alert(`Error activating users: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkSuspend = async () => {
    if (selectedUserIds.size === 0) return;

    if (!confirm(`Are you sure you want to suspend ${selectedUserIds.size} user(s)?`)) {
      return;
    }

    try {
      setIsBulkOperating(true);
      const token = localStorage.getItem('helios_token');

      const promises = Array.from(selectedUserIds).map(userId =>
        fetch(`/api/v1/organization/users/${userId}/status`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'suspended' })
        })
      );

      await Promise.all(promises);

      setSelectedUserIds(new Set());
      await fetchUsers();
      alert(`Successfully suspended ${selectedUserIds.size} user(s)`);
    } catch (err: any) {
      alert(`Error suspending users: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedUserIds.size} user(s)?\n\nThis will soft-delete the users (can be restored within 30 days).`)) {
      return;
    }

    try {
      setIsBulkOperating(true);
      const token = localStorage.getItem('helios_token');

      const promises = Array.from(selectedUserIds).map(userId =>
        fetch(`/api/v1/organization/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      );

      await Promise.all(promises);

      setSelectedUserIds(new Set());
      await fetchUsers();
      alert(`Successfully deleted ${selectedUserIds.size} user(s)`);
    } catch (err: any) {
      alert(`Error deleting users: ${err.message}`);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleQuickSuspend = async (user: User) => {
    const token = localStorage.getItem('helios_token');
    try {
      await fetch(`/api/v1/organization/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' })
      });
      await fetchUsers();
      setActionMenuOpen(null);
    } catch (err: any) {
      alert(`Error suspending user: ${err.message}`);
    }
  };

  const handleQuickRestore = async (user: User) => {
    const token = localStorage.getItem('helios_token');
    try {
      await fetch(`/api/v1/organization/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      await fetchUsers();
      setActionMenuOpen(null);
    } catch (err: any) {
      alert(`Error restoring user: ${err.message}`);
    }
  };

  const handleQuickBlock = async (_user: User) => {
    // TODO: Open block user modal
    alert('Block user feature - opening modal...');
    setActionMenuOpen(null);
  };

  const handleCopyEmail = (user: User) => {
    navigator.clipboard?.writeText(user.email);
    alert('Email copied to clipboard');
    setActionMenuOpen(null);
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, { icon: string; color: string; title: string }> = {
      google_workspace: { icon: 'G', color: '#4285F4', title: 'Google Workspace' },
      microsoft_365: { icon: 'M', color: '#0078D4', title: 'Microsoft 365' },
      slack: { icon: 'S', color: '#4A154B', title: 'Slack' },
      okta: { icon: 'O', color: '#007DC1', title: 'Okta' },
      local: { icon: 'L', color: '#6b7280', title: 'Local User' },  // Subtle gray instead of bright green
      default: { icon: '?', color: '#9ca3af', title: 'Unknown' }
    };

    return icons[platform] || icons.default;
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      platform_owner: { label: 'Platform Owner', className: 'badge-owner' },
      tenant_admin: { label: 'Admin', className: 'badge-admin' },
      admin: { label: 'Admin', className: 'badge-admin' },
      tenant_user: { label: 'User', className: 'badge-user' },
      user: { label: 'User', className: 'badge-user' },
      default: { label: 'User', className: 'badge-user' }
    };

    return badges[role] || badges.default;
  };

  // Get columns configuration based on user type
  const getColumnsForType = () => {
    if (userType === 'staff') {
      return [
        { key: 'checkbox', label: '', className: 'col-checkbox' },
        { key: 'user', label: 'User', className: 'col-user' },
        { key: 'email', label: 'Email', className: 'col-email' },
        { key: 'department', label: 'Department', className: 'col-department' },
        { key: 'role', label: 'Role', className: 'col-role' },
        { key: 'platforms', label: 'Integrations', className: 'col-platforms' },
        { key: 'status', label: 'Status', className: 'col-status' },
        { key: 'lastLogin', label: 'Last Login', className: 'col-last-login' },
        { key: 'actions', label: '', className: 'col-actions' }
      ];
    } else if (userType === 'guests') {
      return [
        { key: 'checkbox', label: '', className: 'col-checkbox' },
        { key: 'user', label: 'User', className: 'col-user' },
        { key: 'email', label: 'Email', className: 'col-email' },
        { key: 'company', label: 'Company', className: 'col-company' },
        { key: 'role', label: 'Access Level', className: 'col-role' },
        { key: 'expires', label: 'Expires', className: 'col-expires' },
        { key: 'status', label: 'Status', className: 'col-status' },
        { key: 'lastLogin', label: 'Last Login', className: 'col-last-login' },
        { key: 'actions', label: '', className: 'col-actions' }
      ];
    } else { // contacts
      return [
        { key: 'checkbox', label: '', className: 'col-checkbox' },
        { key: 'user', label: 'User', className: 'col-user' },
        { key: 'email', label: 'Email', className: 'col-email' },
        { key: 'company', label: 'Company', className: 'col-company' },
        { key: 'phone', label: 'Phone', className: 'col-phone' },
        { key: 'title', label: 'Title', className: 'col-title' },
        { key: 'addedDate', label: 'Added Date', className: 'col-added-date' },
        { key: 'actions', label: '', className: 'col-actions' }
      ];
    }
  };

  const columns = getColumnsForType();

  // Render cell content based on column key
  const renderCell = (column: { key: string; className: string }, user: User) => {
    const roleBadge = getRoleBadge(user.role);

    switch (column.key) {
      case 'checkbox':
        return (
          <div className={column.className} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedUserIds.has(user.id)}
              onChange={() => handleSelectUser(user.id)}
              className="row-checkbox"
            />
          </div>
        );

      case 'user':
        return (
          <div className={column.className}>
            <span className="user-name">{user.firstName} {user.lastName}</span>
          </div>
        );

      case 'email':
        return <div className={column.className}>{user.email}</div>;

      case 'department':
        return <div className={column.className}>{user.department || 'N/A'}</div>;

      case 'company':
        return <div className={column.className}>{user.company || 'N/A'}</div>;

      case 'role':
        return (
          <div className={column.className}>
            <span className={`role-badge ${roleBadge.className}`}>
              {roleBadge.label}
            </span>
          </div>
        );

      case 'platforms':
        // Build platforms array, adding google_workspace if user has googleWorkspaceId
        const userPlatforms = [...user.platforms];
        if (user.googleWorkspaceId && !userPlatforms.includes('google_workspace')) {
          userPlatforms.push('google_workspace');
        }
        if (user.microsoft365Id && !userPlatforms.includes('microsoft_365')) {
          userPlatforms.push('microsoft_365');
        }

        // Clean up: Remove 'local' if synced platforms exist (local is implicit)
        const syncedPlatforms = userPlatforms.filter(p => p !== 'local');
        const cleanPlatforms = syncedPlatforms.length > 0 ? syncedPlatforms : userPlatforms;

        // Determine primary platform (priority: Google Workspace > Microsoft 365 > Local)
        let primaryPlatform = 'local';
        if (cleanPlatforms.includes('google_workspace')) {
          primaryPlatform = 'google_workspace';
        } else if (cleanPlatforms.includes('microsoft_365')) {
          primaryPlatform = 'microsoft_365';
        }

        const primaryIcon = getPlatformIcon(primaryPlatform);

        // Build tooltip text showing all platforms
        const platformNames = cleanPlatforms.map(p => {
          const icon = getPlatformIcon(p);
          return icon.title;
        }).join(', ');

        const tooltipText = cleanPlatforms.length > 1
          ? `Integrations: ${platformNames}`
          : cleanPlatforms.length === 0 || cleanPlatforms[0] === 'local'
            ? 'No integrations - Managed locally'
            : `Synced with ${primaryIcon.title}`;

        return (
          <div className={column.className}>
            <div className="platform-icons" title={tooltipText}>
              <PlatformIcon 
                platform={primaryPlatform === 'google_workspace' ? 'google' : primaryPlatform === 'microsoft_365' ? 'microsoft' : primaryPlatform === 'local' ? 'helios' : primaryPlatform} 
                size={24} 
              />
            </div>
          </div>
        );

      case 'status':
        let statusClass = 'active';
        let statusText = 'Active';

        if (user.status === 'blocked') {
          statusClass = 'blocked';
          statusText = 'Blocked';
        } else if (user.status === 'suspended') {
          statusClass = 'suspended';
          statusText = 'Suspended';
        } else if (user.status === 'staged') {
          statusClass = 'staged';
          statusText = 'Staged';
        } else if (user.status === 'deleted') {
          statusClass = 'deleted';
          statusText = 'Deleted';
        } else if (user.status === 'active') {
   statusClass = 'active';
   statusText = 'Active';
 } else if (!user.isActive) {
          statusClass = 'inactive';
          statusText = 'Inactive';
        }

        return (
          <div className={column.className}>
            <span className={`status-indicator ${statusClass}`}>
              <span className={`status-dot ${statusClass}`}></span>
              {statusText}
            </span>
          </div>
        );

      case 'lastLogin':
        const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
        const daysSinceLogin = lastLoginDate
          ? Math.floor((Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let loginStatusClass = '';
        let loginText = 'Never';

        if (lastLoginDate && daysSinceLogin !== null) {
          if (daysSinceLogin === 0) {
            loginText = 'Today';
            loginStatusClass = 'login-recent';
          } else if (daysSinceLogin === 1) {
            loginText = 'Yesterday';
            loginStatusClass = 'login-recent';
          } else if (daysSinceLogin <= 7) {
            loginText = `${daysSinceLogin} days ago`;
            loginStatusClass = 'login-active';
          } else if (daysSinceLogin <= 30) {
            loginText = `${daysSinceLogin} days ago`;
            loginStatusClass = 'login-inactive';
          } else if (daysSinceLogin <= 90) {
            loginText = `${Math.floor(daysSinceLogin / 7)} weeks ago`;
            loginStatusClass = 'login-warning';
          } else {
            loginText = `${Math.floor(daysSinceLogin / 30)} months ago`;
            loginStatusClass = 'login-critical';
          }
        } else {
          loginStatusClass = 'login-never';
        }

        return (
          <div className={`${column.className} ${loginStatusClass}`} title={lastLoginDate ? lastLoginDate.toLocaleString() : 'Never logged in'}>
            {loginText}
          </div>
        );

      case 'expires':
        return (
          <div className={column.className}>
            {user.guestExpiresAt
              ? new Date(user.guestExpiresAt).toLocaleDateString()
              : 'No expiry'
            }
          </div>
        );

      case 'phone':
        return <div className={column.className}>{user.workPhone || user.mobilePhone || 'N/A'}</div>;

      case 'title':
        return <div className={column.className}>{user.jobTitle || 'N/A'}</div>;

      case 'addedDate':
        return (
          <div className={column.className}>
            {user.addedAt
              ? new Date(user.addedAt).toLocaleDateString()
              : user.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : 'N/A'
            }
          </div>
        );

      case 'actions':
        return (
          <div className={column.className} onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-ellipsis"
              onClick={(e) => {
                e.stopPropagation();
                setActionMenuOpen(actionMenuOpen === user.id ? null : user.id);
              }}
            >
              <MoreVertical size={16} />
            </button>

            {actionMenuOpen === user.id && (
              <div className="action-menu">
                <button onClick={() => { setSelectedUser(user); setShowViewModal(true); setActionMenuOpen(null); }}>
                  <Eye size={14} /> View Details
                </button>
                <div className="menu-divider"></div>

                {user.isActive ? (
                  <button onClick={() => handleQuickSuspend(user)}>
                    <PauseCircle size={14} /> Suspend
                  </button>
                ) : (
                  <button onClick={() => handleQuickRestore(user)}>
                    <PlayCircle size={14} /> Restore
                  </button>
                )}

                <button onClick={() => handleQuickBlock(user)}>
                  <Lock size={14} /> Block Account
                </button>

                {user.isActive && userType === 'staff' && (
                  <button
                    className="menu-item-warning"
                    onClick={() => {
                      setActionMenuOpen(null);
                      // Navigate to offboarding wizard with user pre-selected
                      if (onNavigate) {
                        onNavigate('user-offboarding', { userId: user.id });
                      } else {
                        navigate(`/admin/user-offboarding?userId=${user.id}`);
                      }
                    }}
                  >
                    <UserMinus size={14} /> Offboard User...
                  </button>
                )}

                <div className="menu-divider"></div>

                <button onClick={() => handleCopyEmail(user)}>
                  <Copy size={14} /> Copy Email
                </button>

                <div className="menu-divider"></div>

                <button className="menu-item-danger" onClick={() => handleDeleteUser(user)}>
                  <Trash2 size={14} /> Delete...
                </button>
              </div>
            )}
          </div>
        );

      default:
        return <div className={column.className}>-</div>;
    }
  };

  // Platform filtering is now done server-side via API
  // Just use the users from API directly
  let filteredUsers = users;

  // Apply search filter - includes custom attributes
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredUsers = filteredUsers.filter(user =>
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query)) ||
      (user.company && user.company.toLowerCase().includes(query)) ||
      (user.jobTitle && user.jobTitle.toLowerCase().includes(query)) ||
      (user.location && user.location.toLowerCase().includes(query)) ||
      (user.employeeId && user.employeeId.toLowerCase().includes(query)) ||
      (user.employeeType && user.employeeType.toLowerCase().includes(query)) ||
      (user.costCenter && user.costCenter.toLowerCase().includes(query)) ||
      (user.githubUsername && user.githubUsername.toLowerCase().includes(query)) ||
      (user.slackUserId && user.slackUserId.toLowerCase().includes(query)) ||
      (user.associateId && user.associateId.toLowerCase().includes(query)) ||
      (user.mobilePhone && user.mobilePhone.includes(query)) ||
      (user.workPhone && user.workPhone.includes(query))
    );
  }

  // Pagination calculations
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Page number helpers
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

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
          <button className="btn-sync" onClick={fetchUsers}>
            <RefreshCw size={14} /> Sync
          </button>
          <button className="btn-add-user" onClick={() => navigate('/add-user')}>
            <UserPlus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="bulk-action-bar">
          <div className="bulk-action-left">
            <input
              type="checkbox"
              checked={selectedUserIds.size === filteredUsers.length}
              onChange={handleSelectAll}
              className="bulk-checkbox"
            />
            <span className="bulk-count">{selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected</span>
            <button
              className="btn-clear-selection"
              onClick={() => setSelectedUserIds(new Set())}
              disabled={isBulkOperating}
            >
              Clear
            </button>
          </div>
          <div className="bulk-action-right">
            <button
              className="btn-bulk-action btn-activate"
              onClick={handleBulkActivate}
              disabled={isBulkOperating}
            >
              <CheckCircle size={14} /> Activate
            </button>
            <button
              className="btn-bulk-action btn-suspend"
              onClick={handleBulkSuspend}
              disabled={isBulkOperating}
            >
              <PauseCircle size={14} /> Suspend
            </button>
            <button
              className="btn-bulk-action btn-delete-bulk"
              onClick={handleBulkDelete}
              disabled={isBulkOperating}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="user-table">
        <div className="table-header">
          {columns.map((column) => (
            <div key={column.key} className={column.className}>
              {column.key === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={handleSelectAll}
                  className="header-checkbox"
                />
              ) : (
                column.label
              )}
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 ? (
          <div className="no-users">
            <div className="empty-state">
              <span className="empty-icon"><Users size={48} /></span>
              <h3>No users found</h3>
              <p>
                {platformFilter !== 'all'
                  ? `No users found with ${getPlatformIcon(platformFilter).title} integration`
                  : 'Start by connecting to Google Workspace in Settings'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="table-body">
            {paginatedUsers.map(user => (
              <div
                key={user.id}
                className={`table-row ${selectedUserIds.has(user.id) ? 'selected' : ''} clickable`}
                onClick={() => {
                  setSelectedUser(user);
                  setShowViewModal(true);
                }}
              >
                {columns.map((column) => renderCell(column, user))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls - JumpCloud Style */}
      {totalUsers > 0 && (
        <div className="pagination-container">
          <div className="pagination-left">
            <span className="pagination-label">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="pagination-select"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="pagination-center">
            <span className="pagination-info">
              {startIndex + 1}-{Math.min(endIndex, totalUsers)} of {totalUsers}
            </span>
          </div>

          <div className="pagination-right">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              «
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              ‹
            </button>

            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page as number)}
                >
                  {page}
                </button>
              )
            ))}

            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              ›
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}

      <div className="user-list-footer">
        <div className="sync-info">
          Last sync: {new Date().toLocaleString()}
        </div>
        <div className="platform-legend">
          <span>Integration status:</span>
          {uniquePlatforms.length > 0 ? (
            uniquePlatforms.map(platform => {
              const icon = getPlatformIcon(platform);
              return (
                <div key={platform} className="legend-item">
                  <div
                    className="platform-icon small"
                    style={{
                      backgroundColor: icon.color,
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  >
                    {icon.icon}
                  </div>
                  <span>{icon.title}</span>
                </div>
              );
            })
          ) : (
            <span style={{ marginLeft: '8px', color: '#666' }}>No integrations active</span>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
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
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowAddUserModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '2rem 2rem 1rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0 }}>Add New User</h2>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem 2rem'
            }}>

            {createError && (
              <div className="error-message" style={{ margin: '1rem 0', padding: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
                {createError}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Email <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
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
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', color: '#374151' }}>
                Password Setup Method <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.75rem', border: passwordMethod === 'email_link' ? '2px solid #667eea' : '1px solid #d1d5db', borderRadius: '8px', backgroundColor: passwordMethod === 'email_link' ? '#f0f4ff' : 'white' }}>
                  <input
                    type="radio"
                    name="passwordMethod"
                    value="email_link"
                    checked={passwordMethod === 'email_link'}
                    onChange={(e) => setPasswordMethod(e.target.value as 'email_link')}
                    disabled={isCreating}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={16} /> Send password setup email (Recommended)</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>User will receive a secure link to set their own password</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.75rem', border: passwordMethod === 'admin_set' ? '2px solid #667eea' : '1px solid #d1d5db', borderRadius: '8px', backgroundColor: passwordMethod === 'admin_set' ? '#f0f4ff' : 'white' }}>
                  <input
                    type="radio"
                    name="passwordMethod"
                    value="admin_set"
                    checked={passwordMethod === 'admin_set'}
                    onChange={(e) => setPasswordMethod(e.target.value as 'admin_set')}
                    disabled={isCreating}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '6px' }}><Key size={16} /> I will set the password</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Set a password now and share it with the user</div>
                  </div>
                </label>
              </div>
            </div>

            {passwordMethod === 'email_link' ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                    Alternate Email (for password setup) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={alternateEmail}
                    onChange={(e) => setAlternateEmail(e.target.value)}
                    placeholder="personal@email.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                    disabled={isCreating}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: 0 }}>
                    The setup link will be sent to this email address
                  </p>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                    Link Expires In
                  </label>
                  <select
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                    disabled={isCreating}
                  >
                    <option value="24">24 hours</option>
                    <option value="48">48 hours (Recommended)</option>
                    <option value="72">72 hours</option>
                    <option value="168">7 days</option>
                  </select>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Password <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 8 characters"
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
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                First Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
                placeholder="John"
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
                Last Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
                placeholder="Doe"
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
                Role <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
                disabled={isCreating}
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserFirstName('');
                  setNewUserLastName('');
                  setNewUserRole('user');
                  setPasswordMethod('email_link');
                  setAlternateEmail('');
                  setExpiryHours('48');
                  setCreateError(null);
                }}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateUser}
                disabled={isCreating || !newUserEmail || !newUserFirstName || !newUserLastName || (passwordMethod === 'email_link' && !alternateEmail) || (passwordMethod === 'admin_set' && !newUserPassword)}
              >
                {isCreating ? <><Loader size={14} className="spinning" /> Creating...</> : <><UserPlus size={14} /> Add User</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Slide-Out Panel */}
      {showViewModal && selectedUser && (
        <UserSlideOut
          user={selectedUser}
          organizationId={organizationId}
          onClose={() => {
            setShowViewModal(false);
            setSelectedUser(null);
          }}
          onUserUpdated={() => {
            fetchUsers();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete User: {userToDelete.firstName} {userToDelete.lastName}</h2>

            {userToDelete.googleWorkspaceId ? (
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
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
