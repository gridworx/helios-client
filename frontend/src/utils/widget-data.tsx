import React from 'react';
import { WIDGET_REGISTRY, type WidgetId } from '../config/widgets';
import type { MetricCardSize, MetricState } from '../components/MetricCard';

export interface WidgetData {
  id: WidgetId;
  icon: React.ReactNode;
  title: string;
  value: string | number;
  label: string;
  footer?: string;
  state?: MetricState;
  size?: MetricCardSize;
  platformColor?: string;
  gridColumn?: number;
  onClick?: () => void;
}

interface OrganizationStats {
  google?: {
    connected: boolean;
    totalUsers: number;
    suspendedUsers: number;
    adminUsers: number;
    lastSync: string | null;
    licenses?: {
      used: number;
      total: number;
      reportDate?: string;
    } | null;
  };
  microsoft?: {
    connected: boolean;
    totalUsers: number;
    disabledUsers: number;
    adminUsers: number;
    lastSync: string | null;
    licenses?: {
      used: number;
      total: number;
      reportDate?: string;
    } | null;
  };
  helios?: {
    totalUsers: number;
    guestUsers: number;
  };
}

const formatLastSync = (syncTime: string | null): string => {
  if (!syncTime) return 'Never synced';
  const date = new Date(syncTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return date.toLocaleDateString();
};

export const getWidgetData = (
  widgetId: WidgetId,
  stats: OrganizationStats | null,
  onClick?: () => void
): WidgetData | null => {
  const widget = WIDGET_REGISTRY.find(w => w.id === widgetId);
  if (!widget) return null;

  const baseData = {
    id: widgetId,
    icon: widget.icon,
    title: widget.title,
    platformColor: widget.platformColor,
    gridColumn: widget.gridColumn,
    onClick,
  };

  // Google Workspace Widgets
  if (widgetId === 'google-total-users') {
    return {
      ...baseData,
      value: stats?.google?.totalUsers || 0,
      label: 'users',
      footer: formatLastSync(stats?.google?.lastSync || null),
      state: 'default',
    };
  }

  if (widgetId === 'google-suspended') {
    const suspended = stats?.google?.suspendedUsers || 0;
    return {
      ...baseData,
      value: suspended,
      label: 'suspended',
      footer: suspended > 0 ? 'Review and restore or remove' : 'All users active',
      state: suspended > 0 ? 'warning' : 'success',
    };
  }

  if (widgetId === 'google-admins') {
    return {
      ...baseData,
      value: stats?.google?.adminUsers || 0,
      label: 'admins',
      state: 'default',
    };
  }

  if (widgetId === 'google-licenses') {
    const licenses = stats?.google?.licenses;
    if (!licenses || licenses.total === 0) {
      return {
        ...baseData,
        value: 'N/A',
        label: 'license data unavailable',
        state: 'default',
      };
    }

    const percentUsed = Math.round((licenses.used / licenses.total) * 100);
    return {
      ...baseData,
      value: `${percentUsed}%`,
      label: `${licenses.used} / ${licenses.total} licenses`,
      footer: licenses.reportDate ? `As of ${new Date(licenses.reportDate).toLocaleDateString()}` : undefined,
      state: percentUsed > 90 ? 'warning' : percentUsed > 100 ? 'error' : 'default',
    };
  }

  if (widgetId === 'google-last-sync') {
    const lastSync = stats?.google?.lastSync;
    const needsSync = !lastSync;
    return {
      ...baseData,
      value: formatLastSync(lastSync || null),
      label: 'last sync',
      state: needsSync ? 'warning' : 'default',
    };
  }

  // Microsoft 365 Widgets
  if (widgetId === 'microsoft-total-users') {
    return {
      ...baseData,
      value: stats?.microsoft?.totalUsers || 0,
      label: 'users',
      footer: formatLastSync(stats?.microsoft?.lastSync || null),
      state: 'default',
    };
  }

  if (widgetId === 'microsoft-disabled') {
    const disabled = stats?.microsoft?.disabledUsers || 0;
    return {
      ...baseData,
      value: disabled,
      label: 'disabled',
      footer: disabled > 0 ? 'Review and restore or remove' : 'All users enabled',
      state: disabled > 0 ? 'warning' : 'success',
    };
  }

  if (widgetId === 'microsoft-admins') {
    return {
      ...baseData,
      value: stats?.microsoft?.adminUsers || 0,
      label: 'admins',
      state: 'default',
    };
  }

  if (widgetId === 'microsoft-licenses') {
    const licenses = stats?.microsoft?.licenses;
    if (!licenses || licenses.total === 0) {
      return {
        ...baseData,
        value: 'N/A',
        label: 'license data unavailable',
        state: 'default',
      };
    }

    const percentUsed = Math.round((licenses.used / licenses.total) * 100);
    return {
      ...baseData,
      value: `${percentUsed}%`,
      label: `${licenses.used} / ${licenses.total} licenses`,
      footer: licenses.reportDate ? `As of ${new Date(licenses.reportDate).toLocaleDateString()}` : undefined,
      state: percentUsed > 90 ? 'warning' : percentUsed > 100 ? 'error' : 'default',
    };
  }

  // Helios Portal Widgets
  if (widgetId === 'helios-total-users') {
    return {
      ...baseData,
      value: stats?.helios?.totalUsers || 0,
      label: 'local users',
      state: 'default',
    };
  }

  if (widgetId === 'helios-guests') {
    return {
      ...baseData,
      value: stats?.helios?.guestUsers || 0,
      label: 'guest users',
      state: 'default',
    };
  }

  if (widgetId === 'helios-recent-signups') {
    // TODO: Add this to stats API
    return {
      ...baseData,
      value: 0,
      label: 'signups (7 days)',
      footer: 'Coming soon',
      state: 'default',
    };
  }

  // System Widgets
  if (widgetId === 'system-alerts') {
    // Calculate total alerts
    const googleSuspended = stats?.google?.suspendedUsers || 0;
    const microsoftDisabled = stats?.microsoft?.disabledUsers || 0;
    const googleNeedsSync = stats?.google?.connected && !stats?.google?.lastSync ? 1 : 0;
    const microsoftNeedsSync = stats?.microsoft?.connected && !stats?.microsoft?.lastSync ? 1 : 0;

    const totalAlerts = googleSuspended + microsoftDisabled + googleNeedsSync + microsoftNeedsSync;

    return {
      ...baseData,
      value: totalAlerts,
      label: totalAlerts === 1 ? 'alert' : 'alerts',
      footer: totalAlerts > 0 ? 'Requires attention' : 'All systems normal',
      state: totalAlerts > 0 ? 'warning' : 'success',
    };
  }

  if (widgetId === 'system-sync-status') {
    const googleSynced = stats?.google?.connected && stats?.google?.lastSync;
    const microsoftSynced = stats?.microsoft?.connected && stats?.microsoft?.lastSync;
    const allSynced = (!stats?.google?.connected || googleSynced) && (!stats?.microsoft?.connected || microsoftSynced);

    return {
      ...baseData,
      value: allSynced ? 'Synced' : 'Needs Sync',
      label: 'all platforms',
      state: allSynced ? 'success' : 'warning',
    };
  }

  return null;
};
