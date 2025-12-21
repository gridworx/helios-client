import { useState, useEffect } from 'react';
import { X, UserPlus, Mail, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import './QuickAddUserSlideOut.css';

interface QuickAddUserSlideOutProps {
    organizationId?: string; // Optional - for future use with org-specific features
    onClose: () => void;
    onUserCreated?: () => void;
}

interface FormData {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    jobTitle: string;
    department: string;
    managerId: string;
    passwordMethod: 'email' | 'manual';
    password: string;
    confirmPassword: string;
    alternateEmail: string;
    expiresIn: string;
    // Provider options
    createInGoogle: boolean;
    createInMicrosoft: boolean;
    // License assignment
    licenseId: string;
}

interface ValidationErrors {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmPassword?: string;
    alternateEmail?: string;
}

export function QuickAddUserSlideOut({ organizationId: _organizationId, onClose, onUserCreated }: QuickAddUserSlideOutProps) {
    const [formData, setFormData] = useState<FormData>({
        email: '',
        firstName: '',
        lastName: '',
        role: 'user',
        jobTitle: '',
        department: '',
        managerId: '',
        passwordMethod: 'email',
        password: '',
        confirmPassword: '',
        alternateEmail: '',
        expiresIn: '7',
        createInGoogle: true,
        createInMicrosoft: false,
        licenseId: '',
    });

    const [errors, setErrors] = useState<ValidationErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Dropdown data
    const [departments, setDepartments] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [licenses, setLicenses] = useState<any[]>([]);
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
    const [orgDomain, setOrgDomain] = useState('');

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        const token = localStorage.getItem('helios_token');

        // Fetch departments
        try {
            const deptResponse = await fetch('/api/v1/organization/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (deptResponse.ok) {
                const data = await deptResponse.json();
                if (data.success) setDepartments(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }

        // Fetch job titles
        try {
            const jtResponse = await fetch('/api/v1/organization/job-titles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (jtResponse.ok) {
                const data = await jtResponse.json();
                if (data.success) setJobTitles(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching job titles:', error);
        }

        // Fetch managers (active users)
        try {
            const managersResponse = await fetch('/api/v1/organization/users?status=active&limit=100', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (managersResponse.ok) {
                const data = await managersResponse.json();
                setManagers(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching managers:', error);
        }

        // Fetch licenses
        try {
            const licenseResponse = await fetch('/api/v1/organization/licenses', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (licenseResponse.ok) {
                const data = await licenseResponse.json();
                if (data.success) setLicenses(data.data?.licenses || []);
            }
        } catch (error) {
            console.error('Error fetching licenses:', error);
        }

        // Check integration status
        try {
            const statsResponse = await fetch('/api/v1/dashboard/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (statsResponse.ok) {
                const data = await statsResponse.json();
                if (data.success) {
                    setGoogleEnabled(data.data?.google?.connected || false);
                    setMicrosoftEnabled(data.data?.microsoft?.connected || false);
                }
            }
        } catch (error) {
            console.error('Error fetching integration status:', error);
        }

        // Get org domain
        try {
            const orgResponse = await fetch('/api/v1/organization/current', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (orgResponse.ok) {
                const data = await orgResponse.json();
                if (data.success && data.data?.domain) {
                    setOrgDomain(data.data.domain);
                }
            }
        } catch (error) {
            console.error('Error fetching organization:', error);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        if (formData.passwordMethod === 'manual') {
            if (!formData.password) {
                newErrors.password = 'Password is required';
            } else if (formData.password.length < 8) {
                newErrors.password = 'Password must be at least 8 characters';
            }
            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        } else {
            if (formData.alternateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.alternateEmail)) {
                newErrors.alternateEmail = 'Invalid email format';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (field: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field as keyof ValidationErrors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        setSubmitResult(null);

        try {
            const token = localStorage.getItem('helios_token');

            const payload: any = {
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
                userType: 'staff',
                status: 'pending',
            };

            // Add optional fields if provided
            if (formData.jobTitle) payload.jobTitle = formData.jobTitle;
            if (formData.department) payload.department = formData.department;
            if (formData.managerId) payload.managerId = formData.managerId;

            // Password handling
            if (formData.passwordMethod === 'manual') {
                payload.password = formData.password;
                payload.sendSetupEmail = false;
            } else {
                payload.sendSetupEmail = true;
                if (formData.alternateEmail) {
                    payload.alternateEmail = formData.alternateEmail;
                }
                payload.setupTokenExpiresIn = parseInt(formData.expiresIn) * 24 * 60 * 60 * 1000; // days to ms
            }

            // Provider options
            payload.createInGoogle = formData.createInGoogle && googleEnabled;
            payload.createInMicrosoft = formData.createInMicrosoft && microsoftEnabled;

            // License assignment
            if (formData.licenseId) {
                payload.licenseId = formData.licenseId;
            }

            const response = await fetch('/api/v1/organization/users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSubmitResult({
                    success: true,
                    message: `User ${formData.firstName} ${formData.lastName} created successfully!`
                });
                onUserCreated?.();
                // Close after 2 seconds on success
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setSubmitResult({
                    success: false,
                    message: data.error || 'Failed to create user'
                });
            }
        } catch (error: any) {
            setSubmitResult({
                success: false,
                message: error.message || 'An error occurred'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auto-complete email domain
    const handleEmailChange = (value: string) => {
        let email = value;
        // If user types just username without @, keep as is (they'll add domain later)
        // But if there's an @ but no domain, suggest domain
        if (value.includes('@') && !value.includes('.') && orgDomain) {
            const [local, partial] = value.split('@');
            if (!partial) {
                email = `${local}@${orgDomain}`;
            }
        }
        handleInputChange('email', email);
    };

    return (
        <div className="quick-add-overlay" onClick={onClose}>
            <div className="quick-add-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="quick-add-header">
                    <div className="header-title">
                        <UserPlus size={20} />
                        <h2>Quick Add User</h2>
                    </div>
                    <button className="close-btn" onClick={onClose} title="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="quick-add-content">
                    {/* Success/Error Message */}
                    {submitResult && (
                        <div className={`result-message ${submitResult.success ? 'success' : 'error'}`}>
                            {submitResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span>{submitResult.message}</span>
                        </div>
                    )}

                    {/* Basic Information */}
                    <div className="form-section">
                        <h3>Basic Information</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>
                                    Email <span className="required">*</span>
                                </label>
                                <div className="input-wrapper">
                                    <Mail size={16} className="input-icon" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        placeholder={`user@${orgDomain || 'domain.com'}`}
                                        className={errors.email ? 'error' : ''}
                                    />
                                </div>
                                {errors.email && <span className="error-text">{errors.email}</span>}
                            </div>
                        </div>

                        <div className="form-row two-col">
                            <div className="form-group">
                                <label>
                                    First Name <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                                    placeholder="John"
                                    className={errors.firstName ? 'error' : ''}
                                />
                                {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                            </div>
                            <div className="form-group">
                                <label>
                                    Last Name <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                                    placeholder="Doe"
                                    className={errors.lastName ? 'error' : ''}
                                />
                                {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => handleInputChange('role', e.target.value)}
                                >
                                    <option value="user">User</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Provider Selection */}
                    {(googleEnabled || microsoftEnabled) && (
                        <div className="form-section">
                            <h3>Create User In</h3>
                            <div className="provider-options">
                                {googleEnabled && (
                                    <label className="provider-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.createInGoogle}
                                            onChange={(e) => handleInputChange('createInGoogle', e.target.checked)}
                                        />
                                        <span className="provider-icon google">G</span>
                                        <span>Google Workspace</span>
                                    </label>
                                )}
                                {microsoftEnabled && (
                                    <label className="provider-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.createInMicrosoft}
                                            onChange={(e) => handleInputChange('createInMicrosoft', e.target.checked)}
                                        />
                                        <span className="provider-icon microsoft">M</span>
                                        <span>Microsoft 365</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Password Setup */}
                    <div className="form-section">
                        <h3>Password Setup</h3>
                        <div className="password-options">
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="passwordMethod"
                                    checked={formData.passwordMethod === 'email'}
                                    onChange={() => handleInputChange('passwordMethod', 'email')}
                                />
                                <span>Send password setup email</span>
                            </label>
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="passwordMethod"
                                    checked={formData.passwordMethod === 'manual'}
                                    onChange={() => handleInputChange('passwordMethod', 'manual')}
                                />
                                <span>Set password manually</span>
                            </label>
                        </div>

                        {formData.passwordMethod === 'email' && (
                            <div className="form-row two-col">
                                <div className="form-group">
                                    <label>Alternate Email (optional)</label>
                                    <input
                                        type="email"
                                        value={formData.alternateEmail}
                                        onChange={(e) => handleInputChange('alternateEmail', e.target.value)}
                                        placeholder="personal@example.com"
                                        className={errors.alternateEmail ? 'error' : ''}
                                    />
                                    {errors.alternateEmail && <span className="error-text">{errors.alternateEmail}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Link Expires In</label>
                                    <select
                                        value={formData.expiresIn}
                                        onChange={(e) => handleInputChange('expiresIn', e.target.value)}
                                    >
                                        <option value="1">1 day</option>
                                        <option value="3">3 days</option>
                                        <option value="7">7 days</option>
                                        <option value="14">14 days</option>
                                        <option value="30">30 days</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formData.passwordMethod === 'manual' && (
                            <div className="form-row two-col">
                                <div className="form-group">
                                    <label>
                                        Password <span className="required">*</span>
                                    </label>
                                    <div className="input-wrapper">
                                        <Key size={16} className="input-icon" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => handleInputChange('password', e.target.value)}
                                            placeholder="Min 8 characters"
                                            className={errors.password ? 'error' : ''}
                                        />
                                    </div>
                                    {errors.password && <span className="error-text">{errors.password}</span>}
                                </div>
                                <div className="form-group">
                                    <label>
                                        Confirm Password <span className="required">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                        placeholder="Confirm password"
                                        className={errors.confirmPassword ? 'error' : ''}
                                    />
                                    {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Advanced Options (Collapsible) */}
                    <div className="form-section">
                        <button
                            className="advanced-toggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? '▼' : '▶'} Advanced Options
                        </button>

                        {showAdvanced && (
                            <div className="advanced-fields">
                                <div className="form-row two-col">
                                    <div className="form-group">
                                        <label>Job Title</label>
                                        {jobTitles.length > 0 ? (
                                            <select
                                                value={formData.jobTitle}
                                                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                                            >
                                                <option value="">Select job title...</option>
                                                {jobTitles.filter((jt: any) => jt.isActive !== false).map((jt: any) => (
                                                    <option key={jt.id} value={jt.name}>{jt.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData.jobTitle}
                                                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                                                placeholder="Software Engineer"
                                            />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Department</label>
                                        {departments.length > 0 ? (
                                            <select
                                                value={formData.department}
                                                onChange={(e) => handleInputChange('department', e.target.value)}
                                            >
                                                <option value="">Select department...</option>
                                                {departments.filter((dept: any) => dept.isActive !== false).map((dept: any) => (
                                                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={formData.department}
                                                onChange={(e) => handleInputChange('department', e.target.value)}
                                                placeholder="Engineering"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="form-row two-col">
                                    <div className="form-group">
                                        <label>Manager</label>
                                        <select
                                            value={formData.managerId}
                                            onChange={(e) => handleInputChange('managerId', e.target.value)}
                                        >
                                            <option value="">Select manager...</option>
                                            {managers.filter((mgr: any) => mgr.status === 'active').map((mgr: any) => (
                                                <option key={mgr.id} value={mgr.id}>
                                                    {mgr.first_name || mgr.firstName} {mgr.last_name || mgr.lastName} ({mgr.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {licenses.length > 0 && (
                                        <div className="form-group">
                                            <label>License</label>
                                            <select
                                                value={formData.licenseId}
                                                onChange={(e) => handleInputChange('licenseId', e.target.value)}
                                            >
                                                <option value="">Select license...</option>
                                                {licenses.map((lic: any) => (
                                                    <option key={lic.id} value={lic.id}>
                                                        {lic.displayName} ({lic.provider})
                                                        {lic.availableUnits >= 0 && ` - ${lic.availableUnits} available`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="quick-add-footer">
                    <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="spinning" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <UserPlus size={16} />
                                Create User
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default QuickAddUserSlideOut;
