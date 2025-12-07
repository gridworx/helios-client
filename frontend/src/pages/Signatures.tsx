import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Users,
  BarChart3,
  Search,
  Filter,
  Settings,
  Play,
  Pause,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  Target,
  TrendingUp
} from 'lucide-react';
import './Signatures.css';

interface SignatureTemplate {
  id: string;
  name: string;
  description: string;
  html_content: string;
  plain_text_content?: string;
  category: string;
  variables_used: string[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  assignment_count: number;
  usage_count: number;
}

interface SignatureCampaign {
  id: string;
  name: string;
  description: string;
  template_id: string;
  template_name: string;
  target_type: 'all' | 'users' | 'groups' | 'departments' | 'org_units';
  target_ids: string[];
  priority: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
  created_by_name: string;
  approval_status?: string;
  approved_by_name?: string;
  approved_at?: string;
  applied_count: number;
  total_target_count: number;
}

const Signatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns' | 'analytics'>('templates');
  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<SignatureCampaign[]>([]);
  const [_selectedTemplate, setSelectedTemplate] = useState<SignatureTemplate | null>(null);
  const [_selectedCampaign, setSelectedCampaign] = useState<SignatureCampaign | null>(null);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    } else if (activeTab === 'campaigns') {
      fetchCampaigns();
    }
  }, [activeTab]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Fetch templates from Template Studio API filtered by email_signature type
      const response = await fetch('http://localhost:3001/api/templates?template_type=email_signature', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('helios_token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/signatures/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/signatures/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleCampaignStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/signatures/campaigns/${campaignId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (data.success) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error updating campaign status:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      const response = await fetch('/api/signatures/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert(`Signature sync initiated for ${data.data.userCount} users`);
      }
    } catch (error) {
      console.error('Error initiating sync:', error);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'badge-active';
      case 'approved': return 'badge-approved';
      case 'draft': return 'badge-draft';
      case 'pending_approval': return 'badge-pending';
      case 'paused': return 'badge-paused';
      case 'completed': return 'badge-completed';
      case 'cancelled': return 'badge-cancelled';
      default: return 'badge-default';
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="signatures-container">
      <div className="signatures-header">
        <div className="header-content">
          <h1>Email Signature Management</h1>
          <p>Create and manage email signature templates and campaigns</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleManualSync}>
            <Play size={16} />
            Manual Sync
          </button>
          <button className="btn-primary" onClick={() => {
            if (activeTab === 'templates') {
              // Redirect to Template Studio for unified template creation
              window.location.href = '/templates?type=email_signature';
            } else if (activeTab === 'campaigns') {
              setShowCampaignWizard(true);
            }
          }}>
            <Plus size={16} />
            {activeTab === 'templates' ? 'New Template' : 'New Campaign'}
          </button>
        </div>
      </div>

      <div className="signatures-tabs">
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={16} />
          Templates
        </button>
        <button
          className={`tab-button ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <Target size={16} />
          Campaigns
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          Analytics
        </button>
      </div>

      {activeTab === 'templates' && (
        <div className="templates-section">
          <div className="section-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No templates found</h3>
              <p>Create your first signature template to get started</p>
              <button className="btn-primary" onClick={() => window.location.href = '/templates?type=email_signature'}>
                <Plus size={16} />
                Create Template
              </button>
            </div>
          ) : (
            <div className="templates-grid">
              {filteredTemplates.map(template => (
                <div key={template.id} className="template-card">
                  <div className="template-header">
                    <h3>{template.name}</h3>
                    <div className="template-badges">
                      {template.is_default && <span className="badge badge-primary">Default</span>}
                      {template.is_active ? (
                        <span className="badge badge-active">Active</span>
                      ) : (
                        <span className="badge badge-inactive">Inactive</span>
                      )}
                    </div>
                  </div>
                  <p className="template-description">{template.description}</p>
                  <div className="template-stats">
                    <div className="stat">
                      <Users size={14} />
                      <span>{template.assignment_count} assignments</span>
                    </div>
                    <div className="stat">
                      <CheckCircle size={14} />
                      <span>{template.usage_count} users</span>
                    </div>
                  </div>
                  <div className="template-preview"
                       dangerouslySetInnerHTML={{ __html: template.html_content.substring(0, 200) + '...' }} />
                  <div className="template-actions">
                    <button className="btn-icon" onClick={() => window.location.href = `/templates?edit=${template.id}`} title="Edit template">
                      <Edit3 size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => {
                      setSelectedTemplate(template);
                      setShowCampaignWizard(true);
                    }} title="Create campaign">
                      <Target size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDeleteTemplate(template.id)} title="Delete template">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="campaigns-section">
          <div className="section-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-dropdown">
              <Filter size={16} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading campaigns...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="empty-state">
              <Target size={48} />
              <h3>No campaigns found</h3>
              <p>Create your first signature campaign to engage your audience</p>
              <button className="btn-primary" onClick={() => setShowCampaignWizard(true)}>
                <Plus size={16} />
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="campaigns-list">
              {filteredCampaigns.map(campaign => (
                <div key={campaign.id} className="campaign-card">
                  <div className="campaign-header">
                    <div className="campaign-info">
                      <h3>{campaign.name}</h3>
                      <p>{campaign.description}</p>
                    </div>
                    <span className={`status-badge ${getStatusBadgeClass(campaign.status)}`}>
                      {campaign.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="campaign-details">
                    <div className="detail-group">
                      <span className="detail-label">Template:</span>
                      <span className="detail-value">{campaign.template_name}</span>
                    </div>
                    <div className="detail-group">
                      <span className="detail-label">Target:</span>
                      <span className="detail-value">{campaign.target_type}</span>
                    </div>
                    <div className="detail-group">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">
                        {new Date(campaign.start_date).toLocaleDateString()} - {new Date(campaign.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="detail-group">
                      <span className="detail-label">Progress:</span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{width: `${(campaign.applied_count / campaign.total_target_count) * 100}%`}}
                        />
                      </div>
                      <span className="detail-value">{campaign.applied_count}/{campaign.total_target_count}</span>
                    </div>
                  </div>
                  <div className="campaign-actions">
                    {campaign.status === 'draft' && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleCampaignStatusChange(campaign.id, 'pending_approval')}
                      >
                        Submit for Approval
                      </button>
                    )}
                    {campaign.status === 'approved' && (
                      <button
                        className="btn-primary"
                        onClick={() => handleCampaignStatusChange(campaign.id, 'active')}
                      >
                        <Play size={16} />
                        Activate
                      </button>
                    )}
                    {campaign.status === 'active' && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleCampaignStatusChange(campaign.id, 'paused')}
                      >
                        <Pause size={16} />
                        Pause
                      </button>
                    )}
                    {campaign.status === 'paused' && (
                      <button
                        className="btn-primary"
                        onClick={() => handleCampaignStatusChange(campaign.id, 'active')}
                      >
                        <Play size={16} />
                        Resume
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => setSelectedCampaign(campaign)}>
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="analytics-section">
          <div className="empty-state" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <BarChart3 size={64} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
              Analytics Dashboard Coming Soon
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              Campaign performance metrics, template usage statistics, and signature sync analytics will be available here.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              maxWidth: '900px',
              margin: '2rem auto 0',
              textAlign: 'left'
            }}>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <TrendingUp size={20} style={{ color: 'var(--theme-primary)', marginBottom: '0.5rem' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.25rem' }}>
                  Campaign Performance
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Track active campaigns, success rates, and signature deployment metrics
                </p>
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <FileText size={20} style={{ color: 'var(--theme-primary)', marginBottom: '0.5rem' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.25rem' }}>
                  Template Analytics
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Monitor template usage, assignments, and email delivery statistics
                </p>
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <Clock size={20} style={{ color: 'var(--theme-primary)', marginBottom: '0.5rem' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.25rem' }}>
                  Sync Monitoring
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  View sync schedules, completion status, and error logs
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor is now in Template Studio - no need for modal here */}

      {/* Campaign Wizard Modal - TODO: Implement */}
      {showCampaignWizard && (
        <div className="modal-overlay" onClick={() => setShowCampaignWizard(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Campaign</h2>
              <button className="btn-close" onClick={() => setShowCampaignWizard(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Campaign creation wizard will be implemented here with targeting options and scheduling</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signatures;