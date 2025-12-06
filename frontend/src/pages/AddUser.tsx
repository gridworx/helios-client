import { useState, useEffect } from 'react';
import './AddUser.css';

type ViewMode = 'single' | 'bulk' | 'csv';
type PasswordMethod = 'email_link' | 'admin_set';

export function AddUser() {
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Check authentication and edit mode on mount
  useEffect(() => {
    const token = localStorage.getItem('helios_token');
    if (!token) {
      // Not authenticated, redirect to home
      window.location.pathname = '/';
      return;
    }

    // Check if we're in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
      setIsEditMode(true);
      setEditUserId(editId);
      fetchUserForEdit(editId);
    }
  }, []);

  const fetchUserForEdit = async (userId: string) => {
    try {
      setIsLoadingUser(true);
      const token = localStorage.getItem('helios_token');
      const response = await fetch(`http://localhost:3001/api/organization/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      const user = data.data?.find((u: any) => u.id === userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Pre-populate form with user data
      setFormData({
        email: user.email || '',
        firstName: user.firstName || user.first_name || '',
        lastName: user.lastName || user.last_name || '',
        password: '',
        alternateEmail: user.alternateEmail || '',
        expiryHours: '48',
        jobTitle: user.jobTitle || user.job_title || '',
        department: user.department || '',
        organizationalUnit: user.organizationalUnit || user.organizational_unit || '',
        location: user.location || '',
        reportingManager: user.reportingManagerId || '',
        mobilePhone: user.mobilePhone || user.mobile_phone || '',
        workPhone: user.workPhone || user.work_phone || '',
        secondaryEmails: [],
        groups: [],
        role: user.role || 'user',
        customFields: {
          githubId: user.githubUsername || user.github_username || '',
          jumpcloudId: user.jumpcloudUserId || user.jumpcloud_user_id || '',
          slackId: user.slackUserId || user.slack_user_id || '',
          associateId: user.associateId || user.associate_id || '',
          employmentType: user.employeeType || user.employee_type || 'Full Time',
        }
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingUser(false);
    }
  };

  // Single User Form State
  const [passwordMethod, setPasswordMethod] = useState<PasswordMethod>('email_link');
  const [formData, setFormData] = useState({
    // Basic Info
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    alternateEmail: '',
    expiryHours: '48',

    // Profile Info
    jobTitle: '',
    department: '',
    organizationalUnit: '',
    location: '',
    reportingManager: '',

    // Contact Info
    mobilePhone: '',
    workPhone: '',
    secondaryEmails: [] as string[],

    // Groups & Access
    groups: [] as string[],
    role: 'user',

    // Custom Fields
    customFields: {
      githubId: '',
      jumpcloudId: '',
      slackId: '',
      associateId: '',
      employmentType: 'Full Time',
    }
  });

  const [newSecondaryEmail, setNewSecondaryEmail] = useState('');
  const [searchGroup, setSearchGroup] = useState('');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [field]: value }
    }));
  };

  const addSecondaryEmail = () => {
    if (newSecondaryEmail && !formData.secondaryEmails.includes(newSecondaryEmail)) {
      setFormData(prev => ({
        ...prev,
        secondaryEmails: [...prev.secondaryEmails, newSecondaryEmail]
      }));
      setNewSecondaryEmail('');
    }
  };

  const removeSecondaryEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      secondaryEmails: prev.secondaryEmails.filter(e => e !== email)
    }));
  };

  const addGroup = (group: string) => {
    if (group && !formData.groups.includes(group)) {
      setFormData(prev => ({
        ...prev,
        groups: [...prev.groups, group]
      }));
    }
  };

  const removeGroup = (group: string) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g !== group)
    }));
  };

  const handleSubmitSingle = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.email || !formData.firstName || !formData.lastName) {
        throw new Error('Email, First Name, and Last Name are required');
      }

      // Only validate password for new users
      if (!isEditMode) {
        if (passwordMethod === 'admin_set' && !formData.password) {
          throw new Error('Password is required when admin sets password');
        }

        if (passwordMethod === 'email_link' && !formData.alternateEmail) {
          throw new Error('Alternate email is required for password setup link');
        }
      }

      const token = localStorage.getItem('helios_token');

      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const requestBody: any = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,

        // Extended profile fields
        jobTitle: formData.jobTitle,
        department: formData.department,
        organizationalUnit: formData.organizationalUnit,
        location: formData.location,
        reportingManagerId: formData.reportingManager || null,
        mobilePhone: formData.mobilePhone,
        workPhone: formData.workPhone,

        // Platform integration fields
        githubUsername: formData.customFields.githubId,
        slackUserId: formData.customFields.slackId,
        jumpcloudUserId: formData.customFields.jumpcloudId,
        associateId: formData.customFields.associateId,
        employeeType: formData.customFields.employmentType,

        // Secondary emails and groups (will handle separately)
        secondaryEmails: formData.secondaryEmails,
        groups: formData.groups,
      };

      // Only include password setup fields for new users
      if (!isEditMode) {
        requestBody.passwordSetupMethod = passwordMethod;

        if (passwordMethod === 'admin_set') {
          requestBody.password = formData.password;
        } else {
          requestBody.alternateEmail = formData.alternateEmail;
          requestBody.expiryHours = parseInt(formData.expiryHours);
        }
      }

      const url = isEditMode
        ? `http://localhost:3001/api/organization/users/${editUserId}`
        : 'http://localhost:3001/api/organization/users';

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} user`);
      }

      setSuccess(`User ${formData.email} ${isEditMode ? 'updated' : 'created'} successfully!`);

      // Reset form or redirect
      setTimeout(() => {
        window.location.pathname = '/users';
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSingleUserForm = () => (
    <div className="add-user-form">
      <div className="form-section">
        <h3 className="section-title">Basic Information</h3>

        {/* Email */}
        <div className="form-group">
          <label>Primary Email <span className="required">*</span></label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="user@example.com"
            disabled={isSubmitting}
          />
        </div>

        {/* Name Fields */}
        <div className="form-row">
          <div className="form-group">
            <label>First Name <span className="required">*</span></label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="John"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Last Name <span className="required">*</span></label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Doe"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Role */}
        <div className="form-group">
          <label>Role <span className="required">*</span></label>
          <select
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            disabled={isSubmitting}
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Password Setup Method - only show for new users */}
      {!isEditMode && (
      <div className="form-section">
        <h3 className="section-title">Password Setup</h3>

        <div className="password-method-selector">
          <label className={`method-option ${passwordMethod === 'email_link' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="passwordMethod"
              value="email_link"
              checked={passwordMethod === 'email_link'}
              onChange={(e) => setPasswordMethod(e.target.value as PasswordMethod)}
              disabled={isSubmitting}
            />
            <div className="method-content">
              <div className="method-title">📧 Send password setup email</div>
              <div className="method-description">User receives secure link to set their own password</div>
            </div>
          </label>

          <label className={`method-option ${passwordMethod === 'admin_set' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="passwordMethod"
              value="admin_set"
              checked={passwordMethod === 'admin_set'}
              onChange={(e) => setPasswordMethod(e.target.value as PasswordMethod)}
              disabled={isSubmitting}
            />
            <div className="method-content">
              <div className="method-title">🔑 I will set the password</div>
              <div className="method-description">Set password now and share with user</div>
            </div>
          </label>
        </div>

        {passwordMethod === 'email_link' ? (
          <>
            <div className="form-group">
              <label>Alternate Email (for setup link) <span className="required">*</span></label>
              <input
                type="email"
                value={formData.alternateEmail}
                onChange={(e) => handleInputChange('alternateEmail', e.target.value)}
                placeholder="personal@email.com"
                disabled={isSubmitting}
              />
              <p className="field-hint">The setup link will be sent to this email</p>
            </div>
            <div className="form-group">
              <label>Link Expires In</label>
              <select
                value={formData.expiryHours}
                onChange={(e) => handleInputChange('expiryHours', e.target.value)}
                disabled={isSubmitting}
              >
                <option value="24">24 hours</option>
                <option value="48">48 hours (Recommended)</option>
                <option value="72">72 hours</option>
                <option value="168">7 days</option>
              </select>
            </div>
          </>
        ) : (
          <div className="form-group">
            <label>Password <span className="required">*</span></label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>
      )}

      {/* Profile Information */}
      <div className="form-section">
        <h3 className="section-title">Profile Information</h3>

        <div className="form-group">
          <label>Job Title</label>
          <input
            type="text"
            value={formData.jobTitle}
            onChange={(e) => handleInputChange('jobTitle', e.target.value)}
            placeholder="e.g., Program Manager"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              placeholder="e.g., Engineering"
              disabled={isSubmitting}
            />
            <p className="field-hint">Start typing to see suggestions</p>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="e.g., Calgary"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Organizational Unit</label>
          <select
            value={formData.organizationalUnit}
            onChange={(e) => handleInputChange('organizationalUnit', e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select OU...</option>
            <option value="/Engineering">Engineering</option>
            <option value="/Sales">Sales</option>
            <option value="/Marketing">Marketing</option>
            <option value="/HR">HR</option>
          </select>
          <p className="field-hint">Where in your organization structure</p>
        </div>

        <div className="form-group">
          <label>Reporting Manager</label>
          <input
            type="text"
            value={formData.reportingManager}
            onChange={(e) => handleInputChange('reportingManager', e.target.value)}
            placeholder="Start typing manager's name..."
            disabled={isSubmitting}
          />
          <p className="field-hint">Direct supervisor for this user</p>
        </div>
      </div>

      {/* Contact Information */}
      <div className="form-section">
        <h3 className="section-title">Contact Information</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Mobile Phone</label>
            <input
              type="tel"
              value={formData.mobilePhone}
              onChange={(e) => handleInputChange('mobilePhone', e.target.value)}
              placeholder="(403) 555-1234"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Work Phone</label>
            <input
              type="tel"
              value={formData.workPhone}
              onChange={(e) => handleInputChange('workPhone', e.target.value)}
              placeholder="Extension: 1234"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Secondary Emails */}
        <div className="form-group">
          <label>Secondary Emails</label>
          <div className="multi-input">
            <input
              type="email"
              value={newSecondaryEmail}
              onChange={(e) => setNewSecondaryEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSecondaryEmail())}
              placeholder="additional@email.com"
              disabled={isSubmitting}
            />
            <button type="button" onClick={addSecondaryEmail} disabled={isSubmitting}>
              Add
            </button>
          </div>
          {formData.secondaryEmails.length > 0 && (
            <div className="tag-list">
              {formData.secondaryEmails.map((email, idx) => (
                <span key={idx} className="tag">
                  {email}
                  <button type="button" onClick={() => removeSecondaryEmail(email)} disabled={isSubmitting}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Groups & Access */}
      <div className="form-section">
        <h3 className="section-title">Groups & Access</h3>

        <div className="form-group">
          <label>Groups</label>
          <div className="multi-input">
            <input
              type="text"
              value={searchGroup}
              onChange={(e) => setSearchGroup(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGroup(searchGroup), setSearchGroup(''))}
              placeholder="Start typing group name..."
              disabled={isSubmitting}
            />
            <button type="button" onClick={() => { addGroup(searchGroup); setSearchGroup(''); }} disabled={isSubmitting}>
              Add
            </button>
          </div>
          <p className="field-hint">Type to search and select groups</p>
          {formData.groups.length > 0 && (
            <div className="tag-list">
              {formData.groups.map((group, idx) => (
                <span key={idx} className="tag">
                  {group}
                  <button type="button" onClick={() => removeGroup(group)} disabled={isSubmitting}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Fields */}
      <div className="form-section">
        <h3 className="section-title">Custom Fields</h3>

        <div className="form-row">
          <div className="form-group">
            <label>GitHub ID</label>
            <input
              type="text"
              value={formData.customFields.githubId}
              onChange={(e) => handleCustomFieldChange('githubId', e.target.value)}
              placeholder="github-username"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Slack ID</label>
            <input
              type="text"
              value={formData.customFields.slackId}
              onChange={(e) => handleCustomFieldChange('slackId', e.target.value)}
              placeholder="U030STKMVQC"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>JumpCloud ID</label>
            <input
              type="text"
              value={formData.customFields.jumpcloudId}
              onChange={(e) => handleCustomFieldChange('jumpcloudId', e.target.value)}
              placeholder="e401064"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Associate ID</label>
            <input
              type="text"
              value={formData.customFields.associateId}
              onChange={(e) => handleCustomFieldChange('associateId', e.target.value)}
              placeholder="0CJHCLIAB"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Employment Type</label>
          <select
            value={formData.customFields.employmentType}
            onChange={(e) => handleCustomFieldChange('employmentType', e.target.value)}
            disabled={isSubmitting}
          >
            <option value="Full Time">Full Time</option>
            <option value="Part Time">Part Time</option>
            <option value="Contract">Contract</option>
            <option value="Intern">Intern</option>
          </select>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => window.location.pathname = '/users'} disabled={isSubmitting || isLoadingUser}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleSubmitSingle} disabled={isSubmitting || isLoadingUser}>
          {isSubmitting ? (isEditMode ? '⏳ Updating User...' : '⏳ Creating User...') : (isEditMode ? '💾 Update User' : '➕ Create User')}
        </button>
      </div>
    </div>
  );

  const renderBulkMode = () => (
    <div className="bulk-mode">
      <div className="coming-soon">
        <h3>Bulk User Creation</h3>
        <p>Add multiple users at once using a simple table interface.</p>
        <p className="status">Coming soon...</p>
      </div>
    </div>
  );

  const renderCSVUpload = () => (
    <div className="csv-upload">
      <div className="coming-soon">
        <h3>CSV Import</h3>
        <p>Upload a CSV file to import multiple users at once.</p>
        <p className="status">Coming soon...</p>
      </div>
    </div>
  );

  return (
    <div className="add-user-page">
      <div className="page-header">
        <div className="header-content">
          <button className="back-button" onClick={() => window.location.pathname = '/users'}>
            ← Back to Users
          </button>
          <h1>{isEditMode ? 'Edit User' : 'Add New User'}</h1>
          <p className="page-description">
            {isEditMode ? 'Update user account and profile information' : 'Create user accounts and configure their profile information'}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingUser && (
        <div className="message" style={{ textAlign: 'center', padding: '2rem' }}>
          ⏳ Loading user data...
        </div>
      )}

      {/* View Mode Tabs */}
      {!isLoadingUser && (
      <>
        <div className="view-mode-tabs">
          <button
            className={`tab ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
          >
            👤 Single User
          </button>
          <button
            className={`tab ${viewMode === 'bulk' ? 'active' : ''}`}
            onClick={() => setViewMode('bulk')}
          >
            👥 Bulk Mode
          </button>
          <button
            className={`tab ${viewMode === 'csv' ? 'active' : ''}`}
            onClick={() => setViewMode('csv')}
          >
            📄 CSV Upload
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="message error-message">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="message success-message">
            ✓ {success}
          </div>
        )}

        {/* Content */}
        <div className="page-content">
          {viewMode === 'single' && renderSingleUserForm()}
          {viewMode === 'bulk' && renderBulkMode()}
          {viewMode === 'csv' && renderCSVUpload()}
        </div>
      </>
      )}
    </div>
  );
}
