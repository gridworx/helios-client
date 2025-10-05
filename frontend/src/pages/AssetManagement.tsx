import { useState } from 'react';
import './Pages.css';

interface Asset {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  assignedTo: string | null;
  status: string;
  location: string;
  purchaseDate: string;
  value: number;
}

interface AssetManagementProps {
  organizationId: string;
}

export function AssetManagement({ organizationId }: AssetManagementProps) {
  const [assets, setAssets] = useState<Asset[]>([
    {
      id: '1',
      name: 'MacBook Pro 16"',
      type: 'Laptop',
      serialNumber: 'MBP-2023-001',
      assignedTo: 'john.doe@gridworx.io',
      status: 'Active',
      location: 'San Francisco Office',
      purchaseDate: '2023-06-15',
      value: 2999
    },
    {
      id: '2',
      name: 'Dell UltraSharp 27"',
      type: 'Monitor',
      serialNumber: 'DELL-MON-2023-045',
      assignedTo: 'jane.smith@gridworx.io',
      status: 'Active',
      location: 'New York Office',
      purchaseDate: '2023-08-20',
      value: 599
    },
    {
      id: '3',
      name: 'iPhone 15 Pro',
      type: 'Mobile Device',
      serialNumber: 'IP15-2024-789',
      assignedTo: 'mike@gridworx.io',
      status: 'Active',
      location: 'Remote',
      purchaseDate: '2024-01-10',
      value: 1199
    }
  ]);

  const [activeView, setActiveView] = useState<'devices' | 'software' | 'licenses'>('devices');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'Laptop': '💻',
      'Monitor': '🖥️',
      'Mobile Device': '📱',
      'Tablet': '📱',
      'Printer': '🖨️',
      'Server': '🖲️',
      'Network': '🌐',
      'default': '📦'
    };
    return icons[type] || icons.default;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Active': '#4caf50',
      'Inactive': '#f44336',
      'Maintenance': '#ff9800',
      'Retired': '#9e9e9e'
    };
    return colors[status] || '#9e9e9e';
  };

  const filteredAssets = assets.filter(asset => {
    const matchesType = filterType === 'all' || asset.type === filterType;
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (asset.assignedTo && asset.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Asset Management</h1>
          <p>Track and manage organization devices, software, and licenses</p>
        </div>
        <button className="btn-primary">
          ➕ Add Asset
        </button>
      </div>

      <div className="asset-tabs">
        <button
          className={`tab-button ${activeView === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveView('devices')}
        >
          💻 Devices
        </button>
        <button
          className={`tab-button ${activeView === 'software' ? 'active' : ''}`}
          onClick={() => setActiveView('software')}
        >
          📀 Software
        </button>
        <button
          className={`tab-button ${activeView === 'licenses' ? 'active' : ''}`}
          onClick={() => setActiveView('licenses')}
        >
          🔑 Licenses
        </button>
      </div>

      {activeView === 'devices' && (
        <>
          <div className="page-controls">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search assets, serial numbers, or users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="Laptop">Laptops</option>
              <option value="Monitor">Monitors</option>
              <option value="Mobile Device">Mobile Devices</option>
              <option value="Tablet">Tablets</option>
              <option value="Printer">Printers</option>
            </select>

            <button className="btn-secondary">
              📊 Export Inventory
            </button>
          </div>

          <div className="data-grid">
            <div className="grid-header">
              <div className="col-wide">Asset Details</div>
              <div className="col-medium">Assigned To</div>
              <div className="col-small">Status</div>
              <div className="col-medium">Location</div>
              <div className="col-small">Value</div>
              <div className="col-small">Actions</div>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📦</span>
                <h3>No assets found</h3>
                <p>Start by adding your organization's devices and equipment</p>
              </div>
            ) : (
              <div className="grid-body">
                {filteredAssets.map(asset => (
                  <div key={asset.id} className="grid-row">
                    <div className="col-wide">
                      <div className="item-info">
                        <div className="item-icon" style={{ fontSize: '24px' }}>
                          {getTypeIcon(asset.type)}
                        </div>
                        <div>
                          <div className="item-name">{asset.name}</div>
                          <div className="item-description">
                            {asset.type} • {asset.serialNumber}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-medium">
                      <span className="email-text">
                        {asset.assignedTo || 'Unassigned'}
                      </span>
                    </div>
                    <div className="col-small">
                      <span
                        className="type-badge"
                        style={{
                          backgroundColor: getStatusColor(asset.status),
                          color: 'white'
                        }}
                      >
                        {asset.status}
                      </span>
                    </div>
                    <div className="col-medium">
                      <span className="location-text">{asset.location}</span>
                    </div>
                    <div className="col-small">
                      <span className="value-text">${asset.value}</span>
                    </div>
                    <div className="col-small">
                      <div className="action-buttons">
                        <button className="btn-icon" title="View details">👁️</button>
                        <button className="btn-icon" title="Edit asset">✏️</button>
                        <button className="btn-icon danger" title="Retire asset">🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="asset-summary">
            <div className="summary-card">
              <div className="summary-label">Total Assets</div>
              <div className="summary-value">{assets.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Value</div>
              <div className="summary-value">
                ${assets.reduce((sum, asset) => sum + asset.value, 0).toLocaleString()}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Assigned</div>
              <div className="summary-value">
                {assets.filter(a => a.assignedTo).length}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Available</div>
              <div className="summary-value">
                {assets.filter(a => !a.assignedTo).length}
              </div>
            </div>
          </div>
        </>
      )}

      {activeView === 'software' && (
        <div className="empty-state">
          <span className="empty-icon">📀</span>
          <h3>Software Management</h3>
          <p>Track installed software, versions, and compliance across your organization</p>
          <button className="btn-primary">Coming Soon</button>
        </div>
      )}

      {activeView === 'licenses' && (
        <div className="empty-state">
          <span className="empty-icon">🔑</span>
          <h3>License Management</h3>
          <p>Manage software licenses, renewals, and compliance tracking</p>
          <button className="btn-primary">Coming Soon</button>
        </div>
      )}
    </div>
  );
}