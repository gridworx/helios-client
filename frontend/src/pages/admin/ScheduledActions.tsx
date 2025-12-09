/**
 * Scheduled Actions Page
 *
 * View and manage scheduled user lifecycle actions (onboarding, offboarding, etc.)
 * Supports calendar and list views, filtering, cancellation, and approval workflows.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  List,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  Pause,
  Play,
  Trash2,
  X,
  Check,
  Eye,
} from 'lucide-react';
import ActionTimeline from '../../components/lifecycle/ActionTimeline';
import './ScheduledActions.css';

// Types
interface ScheduledAction {
  id: string;
  userId?: string;
  targetEmail?: string;
  targetFirstName?: string;
  targetLastName?: string;
  actionType: 'onboard' | 'offboard' | 'suspend' | 'unsuspend' | 'delete' | 'restore' | 'manual';
  onboardingTemplateId?: string;
  offboardingTemplateId?: string;
  templateName?: string;
  scheduledFor: string;
  isRecurring: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  totalSteps: number;
  completedSteps: number;
  currentStep?: string;
  errorMessage?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActionLog {
  id: string;
  actionStep: string;
  stepDescription?: string;
  stepOrder: number;
  status: 'success' | 'failed' | 'pending' | 'skipped' | 'warning';
  durationMs?: number;
  errorMessage?: string;
  executedAt?: string;
  details?: Record<string, unknown>;
}

interface ScheduledActionsProps {
  organizationId: string;
}

// Action type labels and icons
const actionTypeConfig: Record<string, { label: string; color: string }> = {
  onboard: { label: 'Onboard', color: '#10b981' },
  offboard: { label: 'Offboard', color: '#f59e0b' },
  suspend: { label: 'Suspend', color: '#ef4444' },
  unsuspend: { label: 'Unsuspend', color: '#3b82f6' },
  delete: { label: 'Delete', color: '#dc2626' },
  restore: { label: 'Restore', color: '#8b5cf6' },
  manual: { label: 'Manual', color: '#6b7280' },
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: '#6b7280', bgColor: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#6d28d9', bgColor: '#ede9fe' },
  completed: { label: 'Completed', color: '#065f46', bgColor: '#d1fae5' },
  failed: { label: 'Failed', color: '#991b1b', bgColor: '#fee2e2' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bgColor: '#f3f4f6' },
};

const ScheduledActions: React.FC<ScheduledActionsProps> = ({ organizationId }) => {
  // State
  const [actions, setActions] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<ScheduledAction | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Fetch scheduled actions
  const fetchActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('helios_token');
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('actionType', filterType);

      const response = await fetch(
        `http://localhost:3001/api/lifecycle/scheduled-actions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch scheduled actions');
      }

      const data = await response.json();
      if (data.success) {
        setActions(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch scheduled actions');
      }
    } catch (err: any) {
      console.error('Error fetching actions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch action logs
  const fetchActionLogs = async (actionId: string) => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/lifecycle/logs?actionId=${actionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch action logs');
      }

      const data = await response.json();
      if (data.success) {
        setActionLogs(data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching action logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [organizationId, filterStatus, filterType]);

  // Handle action selection
  const handleSelectAction = (action: ScheduledAction) => {
    setSelectedAction(action);
    fetchActionLogs(action.id);
  };

  // Cancel action
  const handleCancelAction = async () => {
    if (!showCancelModal) return;

    setCancelLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch(
        `http://localhost:3001/api/lifecycle/scheduled-actions/${showCancelModal}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: cancelReason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel action');
      }

      // Refresh actions list
      fetchActions();
      setShowCancelModal(null);
      setCancelReason('');

      // If this was the selected action, close the detail panel
      if (selectedAction?.id === showCancelModal) {
        setSelectedAction(null);
      }
    } catch (err: any) {
      console.error('Error cancelling action:', err);
      setError(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  // Approve/Reject action
  const handleApprovalAction = async () => {
    if (!showApprovalModal) return;

    setApprovalLoading(true);
    try {
      const token = localStorage.getItem('helios_token');
      const endpoint =
        showApprovalModal.type === 'approve'
          ? `http://localhost:3001/api/lifecycle/scheduled-actions/${showApprovalModal.id}/approve`
          : `http://localhost:3001/api/lifecycle/scheduled-actions/${showApprovalModal.id}/reject`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          showApprovalModal.type === 'approve'
            ? { notes: approvalNotes }
            : { reason: approvalNotes }
        ),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${showApprovalModal.type} action`);
      }

      // Refresh actions list
      fetchActions();
      setShowApprovalModal(null);
      setApprovalNotes('');
    } catch (err: any) {
      console.error('Error with approval action:', err);
      setError(err.message);
    } finally {
      setApprovalLoading(false);
    }
  };

  // Filter actions
  const filteredActions = actions.filter((action) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const targetName = `${action.targetFirstName || ''} ${action.targetLastName || ''}`.toLowerCase();
      if (
        !targetName.includes(query) &&
        !action.targetEmail?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Group actions by date for calendar view
  const actionsByDate = filteredActions.reduce((acc, action) => {
    const date = new Date(action.scheduledFor).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(action);
    return acc;
  }, {} as Record<string, ScheduledAction[]>);

  // Get action type icon
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'onboard':
        return <UserPlus size={16} />;
      case 'offboard':
        return <UserMinus size={16} />;
      case 'suspend':
        return <Pause size={16} />;
      case 'unsuspend':
        return <Play size={16} />;
      case 'delete':
        return <Trash2 size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} />;
      case 'failed':
        return <XCircle size={14} />;
      case 'cancelled':
        return <X size={14} />;
      case 'in_progress':
        return <RefreshCw size={14} className="animate-spin" />;
      default:
        return <Clock size={14} />;
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="scheduled-actions-page">
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={24} />
          <span>Loading scheduled actions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduled-actions-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Scheduled Actions</h1>
          <p className="header-subtitle">
            View and manage upcoming user lifecycle actions
          </p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Calendar view"
            >
              <Calendar size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <Filter size={14} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="onboard">Onboarding</option>
              <option value="offboard">Offboarding</option>
              <option value="suspend">Suspend</option>
              <option value="unsuspend">Unsuspend</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        </div>

        <button className="btn-secondary" onClick={fetchActions}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`content-area ${selectedAction ? 'with-panel' : ''}`}>
        {/* Actions List */}
        {filteredActions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Clock size={48} />
            </div>
            <h2>No scheduled actions</h2>
            <p>
              {actions.length === 0
                ? 'Schedule user onboarding or offboarding to see actions here.'
                : 'No actions match your current filters.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="actions-list">
            <table className="actions-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Scheduled For</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredActions.map((action) => (
                  <tr
                    key={action.id}
                    className={`${selectedAction?.id === action.id ? 'selected' : ''} ${action.requiresApproval && action.status === 'pending' && !action.approvedAt ? 'requires-approval' : ''}`}
                    onClick={() => handleSelectAction(action)}
                  >
                    <td className="user-cell">
                      <div className="user-info">
                        <span className="user-name">
                          {action.targetFirstName} {action.targetLastName}
                        </span>
                        <span className="user-email">{action.targetEmail}</span>
                      </div>
                    </td>
                    <td className="action-type-cell">
                      <span
                        className="action-type-badge"
                        style={{
                          color: actionTypeConfig[action.actionType]?.color || '#6b7280',
                        }}
                      >
                        {getActionIcon(action.actionType)}
                        {actionTypeConfig[action.actionType]?.label || action.actionType}
                      </span>
                    </td>
                    <td className="date-cell">
                      <span className="date">
                        {new Date(action.scheduledFor).toLocaleDateString()}
                      </span>
                      <span className="time">
                        {new Date(action.scheduledFor).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="status-cell">
                      <span
                        className="status-badge"
                        style={{
                          color: statusConfig[action.status]?.color,
                          backgroundColor: statusConfig[action.status]?.bgColor,
                        }}
                      >
                        {getStatusIcon(action.status)}
                        {statusConfig[action.status]?.label}
                      </span>
                      {action.requiresApproval && action.status === 'pending' && !action.approvedAt && (
                        <span className="approval-badge">Needs Approval</span>
                      )}
                    </td>
                    <td className="progress-cell">
                      {action.totalSteps > 0 && (
                        <div className="progress-wrapper">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${(action.completedSteps / action.totalSteps) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="progress-text">
                            {action.completedSteps}/{action.totalSteps}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAction(action);
                        }}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      {action.status === 'pending' && (
                        <>
                          {action.requiresApproval && !action.approvedAt && (
                            <>
                              <button
                                className="icon-btn approve"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowApprovalModal({ id: action.id, type: 'approve' });
                                }}
                                title="Approve"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                className="icon-btn reject"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowApprovalModal({ id: action.id, type: 'reject' });
                                }}
                                title="Reject"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            className="icon-btn cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCancelModal(action.id);
                            }}
                            title="Cancel"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Calendar View */
          <div className="calendar-view">
            {Object.entries(actionsByDate)
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([date, dateActions]) => (
                <div key={date} className="calendar-day">
                  <div className="day-header">
                    <span className="day-date">
                      {new Date(date).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="day-count">{dateActions.length} actions</span>
                  </div>
                  <div className="day-actions">
                    {dateActions.map((action) => (
                      <div
                        key={action.id}
                        className={`calendar-action ${action.status}`}
                        onClick={() => handleSelectAction(action)}
                      >
                        <span
                          className="action-indicator"
                          style={{
                            backgroundColor: actionTypeConfig[action.actionType]?.color,
                          }}
                        />
                        <div className="action-info">
                          <span className="action-name">
                            {action.targetFirstName} {action.targetLastName}
                          </span>
                          <span className="action-type">
                            {actionTypeConfig[action.actionType]?.label}
                          </span>
                        </div>
                        <span className="action-time">
                          {new Date(action.scheduledFor).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Detail Panel */}
        {selectedAction && (
          <div className="detail-panel">
            <div className="panel-header">
              <h3>Action Details</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedAction(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="panel-content">
              <div className="detail-section">
                <h4>Target User</h4>
                <div className="detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">
                    {selectedAction.targetFirstName} {selectedAction.targetLastName}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedAction.targetEmail}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>Action Info</h4>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span
                    className="action-type-badge"
                    style={{
                      color: actionTypeConfig[selectedAction.actionType]?.color,
                    }}
                  >
                    {getActionIcon(selectedAction.actionType)}
                    {actionTypeConfig[selectedAction.actionType]?.label}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span
                    className="status-badge"
                    style={{
                      color: statusConfig[selectedAction.status]?.color,
                      backgroundColor: statusConfig[selectedAction.status]?.bgColor,
                    }}
                  >
                    {getStatusIcon(selectedAction.status)}
                    {statusConfig[selectedAction.status]?.label}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Scheduled For</span>
                  <span className="detail-value">
                    {new Date(selectedAction.scheduledFor).toLocaleString()}
                  </span>
                </div>
                {selectedAction.isRecurring && (
                  <div className="detail-row">
                    <span className="detail-label">Recurrence</span>
                    <span className="detail-value">{selectedAction.recurrenceInterval}</span>
                  </div>
                )}
              </div>

              {selectedAction.requiresApproval && (
                <div className="detail-section">
                  <h4>Approval</h4>
                  {selectedAction.approvedAt ? (
                    <div className="approval-info approved">
                      <CheckCircle size={16} />
                      <span>Approved on {new Date(selectedAction.approvedAt).toLocaleString()}</span>
                    </div>
                  ) : selectedAction.rejectedAt ? (
                    <div className="approval-info rejected">
                      <XCircle size={16} />
                      <span>Rejected: {selectedAction.rejectionReason}</span>
                    </div>
                  ) : (
                    <div className="approval-actions">
                      <button
                        className="btn-primary"
                        onClick={() =>
                          setShowApprovalModal({ id: selectedAction.id, type: 'approve' })
                        }
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          setShowApprovalModal({ id: selectedAction.id, type: 'reject' })
                        }
                      >
                        <X size={14} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedAction.errorMessage && (
                <div className="detail-section">
                  <h4>Error</h4>
                  <div className="error-message">
                    <AlertCircle size={16} />
                    {selectedAction.errorMessage}
                  </div>
                </div>
              )}

              <div className="detail-section timeline-section">
                <h4>Execution Timeline</h4>
                {logsLoading ? (
                  <div className="loading-state small">
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Loading...</span>
                  </div>
                ) : actionLogs.length > 0 ? (
                  <ActionTimeline
                    steps={actionLogs.map((log) => ({
                      id: log.id,
                      step: log.actionStep,
                      stepDescription: log.stepDescription,
                      stepOrder: log.stepOrder,
                      status: log.status,
                      durationMs: log.durationMs,
                      errorMessage: log.errorMessage,
                      executedAt: log.executedAt,
                      details: log.details,
                    }))}
                    actionType={selectedAction.actionType}
                  />
                ) : (
                  <p className="no-logs">No execution logs yet.</p>
                )}
              </div>

              {selectedAction.status === 'pending' && (
                <div className="panel-actions">
                  <button
                    className="btn-danger"
                    onClick={() => setShowCancelModal(selectedAction.id)}
                  >
                    <XCircle size={14} />
                    Cancel Action
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cancel Scheduled Action</h3>
            <p>Are you sure you want to cancel this action? This cannot be undone.</p>
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCancelModal(null);
                  setCancelReason('');
                }}
                disabled={cancelLoading}
              >
                Keep Action
              </button>
              <button
                className="btn-danger"
                onClick={handleCancelAction}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Action'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>
              {showApprovalModal.type === 'approve' ? 'Approve Action' : 'Reject Action'}
            </h3>
            <p>
              {showApprovalModal.type === 'approve'
                ? 'This action will be executed at the scheduled time.'
                : 'This action will be cancelled and marked as rejected.'}
            </p>
            <div className="form-group">
              <label>
                {showApprovalModal.type === 'approve' ? 'Notes (optional)' : 'Reason (required)'}
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={
                  showApprovalModal.type === 'approve'
                    ? 'Add any notes...'
                    : 'Enter reason for rejection...'
                }
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowApprovalModal(null);
                  setApprovalNotes('');
                }}
                disabled={approvalLoading}
              >
                Cancel
              </button>
              <button
                className={showApprovalModal.type === 'approve' ? 'btn-primary' : 'btn-danger'}
                onClick={handleApprovalAction}
                disabled={
                  approvalLoading ||
                  (showApprovalModal.type === 'reject' && !approvalNotes.trim())
                }
              >
                {approvalLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Processing...
                  </>
                ) : showApprovalModal.type === 'approve' ? (
                  <>
                    <Check size={14} />
                    Approve
                  </>
                ) : (
                  <>
                    <X size={14} />
                    Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledActions;
