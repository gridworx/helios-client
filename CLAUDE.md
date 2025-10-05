# 🤖 CLAUDE.md - AI Development Instructions for Helios Client Portal

**Project:** Helios Client Portal - Single Organization Management System
**Purpose:** Self-hosted/SaaS portal for individual organizations to manage their workspace
**Status:** 85% Complete - Core functionality working, needs Google Workspace integration completion
**Architecture:** Single-tenant (one organization per installation)

## 🎯 CRITICAL: This is NOT Multi-Tenant

**IMPORTANT:** This is the CLIENT PORTAL for single organizations.
- ❌ NO tenant switching
- ❌ NO multi-tenant features
- ❌ NO platform owner roles
- ✅ ONE organization per installation
- ✅ Organization admins and users only
- ✅ Self-service for end users

## 📁 Project Structure

```
helios-client/
├── CLAUDE.md                    ← THIS FILE
├── PROJECT-TRACKER.md           ← Progress tracking
├── docker-compose.yml           ← Local development containers
├── .env.example                 ← Environment variables template
│
├── frontend/                    ← React TypeScript application
│   ├── src/
│   │   ├── components/         ← Reusable components
│   │   ├── pages/             ← Page components
│   │   ├── contexts/          ← React contexts
│   │   ├── hooks/             ← Custom hooks
│   │   ├── services/          ← API service layer
│   │   └── utils/             ← Utilities
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     ← Node.js Express API
│   ├── src/
│   │   ├── routes/            ← API endpoints
│   │   ├── services/          ← Business logic
│   │   ├── middleware/        ← Auth, validation
│   │   ├── database/          ← Database connection
│   │   └── utils/             ← Utilities
│   ├── package.json
│   └── tsconfig.json
│
└── database/                    ← PostgreSQL schema
    ├── schema.sql              ← Database initialization
    ├── migrations/             ← Schema migrations
    └── seeds/                  ← Test data (dev only)
```

## 🏗️ Database Schema (Single Organization)

```sql
-- Core tables for single organization
organizations (              -- Single record per installation
  id, name, domain,
  settings, created_at
)

organization_users (          -- Users within the organization
  id, email, password_hash,
  first_name, last_name,
  role, is_active
)

organization_settings (       -- Organization configuration
  id, organization_id,
  google_workspace_enabled,
  microsoft_365_enabled,
  settings
)

modules (                     -- Available integration modules
  id, name, slug,
  is_enabled, config
)

-- Google Workspace specific (when module enabled)
gw_credentials (
  id, organization_id,
  service_account_key,
  admin_email, domain
)

gw_synced_users (            -- Cached from Google Workspace
  id, organization_id,
  email, name, department,
  last_sync_at
)
```

## 🎨 UI/UX Requirements

### Professional Business Application
- Clean, modern interface inspired by JumpCloud
- Collapsible sidebar navigation
- Responsive design for desktop, tablet, mobile
- Professional color scheme (blues, grays)
- NO developer/technical aesthetics

### Key Pages
1. **Setup Flow** (First time only)
   - Organization creation
   - Admin account setup
   - Module selection

2. **Dashboard** (Main view)
   - Organization statistics
   - Quick actions
   - Recent activity
   - Module status cards

3. **Settings** (Configuration)
   - Modules tab (enable/disable integrations)
   - Organization tab (name, domain, branding)
   - Users tab (manage organization users)
   - Security tab (passwords, 2FA, sessions)
   - Advanced tab (sync settings, API keys)

4. **Directory** (When Google Workspace enabled)
   - Users list (synced from Google)
   - Groups management
   - Organizational units

## 🔌 Module System

### Google Workspace Module
```typescript
interface GoogleWorkspaceModule {
  enabled: boolean;
  configured: boolean;
  credentials: {
    serviceAccountKey: JSON;
    adminEmail: string;
    domain: string;
  };
  syncSettings: {
    autoSync: boolean;
    interval: number;
    conflictResolution: 'platform_wins' | 'google_wins';
  };
}
```

### Module Activation Flow
1. Click "Enable Google Workspace" in Settings > Modules
2. Configuration wizard appears
3. Upload service account JSON
4. Enter admin email for delegation
5. Test connection
6. Configure sync settings
7. Initial sync runs
8. Module shows as active

## 🔒 Security Requirements

### Authentication
- Email/password for organization users
- JWT tokens (8 hour expiry)
- Refresh tokens (7 day expiry)
- Optional 2FA support

### Authorization
```typescript
enum UserRole {
  ADMIN = 'admin',        // Full organization access
  MANAGER = 'manager',    // Department management
  USER = 'user'          // Self-service only
}
```

### Data Protection
- Passwords: bcrypt with cost 12
- Service accounts: AES-256 encryption
- Sessions: Redis with TTL
- API: Rate limiting per IP

## 🚀 Development Priorities

### Immediate (Must Complete)
1. Fix database schema to use 'organization' not 'tenant'
2. Complete Google Workspace configuration wizard
3. Implement sync functionality
4. Add user self-service features
5. Polish UI/UX consistency

### Short-term (This Week)
1. Add Microsoft 365 module (structure only)
2. Implement audit logging
3. Add data export features
4. Create admin documentation

### Long-term (Future)
1. Additional modules (Slack, Okta, etc.)
2. Advanced reporting
3. Workflow automation
4. Mobile app

## 🛠️ Development Commands

```bash
# Start development environment
cd helios-client
docker-compose up -d

# Run backend
cd backend
npm install
npm run dev

# Run frontend
cd frontend
npm install
npm run dev

# Access applications
Frontend: http://localhost:3000
Backend: http://localhost:3001
Database: postgresql://postgres:postgres@localhost:5432/helios_client
```

## ⚠️ Common Pitfalls to Avoid

### DON'T Add These Features
- ❌ Tenant switching
- ❌ Multi-organization support
- ❌ Platform owner roles
- ❌ MSP features
- ❌ Client management
- ❌ Billing aggregation

### DO Focus On These
- ✅ Single organization excellence
- ✅ Module integration quality
- ✅ User self-service
- ✅ Security and compliance
- ✅ Performance optimization
- ✅ Clear documentation

## 📋 Testing Checklist

### Setup Flow
- [ ] Organization creation works
- [ ] Admin account creation succeeds
- [ ] Login/logout cycle functions
- [ ] Password reset works

### Google Workspace Module
- [ ] Enable button shows for admins
- [ ] Configuration wizard appears
- [ ] Service account validates
- [ ] Test connection succeeds
- [ ] Initial sync pulls users
- [ ] Auto-sync runs on schedule
- [ ] Manual sync button works

### Security
- [ ] JWT expiry honored
- [ ] Refresh tokens work
- [ ] Rate limiting enforced
- [ ] Invalid tokens rejected

## 🎯 Success Metrics

### Technical
- Page load < 2 seconds
- API response < 200ms (p95)
- 99.9% uptime capability
- Zero security vulnerabilities

### User Experience
- Setup completion < 5 minutes
- Intuitive navigation (no training needed)
- Mobile responsive
- Accessible (WCAG 2.1 AA)

### Business
- Production ready
- Scalable to 10,000 users per organization
- Module system extensible
- Clear upgrade path

## 📝 API Conventions

### Endpoints
```
POST   /api/setup/organization       - Initial setup
POST   /api/auth/login              - User login
POST   /api/auth/refresh            - Refresh token
GET    /api/organization/dashboard  - Dashboard data
GET    /api/modules                 - List modules
POST   /api/modules/google/enable   - Enable Google Workspace
POST   /api/modules/google/sync     - Manual sync
GET    /api/users                   - Organization users
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "error": null
}
```

## 🚫 CRITICAL RULES

### RULE 1: Single Organization Only
This portal manages ONE organization. Never add multi-tenant features.

### RULE 2: User-Friendly Language
Use "Organization" not "Tenant"
Use "Workspace" not "Directory"
Use "Team Members" not "Users" (in UI)

### RULE 3: Module Boundaries
Each module is independent. Don't create dependencies between modules.

### RULE 4: Security First
Never store plaintext passwords
Always encrypt service account keys
Each organization MUST use their own service account (see SECURITY-SERVICE-ACCOUNTS.md)
Validate all inputs
Sanitize all outputs

### RULE 5: Professional UI
This is for business users, not developers
Keep it clean and simple
Avoid technical jargon in UI

## 🔒 Security Documentation

### Required Reading for Google Workspace Integration
- **SECURITY-SERVICE-ACCOUNTS.md** - Critical security requirements for service accounts
- **GOOGLE-WORKSPACE-SETUP-GUIDE.md** - Step-by-step setup guide for clients
- **PROVIDER-SETUP-GUIDE.md** - Guide for MSPs/consultants helping clients

### Key Security Principle
**Each organization MUST use their own Google Cloud service account.** Never share service accounts between organizations. This ensures:
- Complete data isolation
- Compliance with regulations
- Client control over access
- Reduced breach impact

---

**Remember:** This is the CLIENT portal for single organizations.
For multi-tenant MSP features, see helios-mtp.
For platform management, see helios-owner.