import { useState, useEffect } from 'react';
import './Pages.css';

interface OrgUnit {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  userCount: number;
  childCount: number;
  platform: string;
  description: string;
  syncStatus?: 'synced' | 'modified' | 'manual' | 'conflict';
  lastSynced?: string;
  location?: {
    name?: string;
    city?: string;
    country?: string;
  };
}

interface OrgUnitsProps {
  tenantId: string;
  customLabel?: string; // Allow custom label like "Departments"
}

export function OrgUnits({ tenantId, customLabel }: OrgUnitsProps) {
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const label = customLabel || 'Organizational Units';

  useEffect(() => {
    fetchOrgUnits();
  }, [tenantId]);

  const fetchOrgUnits = async () => {
    try {
      setIsLoading(true);
      setSyncError(null);

      // First try to get from database
      const dbResponse = await fetch(`http://localhost:3001/api/org-units/cached/${tenantId}`);
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        if (dbData.success && dbData.data && dbData.data.length > 0) {
          setOrgUnits(dbData.data);
          setLastSyncTime(dbData.lastSync);
        }
      }

      // If no cached data, try to sync from Google
      if (orgUnits.length === 0) {
        await syncOrgUnits();
      }
    } catch (error: any) {
      console.error('Failed to fetch org units:', error);
      setSyncError('Failed to load organizational units');
    } finally {
      setIsLoading(false);
    }
  };

  const syncOrgUnits = async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);

      const token = localStorage.getItem('helios_client_token');

      const response = await fetch('http://localhost:3001/api/google-workspace/sync-org-units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tenantId })
      });

      const data = await response.json();

      if (data.success) {
        setOrgUnits(data.orgUnits || []);
        setLastSyncTime(new Date().toISOString());

        // Expand root units by default
        const rootUnits = data.orgUnits?.filter((u: OrgUnit) => !u.parentPath || u.parentPath === '/');
        if (rootUnits?.length > 0) {
          setExpandedUnits(new Set(rootUnits.map((u: OrgUnit) => u.id)));
        }
      } else {
        setSyncError(data.error || 'Failed to sync organizational units');
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncError('Failed to sync with Google Workspace');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExpand = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  const renderOrgUnit = (unit: OrgUnit, level: number = 0) => {
    const hasChildren = orgUnits.some(u => u.parentPath === unit.path);
    const isExpanded = expandedUnits.has(unit.id);
    const children = orgUnits.filter(u => u.parentPath === unit.path);

    const getSyncStatusBadge = () => {
      switch (unit.syncStatus) {
        case 'synced':
          return <span className="sync-badge synced" title="Synced with Google Workspace">✓ Synced</span>;
        case 'modified':
          return <span className="sync-badge modified" title="Modified locally">✏️ Modified</span>;
        case 'conflict':
          return <span className="sync-badge conflict" title="Sync conflict - needs resolution">⚠️ Conflict</span>;
        case 'manual':
        default:
          return <span className="sync-badge manual" title="Created manually">📝 Manual</span>;
      }
    };

    return (
      <div key={unit.id} className="org-unit-item">
        <div className="org-unit-row" style={{ paddingLeft: `${level * 32 + 16}px` }}>
          <div className="org-unit-info">
            {hasChildren && (
              <button
                className="expand-button"
                onClick={() => toggleExpand(unit.id)}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="no-expand"></span>}
            <div className="unit-icon">🏢</div>
            <div>
              <div className="unit-name">{unit.name}</div>
              <div className="unit-path">{unit.path}</div>
              {unit.location?.name && (
                <div className="unit-location">📍 {unit.location.name}</div>
              )}
            </div>
          </div>
          <div className="org-unit-stats">
            {getSyncStatusBadge()}
            <span className="stat-item">
              <span className="stat-icon">👤</span>
              {unit.userCount || 0} users
            </span>
            {hasChildren && (
              <span className="stat-item">
                <span className="stat-icon">📁</span>
                {children.length} sub-units
              </span>
            )}
          </div>
          <div className="org-unit-actions">
            <button className="btn-icon" title="Add sub-unit">➕</button>
            <button className="btn-icon" title="Edit">✏️</button>
            <button className="btn-icon danger" title="Delete">🗑️</button>
          </div>
        </div>
        {isExpanded && children.map(child => renderOrgUnit(child, level + 1))}
      </div>
    );
  };

  const rootUnits = orgUnits.filter(u => !u.parentPath || u.parentPath === '/' || u.path === '/');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{label}</h1>
          <p>Manage organizational structure and hierarchy</p>
        </div>
        <button className="btn-primary">
          ➕ Create {customLabel || 'Unit'}
        </button>
      </div>

      <div className="org-units-tree">
        <div className="tree-header">
          <div className="sync-info">
            {lastSyncTime && (
              <span className="last-sync">
                Last synced: {new Date(lastSyncTime).toLocaleString()}
              </span>
            )}
            {syncError && (
              <span className="sync-error">⚠️ {syncError}</span>
            )}
          </div>
          <div className="tree-controls">
            <button className="btn-secondary" onClick={() => setExpandedUnits(new Set(orgUnits.map(u => u.id)))}>
              Expand All
            </button>
            <button className="btn-secondary" onClick={() => setExpandedUnits(new Set())}>
              Collapse All
            </button>
            <button
              className="btn-secondary"
              onClick={syncOrgUnits}
              disabled={isSyncing}
            >
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync from Google'}
            </button>
          </div>
        </div>

        <div className="tree-content">
          {isLoading ? (
            <div className="empty-state">
              <span className="empty-icon">⏳</span>
              <h3>Loading {label.toLowerCase()}...</h3>
            </div>
          ) : rootUnits.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🏢</span>
              <h3>No {label.toLowerCase()} found</h3>
              <p>Click "Sync from Google" to import your organizational structure</p>
              <button className="btn-primary" onClick={syncOrgUnits} disabled={isSyncing}>
                {isSyncing ? '⏳ Syncing...' : '🔄 Sync from Google'}
              </button>
            </div>
          ) : (
            rootUnits.map(unit => renderOrgUnit(unit))
          )}
        </div>
      </div>
    </div>
  );
}