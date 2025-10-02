import { UserList } from '../components/UserList';

interface UsersProps {
  tenantId: string;
}

export function Users({ tenantId }: UsersProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage users across all connected platforms</p>
      </div>
      <UserList tenantId={tenantId} />
    </div>
  );
}