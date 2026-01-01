import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Info, CheckCircle, Clock, User } from 'lucide-react';
import { securityEventsService } from '../services';
import type { SecurityEvent } from '../services';
import './SecurityEvents.css';

const SecurityEvents: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('all');
  const [acknowledging, setAcknowledging] = useState<number | null>(null);

  useEffect(() => {
    loadEvents();
  }, [severityFilter, acknowledgedFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};

      if (severityFilter !== 'all') {
        params.severity = severityFilter;
      }

      if (acknowledgedFilter === 'acknowledged') {
        params.acknowledged = true;
      } else if (acknowledgedFilter === 'unacknowledged') {
        params.acknowledged = false;
      }

      const response = await securityEventsService.getSecurityEvents(params);
      setEvents(response.data);
      setUnacknowledgedCount(response.unacknowledgedCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load security events');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (eventId: number) => {
    try {
      setAcknowledging(eventId);
      await securityEventsService.acknowledgeEvent(eventId);
      await loadEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to acknowledge event');
    } finally {
      setAcknowledging(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ShieldAlert className="severity-icon critical" />;
      case 'warning':
        return <AlertTriangle className="severity-icon warning" />;
      case 'info':
      default:
        return <Info className="severity-icon info" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    return `severity-badge ${severity}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="security-events-page">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title-section">
            <h1>Security Events</h1>
            <p className="header-subtitle">Monitor and review security events in your organization</p>
          </div>
          {unacknowledgedCount > 0 && (
            <div className="unacknowledged-badge">
              <ShieldAlert size={16} />
              {unacknowledgedCount} unacknowledged
            </div>
          )}
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select
            value={acknowledgedFilter}
            onChange={(e) => setAcknowledgedFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Events</option>
            <option value="unacknowledged">Unacknowledged</option>
            <option value="acknowledged">Acknowledged</option>
          </select>
        </div>

        <button onClick={loadEvents} className="refresh-button" disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Info box explaining Security Events */}
      <div className="info-box" style={{
        background: 'var(--color-surface-2, #f3f4f6)',
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Info size={20} style={{ color: 'var(--color-primary, #8b5cf6)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>What are Security Events?</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)' }}>
              Security Events are system-generated alerts for potential security concerns. They include:
            </p>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)' }}>
              <li><strong>Critical:</strong> Failed login attempts, suspicious activity, unauthorized access attempts</li>
              <li><strong>Warning:</strong> Unusual patterns, policy violations, configuration changes</li>
              <li><strong>Info:</strong> New device logins, password changes, permission updates</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading security events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} style={{ color: 'var(--color-success, #10b981)' }} />
          <h3>All Clear!</h3>
          <p>No security events to review. This is a good thing!</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', marginTop: '12px' }}>
            Events will appear here when suspicious activity is detected, such as failed logins,
            unusual access patterns, or policy violations.
          </p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((event) => (
            <div
              key={event.id}
              className={`event-card ${event.acknowledged ? 'acknowledged' : 'unacknowledged'}`}
            >
              <div className="event-header">
                <div className="event-severity">
                  {getSeverityIcon(event.severity)}
                  <span className={getSeverityClass(event.severity)}>
                    {event.severity.toUpperCase()}
                  </span>
                </div>
                <div className="event-time">
                  <Clock size={14} />
                  {formatDate(event.created_at)}
                </div>
              </div>

              <div className="event-content">
                <h3 className="event-title">{event.title}</h3>
                <p className="event-description">{event.description}</p>

                {event.user_email && (
                  <div className="event-user">
                    <User size={14} />
                    {event.user_email}
                  </div>
                )}

                {event.details && (
                  <div className="event-details">
                    <details>
                      <summary>View details</summary>
                      <pre>{JSON.stringify(event.details, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>

              <div className="event-footer">
                <div className="event-source">
                  Source: {event.source}
                </div>
                {event.acknowledged ? (
                  <div className="acknowledged-info">
                    <CheckCircle size={14} />
                    Acknowledged {event.acknowledged_at && formatDate(event.acknowledged_at)}
                  </div>
                ) : (
                  <button
                    onClick={() => handleAcknowledge(event.id)}
                    disabled={acknowledging === event.id}
                    className="acknowledge-button"
                  >
                    {acknowledging === event.id ? 'Acknowledging...' : 'Acknowledge'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecurityEvents;
