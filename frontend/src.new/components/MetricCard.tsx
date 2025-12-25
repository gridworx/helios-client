import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export type MetricCardSize = 'small' | 'medium' | 'large';
export type MetricState = 'default' | 'success' | 'warning' | 'error';

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  label: string;
  footer?: string;
  state?: MetricState;
  size?: MetricCardSize;
  platformColor?: string;
  trend?: 'up' | 'down' | null;
  trendValue?: string;
  onClick?: () => void;
  gridColumn?: number; // For 12-column grid positioning
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  title,
  value,
  label,
  footer,
  state = 'default',
  size = 'small',
  platformColor: _platformColor, // Reserved for future styling
  trend,
  trendValue,
  onClick,
  gridColumn = 3, // Default to 3 columns (25% width)
}) => {
  const stateColors = {
    default: '#111827',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
  };

  const valueColor = stateColors[state];

  return (
    <div
      className={`metric-card metric-card-${size} metric-card-${state}`}
      onClick={onClick}
      style={{
        gridColumn: `span ${gridColumn}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Header */}
      <div className="metric-card-header">
        <div className="metric-card-icon">{icon}</div>
        <span className="metric-card-title">{title}</span>
      </div>

      {/* Main Value */}
      <div className="metric-card-body">
        <div className="metric-card-value" style={{ color: valueColor }}>
          {state === 'warning' && <AlertTriangle size={16} className="metric-warning-icon" />}
          {value}
        </div>
        <div className="metric-card-label">{label}</div>
      </div>

      {/* Footer with trend or timestamp */}
      {(footer || trend) && (
        <div className="metric-card-footer">
          {trend && (
            <div className={`metric-trend metric-trend-${trend}`}>
              {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
          {footer && <span className="metric-footer-text">{footer}</span>}
        </div>
      )}
    </div>
  );
};
