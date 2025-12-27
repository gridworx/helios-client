import { useState } from 'react';
import { signInWithEmail, getSession } from '../lib/auth-client';
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
      // Sign in with better-auth (sets httpOnly session cookies)
      // No JWT tokens stored in browser - session cookies are more secure
      const authResult = await signInWithEmail(formData.email, formData.password);

      if (!authResult.success) {
        throw new Error(authResult.error || 'Sign in failed');
      }

      // Get the session to access user data
      const session = await getSession();
      if (!session) {
        throw new Error('Failed to get session after login');
      }

      const user = session.user;

      // Store user info for UI display (not for auth - that's handled by httpOnly cookies)
      localStorage.setItem('helios_user', JSON.stringify({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        isExternalAdmin: user.isExternalAdmin,
        defaultView: user.defaultView,
        isActive: user.isActive,
        department: user.department,
      }));

      // Store organization info for UI display
      if (user.organizationId) {
        // Extract domain from email for display
        const emailDomain = user.email.split('@')[1] || '';
        localStorage.setItem('helios_organization', JSON.stringify({
          organizationId: user.organizationId,
          organizationName: organizationName || 'Organization',
          domain: emailDomain,
        }));
      }

      // Notify parent of successful login
      onLoginSuccess({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            organizationId: user.organizationId,
          },
          organization: { id: user.organizationId },
        },
      });

    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-form-section">
        <div className="login-header">
          <h1>Helios Admin Portal</h1>
          <h2>{organizationName || 'Your Organization'}</h2>
          <p>Administrative Dashboard</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              {error}
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
              Self-hosted. Fully audited. Complete control.
            </div>
          </div>
        </form>
      </div>

      <div className="login-info-section">
        <div className="feature-card">
          <h3>Delegate with Confidence</h3>
          <p>
            Grant vendors and team members admin access without sharing
            credentials. Full visibility into every action taken.
          </p>
        </div>
        <div className="feature-card">
          <h3>Complete Audit Trail</h3>
          <p>
            Every API call logged and traceable. Meet compliance requirements
            with detailed activity records and security events.
          </p>
        </div>
        <div className="feature-card">
          <h3>Your Infrastructure</h3>
          <p>
            Service accounts and credentials stay on your servers.
            No per-user fees. No data leaving your control.
          </p>
        </div>
      </div>
    </div>
  );
}
