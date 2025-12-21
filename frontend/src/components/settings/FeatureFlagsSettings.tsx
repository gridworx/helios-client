import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, AlertCircle, Check } from 'lucide-react';
import { Toggle } from '../ui';
import './FeatureFlagsSettings.css';

interface FeatureFlag {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
}

interface GroupedFlags {
  [category: string]: FeatureFlag[];
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation & Menus',
  automation: 'Automation Features',
  signatures: 'Email Signatures',
  insights: 'Insights & Reports',
  integrations: 'Integrations',
  users: 'User Management',
  console: 'Developer Console',
  general: 'General',
};

const CATEGORY_ORDER = ['navigation', 'automation', 'assets', 'signatures', 'insights', 'integrations', 'users', 'console', 'general'];

export function FeatureFlagsSettings() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('helios_token');
      const response = await fetch('/api/v1/organization/feature-flags/details', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setFlags(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const toggleFlag = async (featureKey: string, currentValue: boolean) => {
    try {
      setUpdating(featureKey);
      setError(null);
      const token = localStorage.getItem('helios_token');
      const response = await fetch(`/api/v1/organization/feature-flags/${featureKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: !currentValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update feature flag');
      }

      // Update local state
      setFlags(prev => prev.map(f =>
        f.feature_key === featureKey ? { ...f, is_enabled: !currentValue } : f
      ));

      setSuccess(featureKey);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    } finally {
      setUpdating(null);
    }
  };

  // Group flags by category
  const groupedFlags: GroupedFlags = flags.reduce((acc, flag) => {
    const category = flag.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(flag);
    return acc;
  }, {} as GroupedFlags);

  // Sort categories
  const sortedCategories = Object.keys(groupedFlags).sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  if (loading) {
    return (
      <div className="feature-flags-loading">
        <Loader2 className="spin" size={24} />
        <span>Loading feature flags...</span>
      </div>
    );
  }

  return (
    <div className="feature-flags-settings">
      <div className="ff-header">
        <div className="ff-header-info">
          <h3>Feature Flags</h3>
          <p>Enable or disable features and navigation items</p>
        </div>
        <button className="btn-icon" onClick={fetchFlags} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="ff-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="ff-categories">
        {sortedCategories.map(category => (
          <div key={category} className="ff-category">
            <div className="ff-category-header">
              {CATEGORY_LABELS[category] || category}
            </div>
            <div className="ff-list">
              {groupedFlags[category].map(flag => (
                <div key={flag.id} className="ff-item">
                  <div className="ff-item-info">
                    <span className="ff-item-name">{flag.name}</span>
                    {flag.description && (
                      <span className="ff-item-desc">{flag.description}</span>
                    )}
                    <span className="ff-item-key">{flag.feature_key}</span>
                  </div>
                  <div className="ff-item-toggle">
                    {updating === flag.feature_key ? (
                      <Loader2 className="spin" size={16} />
                    ) : success === flag.feature_key ? (
                      <Check size={16} className="ff-success" />
                    ) : (
                      <Toggle
                        checked={flag.is_enabled}
                        onChange={() => toggleFlag(flag.feature_key, flag.is_enabled)}
                        size="small"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ff-note">
        <AlertCircle size={14} />
        <span>Changes take effect immediately. Some changes may require a page refresh.</span>
      </div>
    </div>
  );
}
