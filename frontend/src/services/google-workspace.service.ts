const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface Group {
  id: string;
  name: string;
  email: string;
  description: string;
  directMembersCount: number;
  adminCreated: boolean;
}

interface OrgUnit {
  orgUnitId: string;
  name: string;
  description: string;
  orgUnitPath: string;
  parentOrgUnitPath: string;
}

class GoogleWorkspaceService {
  private getAuthHeaders() {
    const token = localStorage.getItem('helios_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getGroups(organizationId: string): Promise<ApiResponse<{ groups: Group[] }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/google-workspace/groups/${organizationId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to fetch groups:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch groups'
      };
    }
  }

  async syncGroups(organizationId: string): Promise<ApiResponse<{ count: number; groups: Group[] }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/google-workspace/sync-groups`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ organizationId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to sync groups:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync groups'
      };
    }
  }

  async getOrgUnits(organizationId: string): Promise<ApiResponse<{ orgUnits: OrgUnit[] }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/google-workspace/org-units/${organizationId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to fetch org units:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch org units'
      };
    }
  }

  async syncOrgUnits(organizationId: string): Promise<ApiResponse<{ count: number; orgUnits: OrgUnit[] }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/google-workspace/sync-org-units`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ organizationId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to sync org units:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync org units'
      };
    }
  }

  async getCachedGroups(organizationId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/google-workspace/cached-groups/${organizationId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to fetch cached groups:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch cached groups'
      };
    }
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
export type { Group, OrgUnit, ApiResponse };
