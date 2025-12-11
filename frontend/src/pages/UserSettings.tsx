import { useState, useEffect } from 'react';
import {
  Settings,
  Bell,
  Globe,
  Lock,
  Palette,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import './UserSettings.css';

interface UserSettingsProps {
  organizationId: string;
}

type ThemePreference = 'light' | 'dark' | 'system';

interface UserPreferences {
  theme: ThemePreference;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  digestEmail: 'none' | 'daily' | 'weekly';
  timezone: string;
  language: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

export function UserSettings({ organizationId: _organizationId }: UserSettingsProps) {
  const [activeSection, setActiveSection] = useState<'appearance' | 'notifications' | 'regional' | 'security'>('appearance');
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    emailNotifications: true,
    desktopNotifications: false,
    digestEmail: 'weekly',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language.split('-')[0] || 'en',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem('helios_user_preferences');
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs);
        setPreferences((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved preferences');
      }
    }
  }, []);

  const handlePreferenceChange = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      // Save to localStorage
      localStorage.setItem('helios_user_preferences', JSON.stringify(updated));
      return updated;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation, save to backend
      await new Promise((resolve) => setTimeout(resolve, 500));
      localStorage.setItem('helios_user_preferences', JSON.stringify(preferences));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('helios_token')}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPasswordSuccess(true);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(false);
        }, 2000);
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const getThemeIcon = (theme: ThemePreference) => {
    switch (theme) {
      case 'light':
        return <Sun size={16} />;
      case 'dark':
        return <Moon size={16} />;
      case 'system':
        return <Monitor size={16} />;
    }
  };

  const renderNavigation = () => (
    <nav className="settings-sidebar">
      <button
        className={`settings-nav-item ${activeSection === 'appearance' ? 'active' : ''}`}
        onClick={() => setActiveSection('appearance')}
      >
        <Palette size={16} />
        <span>Appearance</span>
        <ChevronRight size={14} className="nav-arrow" />
      </button>
      <button
        className={`settings-nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
        onClick={() => setActiveSection('notifications')}
      >
        <Bell size={16} />
        <span>Notifications</span>
        <ChevronRight size={14} className="nav-arrow" />
      </button>
      <button
        className={`settings-nav-item ${activeSection === 'regional' ? 'active' : ''}`}
        onClick={() => setActiveSection('regional')}
      >
        <Globe size={16} />
        <span>Regional</span>
        <ChevronRight size={14} className="nav-arrow" />
      </button>
      <button
        className={`settings-nav-item ${activeSection === 'security' ? 'active' : ''}`}
        onClick={() => setActiveSection('security')}
      >
        <Lock size={16} />
        <span>Security</span>
        <ChevronRight size={14} className="nav-arrow" />
      </button>
    </nav>
  );

  const renderAppearance = () => (
    <div className="settings-section">
      <h2>Appearance</h2>
      <p className="section-description">Customize how Helios looks for you</p>

      <div className="setting-group">
        <label className="setting-label">Theme</label>
        <div className="theme-options">
          {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
            <button
              key={theme}
              className={`theme-option ${preferences.theme === theme ? 'selected' : ''}`}
              onClick={() => handlePreferenceChange('theme', theme)}
            >
              {getThemeIcon(theme)}
              <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
              {preferences.theme === theme && <Check size={14} className="check-icon" />}
            </button>
          ))}
        </div>
        <p className="setting-hint">
          {preferences.theme === 'system'
            ? 'Automatically matches your device settings'
            : preferences.theme === 'dark'
            ? 'Easy on the eyes in low light'
            : 'Classic light appearance'}
        </p>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="settings-section">
      <h2>Notifications</h2>
      <p className="section-description">Control how you receive updates</p>

      <div className="setting-group">
        <div className="toggle-setting">
          <div className="toggle-info">
            <label className="setting-label">Email Notifications</label>
            <p className="setting-hint">Receive important updates via email</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="setting-group">
        <div className="toggle-setting">
          <div className="toggle-info">
            <label className="setting-label">Desktop Notifications</label>
            <p className="setting-hint">Show browser notifications for updates</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.desktopNotifications}
              onChange={(e) => handlePreferenceChange('desktopNotifications', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">Email Digest</label>
        <select
          className="setting-select"
          value={preferences.digestEmail}
          onChange={(e) =>
            handlePreferenceChange('digestEmail', e.target.value as 'none' | 'daily' | 'weekly')
          }
        >
          <option value="none">No digest emails</option>
          <option value="daily">Daily summary</option>
          <option value="weekly">Weekly summary</option>
        </select>
        <p className="setting-hint">Receive a summary of activity</p>
      </div>
    </div>
  );

  const renderRegional = () => (
    <div className="settings-section">
      <h2>Regional Settings</h2>
      <p className="section-description">Set your timezone and language preferences</p>

      <div className="setting-group">
        <label className="setting-label">Timezone</label>
        <select
          className="setting-select"
          value={preferences.timezone}
          onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="setting-hint">Dates and times will be shown in this timezone</p>
      </div>

      <div className="setting-group">
        <label className="setting-label">Language</label>
        <select
          className="setting-select"
          value={preferences.language}
          onChange={(e) => handlePreferenceChange('language', e.target.value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <p className="setting-hint">Interface language (some content may remain in English)</p>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="settings-section">
      <h2>Security</h2>
      <p className="section-description">Manage your account security</p>

      <div className="setting-group">
        <div className="security-action">
          <div className="action-info">
            <label className="setting-label">Password</label>
            <p className="setting-hint">Change your account password</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowPasswordModal(true)}
          >
            Change Password
          </button>
        </div>
      </div>

      <div className="setting-group">
        <div className="security-action">
          <div className="action-info">
            <label className="setting-label">Two-Factor Authentication</label>
            <p className="setting-hint">Add an extra layer of security</p>
          </div>
          <button className="btn-secondary" disabled>
            Coming Soon
          </button>
        </div>
      </div>

      <div className="setting-group">
        <div className="security-action">
          <div className="action-info">
            <label className="setting-label">Active Sessions</label>
            <p className="setting-hint">View and manage your login sessions</p>
          </div>
          <button className="btn-secondary" disabled>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="user-settings-page">
      <div className="page-header">
        <div className="header-icon">
          <Settings size={24} />
        </div>
        <div className="header-text">
          <h1>Settings</h1>
          <p className="page-subtitle">Manage your personal preferences</p>
        </div>
      </div>

      <div className="settings-layout">
        {renderNavigation()}

        <div className="settings-content">
          {activeSection === 'appearance' && renderAppearance()}
          {activeSection === 'notifications' && renderNotifications()}
          {activeSection === 'regional' && renderRegional()}
          {activeSection === 'security' && renderSecurity()}

          <div className="settings-footer">
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check size={16} />
                  Saved
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                  minLength={8}
                />
              </div>

              {passwordError && (
                <div className="form-error">
                  <AlertCircle size={16} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="form-success">
                  <Check size={16} />
                  Password changed successfully
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
