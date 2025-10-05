import { UserList } from '../components/UserList';

interface UsersProps {
  organizationId: string;
}

export function Users({ organizationId }: UsersProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage users across all connected platforms</p>
      </div>
      <UserList organizationId={organizationId} />
    </div>
  );
}