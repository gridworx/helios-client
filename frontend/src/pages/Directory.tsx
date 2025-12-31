import { UserTable } from '../components/UserTable';
import { ContactsTab } from '../components/directory/ContactsTab';
import { Groups } from './Groups';
import { OrgUnits } from './OrgUnits';
import { useTabPersistence } from '../hooks/useTabPersistence';
import { Users, UserCheck, Contact, UsersRound, Building2, Monitor } from 'lucide-react';
import './Directory.css';

type DirectoryTab = 'users' | 'guests' | 'contacts' | 'groups' | 'org-units' | 'devices';

interface DirectoryProps {
  organizationId: string;
}

export function Directory({ organizationId }: DirectoryProps) {
  const [activeTab, setActiveTab] = useTabPersistence<DirectoryTab>('helios_directory_tab', 'users');

  return (
    <div className="directory-container">
      <div className="directory-header">
        <h1>Directory</h1>
        <p>Manage users, guests, contacts, and organizational units across all connected platforms</p>
      </div>

      <div className="directory-tabs">
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
          title="Internal staff with organization email domains"
        >
          <Users size={16} className="tab-icon" />
          Users
        </button>
        <button
          className={`tab-button ${activeTab === 'guests' ? 'active' : ''}`}
          onClick={() => setActiveTab('guests')}
          title="External collaborators with non-organization email domains"
        >
          <UserCheck size={16} className="tab-icon" />
          Guests
        </button>
        <button
          className={`tab-button ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
          title="External contacts (vendors, clients) - no login capability"
        >
          <Contact size={16} className="tab-icon" />
          Contacts
        </button>
        <button
          className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <UsersRound size={16} className="tab-icon" />
          Groups
        </button>
        <button
          className={`tab-button ${activeTab === 'org-units' ? 'active' : ''}`}
          onClick={() => setActiveTab('org-units')}
        >
          <Building2 size={16} className="tab-icon" />
          Org Units
        </button>
        <button
          className={`tab-button ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <Monitor size={16} className="tab-icon" />
          Devices
        </button>
      </div>

      <div className="directory-content">
        {activeTab === 'users' && (
          <UserTable organizationId={organizationId} userType="staff" />
        )}

        {activeTab === 'guests' && (
          <UserTable organizationId={organizationId} userType="guests" />
        )}

        {activeTab === 'contacts' && (
          <ContactsTab organizationId={organizationId} />
        )}

        {activeTab === 'groups' && (
          <Groups organizationId={organizationId} />
        )}

        {activeTab === 'org-units' && (
          <OrgUnits organizationId={organizationId} />
        )}

        {activeTab === 'devices' && (
          <div className="coming-soon">
            <div className="coming-soon-icon"><Monitor size={48} /></div>
            <h2>Device Management</h2>
            <p>Manage devices enrolled in your organization's platforms.</p>
            <p className="coming-soon-label">Requires Google Workspace or Microsoft 365 integration</p>
          </div>
        )}
      </div>
    </div>
  );
}