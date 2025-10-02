import { useState } from 'react';
import './ClientLogin.css';

interface ClientLoginProps {
  onLoginSuccess: (tenantData: any) => void;
  tenantDomain?: string;
  organizationName?: string;
}

export function ClientLogin({ onLoginSuccess, tenantDomain, organizationName }: ClientLoginProps) {
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
      const response = await fetch('http://localhost:3001/api/auth/tenant-login', {
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
        // Store tenant auth data
        localStorage.setItem('helios_client_token', data.token);
        localStorage.setItem('helios_client_tenant', JSON.stringify(data.tenant));
        localStorage.setItem('helios_client_user', JSON.stringify(data.user));

        console.log('Login successful, calling onLoginSuccess with:', data);
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
    <div className="client-login-container">
      <div className="client-login-card">
        <div className="client-login-header">
          <h1>🚀 Helios Admin Portal</h1>
          <h2>{organizationName || 'Your Organization'}</h2>
          <p>Administrative Dashboard</p>
        </div>

        <form className="client-login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="client-login-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
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

          <div className="form-group">
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
            className="client-login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="client-login-footer">
            <div className="security-note">
              🔒 Own your API keys, delegate admin access securely
            </div>
          </div>
        </form>
      </div>

      <div className="client-login-info">
        <div className="info-card">
          <h3>🔐 You Own Your Data</h3>
          <p>
            Keep your API keys and service accounts in your infrastructure.
            Helios provides secure administrative access without vendor lock-in.
          </p>
        </div>
        <div className="info-card">
          <h3>👥 Centralized Administration</h3>
          <p>
            Manage users, permissions, and configurations across Google Workspace,
            Microsoft 365, and other SaaS platforms from one dashboard.
          </p>
        </div>
        <div className="info-card">
          <h3>⚡ Workflow Automation</h3>
          <p>
            Automate user onboarding, offboarding, and role changes across
            multiple platforms to reduce manual work and errors.
          </p>
        </div>
      </div>
    </div>
  );
}