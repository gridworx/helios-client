import { useState, useEffect } from 'react';
import { Building, MapPin, DollarSign, AlertTriangle, ChevronRight, ChevronDown, Plus, Edit2, Trash2, Users, RefreshCw } from 'lucide-react';
import './MasterDataSection.css';

interface MasterDataSectionProps {
  organizationId: string;
}

interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  manager_id: string | null;
  description: string | null;
  user_count: number;
  children?: Department[];
}

interface Location {
  id: string;
  name: string;
  type: 'region' | 'office' | 'remote';
  parent_id: string | null;
  address: string | null;
  user_count: number;
  children?: Location[];
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  user_count: number;
}

interface DataQualityIssue {
  field: string;
  value: string;
  user_count: number;
  suggested_match?: string;
}

type MasterDataTab = 'departments' | 'locations' | 'costcenters' | 'quality';

export function MasterDataSection({ organizationId }: MasterDataSectionProps) {
  const [activeTab, setActiveTab] = useState<MasterDataTab>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [qualityIssues, setQualityIssues] = useState<DataQualityIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [_editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, organizationId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('helios_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'departments':
          await fetchDepartments();
          break;
        case 'locations':
          await fetchLocations();
          break;
        case 'costcenters':
          await fetchCostCenters();
          break;
        case 'quality':
          await fetchQualityIssues();
          break;
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const response = await fetch(
      `http://localhost:3001/api/departments?organizationId=${organizationId}`,
      { headers: getAuthHeaders() }
    );
    const data = await response.json();
    if (data.success) {
      setDepartments(buildTree(data.data, 'parent_id'));
    }
  };

  const fetchLocations = async () => {
    const response = await fetch(
      `http://localhost:3001/api/locations?organizationId=${organizationId}`,
      { headers: getAuthHeaders() }
    );
    const data = await response.json();
    if (data.success) {
      setLocations(buildTree(data.data, 'parent_id'));
    }
  };

  const fetchCostCenters = async () => {
    const response = await fetch(
      `http://localhost:3001/api/cost-centers?organizationId=${organizationId}`,
      { headers: getAuthHeaders() }
    );
    const data = await response.json();
    if (data.success) {
      setCostCenters(data.data);
    }
  };

  const fetchQualityIssues = async () => {
    const response = await fetch(
      `http://localhost:3001/api/data-quality/orphans?organizationId=${organizationId}`,
      { headers: getAuthHeaders() }
    );
    const data = await response.json();
    if (data.success) {
      setQualityIssues(data.data);
    }
  };

  // Build hierarchical tree from flat list
  const buildTree = <T extends { id: string; parent_id: string | null; children?: T[] }>(
    items: T[],
    parentKey: keyof T
  ): T[] => {
    const itemMap = new Map<string, T>();
    const roots: T[] = [];

    // First pass: create map
    items.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = itemMap.get(item.id)!;
      const parentId = item[parentKey] as string | null;
      if (parentId && itemMap.has(parentId)) {
        const parent = itemMap.get(parentId)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderTreeNode = (
    item: Department | Location,
    depth: number = 0,
    type: 'department' | 'location'
  ) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    return (
      <div key={item.id}>
        <div
          className="tree-node"
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          <button
            className="expand-btn"
            onClick={() => hasChildren && toggleExpand(item.id)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="node-name">{item.name}</span>
          <span className="node-count">
            <Users size={14} />
            {item.user_count || 0}
          </span>
          <div className="node-actions">
            <button
              className="action-btn"
              onClick={() => setEditingItem({ ...item, type })}
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              className="action-btn danger"
              onClick={() => handleDelete(item.id, type)}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {item.children!.map(child =>
              renderTreeNode(child, depth + 1, type)
            )}
          </div>
        )}
      </div>
    );
  };

  const handleDelete = async (id: string, type: 'department' | 'location' | 'costcenter') => {
    if (!confirm('Are you sure you want to delete this item? Users assigned to it will need to be reassigned.')) {
      return;
    }

    const endpoints: Record<string, string> = {
      department: 'departments',
      location: 'locations',
      costcenter: 'cost-centers'
    };

    try {
      const response = await fetch(
        `http://localhost:3001/api/${endpoints[type]}/${id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      const data = await response.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete item');
    }
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Master Data</h2>
        <p>Manage organizational structure used for dynamic group rules and reporting</p>
      </div>

      <div className="masterdata-tabs">
        <button
          className={`masterdata-tab ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          <Building size={16} />
          Departments
        </button>
        <button
          className={`masterdata-tab ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin size={16} />
          Locations
        </button>
        <button
          className={`masterdata-tab ${activeTab === 'costcenters' ? 'active' : ''}`}
          onClick={() => setActiveTab('costcenters')}
        >
          <DollarSign size={16} />
          Cost Centers
        </button>
        <button
          className={`masterdata-tab ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          <AlertTriangle size={16} />
          Data Quality
          {qualityIssues.length > 0 && (
            <span className="badge">{qualityIssues.length}</span>
          )}
        </button>
      </div>

      <div className="masterdata-content">
        {isLoading ? (
          <div className="loading-state">
            <RefreshCw className="spinning" size={24} />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'departments' && (
              <div className="masterdata-panel">
                <div className="panel-header">
                  <h3>Departments</h3>
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} />
                    Add Department
                  </button>
                </div>
                <div className="tree-view">
                  {departments.length === 0 ? (
                    <div className="empty-state">
                      <Building size={48} strokeWidth={1} />
                      <h4>No departments defined</h4>
                      <p>Add departments to organize your users and enable department-based dynamic groups.</p>
                      <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={14} />
                        Add First Department
                      </button>
                    </div>
                  ) : (
                    departments.map(dept => renderTreeNode(dept, 0, 'department'))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'locations' && (
              <div className="masterdata-panel">
                <div className="panel-header">
                  <h3>Locations</h3>
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} />
                    Add Location
                  </button>
                </div>
                <div className="tree-view">
                  {locations.length === 0 ? (
                    <div className="empty-state">
                      <MapPin size={48} strokeWidth={1} />
                      <h4>No locations defined</h4>
                      <p>Add locations (regions, offices, remote) to enable location-based dynamic groups.</p>
                      <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={14} />
                        Add First Location
                      </button>
                    </div>
                  ) : (
                    locations.map(loc => renderTreeNode(loc, 0, 'location'))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'costcenters' && (
              <div className="masterdata-panel">
                <div className="panel-header">
                  <h3>Cost Centers</h3>
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} />
                    Add Cost Center
                  </button>
                </div>
                <div className="list-view">
                  {costCenters.length === 0 ? (
                    <div className="empty-state">
                      <DollarSign size={48} strokeWidth={1} />
                      <h4>No cost centers defined</h4>
                      <p>Add cost centers for budget tracking and cost center-based dynamic groups.</p>
                      <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={14} />
                        Add First Cost Center
                      </button>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Users</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costCenters.map(cc => (
                          <tr key={cc.id}>
                            <td className="code-cell">{cc.code}</td>
                            <td>{cc.name}</td>
                            <td className="count-cell">
                              <Users size={14} />
                              {cc.user_count || 0}
                            </td>
                            <td>
                              <span className={`status-badge ${cc.is_active ? 'active' : 'inactive'}`}>
                                {cc.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="action-btn"
                                  onClick={() => setEditingItem({ ...cc, type: 'costcenter' })}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="action-btn danger"
                                  onClick={() => handleDelete(cc.id, 'costcenter')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="masterdata-panel">
                <div className="panel-header">
                  <h3>Data Quality</h3>
                  <button className="btn-secondary" onClick={fetchQualityIssues}>
                    <RefreshCw size={14} />
                    Scan for Issues
                  </button>
                </div>
                <div className="quality-content">
                  {qualityIssues.length === 0 ? (
                    <div className="empty-state success">
                      <AlertTriangle size={48} strokeWidth={1} />
                      <h4>No issues found</h4>
                      <p>All user data values match master data definitions. Great job!</p>
                    </div>
                  ) : (
                    <div className="issues-list">
                      <p className="issues-summary">
                        Found {qualityIssues.length} orphaned values that don't match master data.
                      </p>
                      {qualityIssues.map((issue, idx) => (
                        <div key={idx} className="issue-card">
                          <div className="issue-header">
                            <span className="issue-field">{issue.field}</span>
                            <span className="issue-value">"{issue.value}"</span>
                          </div>
                          <div className="issue-details">
                            <span className="user-count">{issue.user_count} users affected</span>
                            {issue.suggested_match && (
                              <span className="suggested-match">
                                Did you mean: <strong>{issue.suggested_match}</strong>?
                              </span>
                            )}
                          </div>
                          <div className="issue-actions">
                            <button className="btn-secondary btn-sm">
                              Map to Existing
                            </button>
                            <button className="btn-secondary btn-sm">
                              Create New
                            </button>
                            <button className="btn-secondary btn-sm">
                              Ignore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal would go here */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Add {activeTab === 'departments' ? 'Department' : activeTab === 'locations' ? 'Location' : 'Cost Center'}</h3>
            <p>Form coming soon...</p>
            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataSection;
