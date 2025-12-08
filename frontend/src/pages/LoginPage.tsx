import { useState } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: (organizationData: any) => void;
  organizationDomain?: string;
  organizationName?: string;
}

export function LoginPage({ onLoginSuccess, organizationDomain: _organizationDomain, organizationName }: LoginPageProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.success) {
        // Store organization auth data
        localStorage.setItem('helios_token', data.data.tokens.accessToken);
        localStorage.setItem('helios_refresh_token', data.data.tokens.refreshToken);
        localStorage.setItem('helios_user', JSON.stringify(data.data.user));

        // Store organization info
        if (data.data.organization) {
          localStorage.setItem('helios_organization', JSON.stringify({
            organizationId: data.data.organization.id,
            organizationName: data.data.organization.name,
            domain: data.data.organization.domain
          }));
        }

        onLoginSuccess(data);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-form-section">
        <div className="login-header">
          <h1>🚀 Helios Admin Portal</h1>
          <h2>{organizationName || 'Your Organization'}</h2>
          <p>Administrative Dashboard</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="admin@yourcompany.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="login-footer">
            <div className="security-note">
              🔒 Own your API keys, delegate admin access securely
            </div>
          </div>
        </form>
      </div>

      <div className="login-info-section">
        <div className="feature-card">
          <h3>🔐 You Own Your Data</h3>
          <p>
            Keep your API keys and service accounts in your infrastructure.
            Helios provides secure administrative access without vendor lock-in.
          </p>
        </div>
        <div className="feature-card">
          <h3>👥 Centralized Administration</h3>
          <p>
            Manage users, groups, and organizational units from Google Workspace
            with a powerful administrative dashboard.
          </p>
        </div>
        <div className="feature-card">
          <h3>⚡ Workflow Automation</h3>
          <p>
            Automate user onboarding, offboarding, and role changes
            to reduce manual work and errors.
          </p>
        </div>
      </div>
    </div>
  );
}
