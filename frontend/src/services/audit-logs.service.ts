const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type AuditLog = {
  id: number;
  organization_id: number;
  user_id?: number;
  actor_id?: number;
  action: string;
  resource_type?: string;
  resource_id?: string;
  description: string;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  actor_email?: string;
  actor_first_name?: string;
  actor_last_name?: string;
}

export type AuditLogsResponse = {
  success: boolean;
  data: AuditLog[];
}

export const auditLogsService = {
  async getAuditLogs(params?: {
    action?: string;
    userId?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogsResponse> {
    const queryParams = new URLSearchParams();

    if (params?.action) queryParams.append('action', params.action);
    if (params?.userId) queryParams.append('userId', params.userId.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(
      `${API_URL}/api/organization/audit-logs?${queryParams.toString()}`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }

    return response.json();
  },

  async exportAuditLogs(params?: {
    action?: string;
    userId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    const queryParams = new URLSearchParams();

    if (params?.action) queryParams.append('action', params.action);
    if (params?.userId) queryParams.append('userId', params.userId.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const response = await fetch(
      `${API_URL}/api/organization/audit-logs/export?${queryParams.toString()}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }

    // Download the CSV file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
