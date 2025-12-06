import React, { useState, useEffect } from 'react';
import { Activity, User, Clock, Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { auditLogsService } from '../services';
import type { AuditLog } from '../services';
import './AuditLogs.css';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const itemsPerPage = 50;

  useEffect(() => {
    loadLogs();
  }, [actionFilter, startDate, endDate, currentPage]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      if (actionFilter) params.action = actionFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchTerm) params.search = searchTerm;

      const response = await auditLogsService.getAuditLogs(params);
      setLogs(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadLogs();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params: any = {};
      if (actionFilter) params.action = actionFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      await auditLogsService.exportAuditLogs(params);
    } catch (err: any) {
      setError(err.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'action-create';
    if (action.includes('update') || action.includes('edit')) return 'action-update';
    if (action.includes('delete') || action.includes('remove')) return 'action-delete';
    if (action.includes('login') || action.includes('auth')) return 'action-auth';
    return 'action-default';
  };

  const getActorName = (log: AuditLog) => {
    if (log.actor_first_name && log.actor_last_name) {
      return `${log.actor_first_name} ${log.actor_last_name}`;
    }
    return log.actor_email || 'System';
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort();

  return (
    <div className="audit-logs-page">
      <div className="page-header">
        <div className="header-title-section">
          <h1>Audit Logs</h1>
          <p className="header-subtitle">View detailed activity logs for your organization</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading}
          className="export-button"
        >
          <Download size={16} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="filters-section">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search descriptions or metadata..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-button">
            Search
          </button>
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>
              <Filter size={14} />
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <Clock size={14} />
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="date-input"
            />
          </div>

          <div className="filter-group">
            <label>
              <Clock size={14} />
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="date-input"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <Activity size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading audit logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>No audit logs found</h3>
          <p>No activity logs match your current filters</p>
        </div>
      ) : (
        <>
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Description</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="timestamp-cell">
                      <Clock size={14} />
                      {formatDate(log.created_at)}
                    </td>
                    <td className="actor-cell">
                      <User size={14} />
                      <div className="actor-info">
                        <span className="actor-name">{getActorName(log)}</span>
                        {log.actor_email && (
                          <span className="actor-email">{log.actor_email}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`action-badge ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="resource-cell">
                      {log.resource_type && (
                        <div className="resource-info">
                          <span className="resource-type">{log.resource_type}</span>
                          {log.resource_id && (
                            <span className="resource-id">#{log.resource_id}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="description-cell">
                      {log.description}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="metadata-details">
                          <summary>View metadata</summary>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                    <td className="ip-cell">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={logs.length < itemsPerPage}
              className="pagination-button"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogs;
