import { useState } from 'react';
import './AccountSetup.css';

interface AccountSetupProps {
  onComplete: () => void;
}

export function AccountSetup({ onComplete }: AccountSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    organizationName: '',
    domain: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: ''
  });

  const handleSubmit = async () => {
    if (!formData.organizationName || !formData.domain || !formData.adminFirstName ||
        !formData.adminLastName || !formData.adminEmail || !formData.adminPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.adminPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/api/tenant-setup/account-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      // Store the tenant info
      localStorage.setItem('helios_tenant_config', JSON.stringify({
        tenantId: data.data.tenantId,
        domain: formData.domain,
        organizationName: formData.organizationName
      }));

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-setup-container">
      <div className="account-setup-card">
        <div className="account-setup-header">
          <h1>🚀 Welcome to Helios Admin Portal</h1>
          <p>Set up your organization and admin account</p>
        </div>

        <div className="setup-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Organization</div>
          </div>
          <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Admin Account</div>
          </div>
        </div>

        <div className="account-setup-body">
          {error && (
            <div className="setup-error">⚠️ {error}</div>
          )}

          {step === 1 && (
            <div className="setup-step">
              <h2>Organization Information</h2>
              <p className="step-description">
                Tell us about your organization to personalize your admin portal
              </p>

              <div className="form-group">
                <label>Organization Name</label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={e => setFormData({...formData, organizationName: e.target.value})}
                  placeholder="Acme Corporation"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Primary Domain</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={e => setFormData({...formData, domain: e.target.value})}
                  placeholder="acme.com"
                />
                <div className="form-hint">
                  This will be used for module configurations (Google Workspace, Microsoft 365, etc.)
                </div>
              </div>

              <div className="info-box">
                <strong>📋 What's Next?</strong>
                <p>
                  After setup, you'll be able to enable modules like Google Workspace,
                  Microsoft 365, Slack, and more from your dashboard settings.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="setup-step">
              <h2>Create Admin Account</h2>
              <p className="step-description">
                Create your administrator account to manage this portal
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={formData.adminFirstName}
                    onChange={e => setFormData({...formData, adminFirstName: e.target.value})}
                    placeholder="John"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={formData.adminLastName}
                    onChange={e => setFormData({...formData, adminLastName: e.target.value})}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                  placeholder="admin@acme.com"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={e => setFormData({...formData, adminPassword: e.target.value})}
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="info-box">
                <strong>🔒 Admin Privileges</strong>
                <p>
                  This account will have full access to manage modules, users, and settings.
                  You can invite additional users with different permission levels later.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="account-setup-footer">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
              disabled={loading}
            >
              ← Back
            </button>
          )}

          {step < 2 ? (
            <button
              onClick={() => {
                if (!formData.organizationName || !formData.domain) {
                  setError('Please fill in organization information');
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="btn-primary"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : '🚀 Create Admin Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}