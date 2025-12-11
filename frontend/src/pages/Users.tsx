import { useState, useEffect, useRef } from 'react';
import { UserPlus, ChevronDown } from 'lucide-react';
import { UserList } from '../components/UserList';
import { useTabPersistence } from '../hooks/useTabPersistence';
import './Users.css';

interface UsersProps {
  organizationId: string;
  onNavigate?: (page: string) => void;
}

type UserType = 'staff' | 'guests' | 'contacts';

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended' | 'expired' | 'deleted';

export function Users({ organizationId, onNavigate }: UsersProps) {
  const [activeTab, setActiveTab] = useTabPersistence<UserType>('helios_users_tab', 'staff');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState({
    staff: 0,
    guests: 0,
    contacts: 0
  });
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    expired: 0,
    deleted: 0
  });
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch user counts for each type
  useEffect(() => {
    fetchCounts();
  }, [organizationId]);

  const fetchCounts = async () => {
    try {
      const token = localStorage.getItem('helios_token');

      // Fetch counts for each user type
      const staffResponse = await fetch(
        `/api/v1/organization/users/count?userType=staff`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const guestsResponse = await fetch(
        `/api/v1/organization/users/count?userType=guest`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const contactsResponse = await fetch(
        `/api/v1/organization/users/count?userType=contact`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const staffData = await staffResponse.json();
      const guestsData = await guestsResponse.json();
      const contactsData = await contactsResponse.json();

      setCounts({
        staff: staffData.success ? staffData.data.count : 0,
        guests: guestsData.success ? guestsData.data.count : 0,
        contacts: contactsData.success ? contactsData.data.count : 0
      });
    } catch (error) {
      console.error('Error fetching user counts:', error);
    }
  };

  const tabs = [
    {
      id: 'staff' as UserType,
      label: 'Users',
      count: counts.staff
    },
    {
      id: 'guests' as UserType,
      label: 'Guests',
      count: counts.guests
    },
    {
      id: 'contacts' as UserType,
      label: 'Contacts',
      count: counts.contacts
    }
  ];

  const getTypeLabel = () => {
    if (activeTab === 'staff') return 'Users';
    if (activeTab === 'guests') return 'Guests';
    return 'Contacts';
  };

  const getStatusTabs = () => {
    if (activeTab === 'staff') {
      return [
        { id: 'all' as StatusFilter, label: 'All', count: statusCounts.all },
        { id: 'active' as StatusFilter, label: 'Active', count: statusCounts.active },
        { id: 'pending' as StatusFilter, label: 'Staged', count: statusCounts.pending },
        { id: 'suspended' as StatusFilter, label: 'Suspended', count: statusCounts.suspended },
        { id: 'deleted' as StatusFilter, label: 'Deleted', count: statusCounts.deleted }
      ];
    } else if (activeTab === 'guests') {
      return [
        { id: 'all' as StatusFilter, label: 'All', count: statusCounts.all },
        { id: 'active' as StatusFilter, label: 'Active', count: statusCounts.active },
        { id: 'expired' as StatusFilter, label: 'Expired', count: statusCounts.expired },
        { id: 'pending' as StatusFilter, label: 'Staged', count: statusCounts.pending }
      ];
    } else {
      return [
        { id: 'all' as StatusFilter, label: 'All', count: statusCounts.all }
      ];
    }
  };

  return (
    <div className="users-page">
      {/* Page Title */}
      <div className="page-title">
        <h1>{getTypeLabel()}</h1>
      </div>

      {/* Statistics Dashboard */}
      <div className="users-stats-bar">
        <div className="stat-card">
          <span className="stat-value">{counts.staff + counts.guests + counts.contacts}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{statusCounts.active}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{statusCounts.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{statusCounts.suspended}</span>
          <span className="stat-label">Suspended</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{statusCounts.deleted}</span>
          <span className="stat-label">Deleted</span>
        </div>
      </div>

      {/* Type Tabs - JumpCloud Style */}
      <div className="type-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`type-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setStatusFilter('all');
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Tabs - JumpCloud Style */}
      <div className="status-tabs">
        {getStatusTabs().map(tab => (
          <button
            key={tab.id}
            className={`status-tab ${statusFilter === tab.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(tab.id)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="actions-bar">
        <div className="add-user-dropdown" ref={addDropdownRef}>
          <button
            className="btn-add-user-primary"
            onClick={() => setShowAddDropdown(!showAddDropdown)}
          >
            <UserPlus size={16} />
            Add {activeTab === 'staff' ? 'User' : activeTab === 'guests' ? 'Guest' : 'Contact'}
            <ChevronDown size={14} className={`dropdown-chevron ${showAddDropdown ? 'open' : ''}`} />
          </button>
          {showAddDropdown && (
            <div className="add-dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowAddDropdown(false);
                  onNavigate?.('add-user');
                }}
              >
                <UserPlus size={16} />
                Quick Add
                <span className="dropdown-item-desc">Create a basic user account</span>
              </button>
              <button
                className="dropdown-item highlight"
                onClick={() => {
                  setShowAddDropdown(false);
                  onNavigate?.('new-user-onboarding');
                }}
              >
                <UserPlus size={16} />
                Full Onboarding
                <span className="dropdown-item-desc">Use template with groups, access & welcome email</span>
              </button>
            </div>
          )}
        </div>

        <div className="actions-right">
          <div className="search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          <button className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2v12M12 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          <button className="btn-filter-pill">
            Export
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 8L2 4h8z" fill="currentColor"/>
            </svg>
          </button>

          <button className="btn-filter-pill">
            Actions
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 8L2 4h8z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content Card */}
      <div className="users-content-card">

        {/* User List */}
        <UserList
          organizationId={organizationId}
          userType={activeTab}
          onCountChange={fetchCounts}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onStatusCountsChange={setStatusCounts}
          onNavigate={(page, params) => {
            if (params?.userId) {
              // Store the userId for the offboarding page
              sessionStorage.setItem('offboard_user_id', params.userId);
            }
            onNavigate?.(page);
          }}
        />
      </div>
    </div>
  );
}
