# Implementation Tasks - API Key Management

## Phase 1: Database & Backend Foundation

### Database Schema
- [ ] Create migration `016_create_api_keys_system.sql`
  - [ ] Create `api_keys` table with all columns
  - [ ] Create `api_key_usage_logs` table
  - [ ] Add indexes for performance
  - [ ] Add CHECK constraints for key type validation
- [ ] Test migration up and down
- [ ] Add rollback script if needed

### Backend - Key Generation
- [ ] Create `backend/src/utils/apiKey.ts`
  - [ ] Implement `generateApiKey()` function
  - [ ] Implement `hashApiKey()` function
  - [ ] Add unit tests for key generation format
  - [ ] Add unit tests for hash consistency

### Backend - Authentication Middleware
- [ ] Create `backend/src/middleware/api-key-auth.ts`
  - [ ] Implement `authenticateApiKey(req, res, next)` middleware
  - [ ] Validate API key format
  - [ ] Hash and lookup key in database
  - [ ] Check expiration
  - [ ] Check IP whitelist (if configured)
  - [ ] Enforce actor headers for vendor keys
  - [ ] Validate against pre-approved actors (if configured)
  - [ ] Update `last_used_at` timestamp
  - [ ] Attach key and actor context to request
- [ ] Add integration tests for service key authentication
- [ ] Add integration tests for vendor key authentication
- [ ] Add integration tests for actor enforcement
- [ ] Add integration tests for expiration checking
- [ ] Add integration tests for IP whitelisting

### Backend - API Key Routes
- [ ] Create `backend/src/routes/api-keys.routes.ts`
  - [ ] POST `/api/organization/api-keys` - Create new key
    - [ ] Validate request body
    - [ ] Generate API key
    - [ ] Hash and store in database
    - [ ] Return key (only once!) and metadata
  - [ ] GET `/api/organization/api-keys` - List all keys
    - [ ] Filter by organization
    - [ ] Support status filtering (active/expired/revoked)
    - [ ] Return key metadata (no sensitive data)
  - [ ] GET `/api/organization/api-keys/:id` - Get key details
    - [ ] Validate ownership
    - [ ] Return full details except key value
  - [ ] PATCH `/api/organization/api-keys/:id` - Update key
    - [ ] Allow updating permissions, expiration, IP whitelist
    - [ ] Validate changes
    - [ ] Audit log updates
  - [ ] DELETE `/api/organization/api-keys/:id` - Revoke key
    - [ ] Soft delete (set is_active = false)
    - [ ] Audit log revocation
  - [ ] POST `/api/organization/api-keys/:id/renew` - Renew expired key
    - [ ] Validate key is expired
    - [ ] Generate new key with same config
    - [ ] Link old and new keys in audit
    - [ ] Return new key (only once!)
  - [ ] GET `/api/organization/api-keys/:id/usage` - Get usage history
    - [ ] Query usage logs
    - [ ] Support date range filtering
    - [ ] Return paginated results
- [ ] Add route tests for each endpoint

### Backend - Audit Logging
- [ ] Update audit logging system to capture API key actions
  - [ ] Log key creation, update, deletion, renewal
  - [ ] Log all API calls made with keys
  - [ ] Include actor context for vendor keys
  - [ ] Include request metadata (IP, user agent, duration)
- [ ] Add audit log query functions
- [ ] Add tests for audit logging

### Backend - Integration with Existing Routes
- [ ] Update `backend/src/index.ts` to register API key middleware
  - [ ] Add API key auth before JWT auth in chain
  - [ ] Ensure backward compatibility
- [ ] Update existing protected routes to work with API keys
- [ ] Test that JWT authentication still works
- [ ] Test that API key authentication works

## Phase 2: Frontend UI

### Settings Tab Structure
- [ ] Update `frontend/src/components/Settings.tsx`
  - [ ] Add "Integrations" tab to tab list
  - [ ] Create IntegrationsTab component structure
- [ ] Create `frontend/src/components/integrations/` directory

### API Key List Component
- [ ] Create `frontend/src/components/integrations/ApiKeyList.tsx`
  - [ ] Fetch and display list of API keys
  - [ ] Show key status badges (active/expired/revoked)
  - [ ] Show key type badges (service/vendor)
  - [ ] Show last used indicator
  - [ ] Show expiration countdown
  - [ ] Add "Create New Key" button
  - [ ] Add action buttons (View, Renew, Revoke)
  - [ ] Handle loading and error states
- [ ] Create `frontend/src/components/integrations/ApiKeyList.css`
  - [ ] Style following design system
  - [ ] Use Lucide icons (not emojis)
  - [ ] Responsive layout

### API Key Create Wizard
- [ ] Create `frontend/src/components/integrations/ApiKeyCreateWizard.tsx`
  - [ ] Step 1: Type Selection
    - [ ] Service key option with description
    - [ ] Vendor key option with description
    - [ ] Visual cards for selection
  - [ ] Step 2a: Service Configuration (if service selected)
    - [ ] Service name input (required)
    - [ ] Description textarea
    - [ ] Permissions checkboxes
    - [ ] Expiration selector (days or never)
  - [ ] Step 2b: Vendor Configuration (if vendor selected)
    - [ ] Vendor name input (required)
    - [ ] Vendor contact email (required)
    - [ ] Description textarea
    - [ ] Actor requirements (checkbox, pre-checked, disabled)
    - [ ] Pre-approved actors list (optional)
    - [ ] Client reference required checkbox
    - [ ] Permissions checkboxes
    - [ ] Expiration selector (days, recommended 90)
  - [ ] Step 3: Review & Create
    - [ ] Show configuration summary
    - [ ] Confirm button
    - [ ] Cancel button
- [ ] Create `frontend/src/components/integrations/ApiKeyCreateWizard.css`

### Show Once Modal
- [ ] Create `frontend/src/components/integrations/ApiKeyShowOnce.tsx`
  - [ ] Display new API key prominently
  - [ ] Copy to clipboard button
  - [ ] Copy confirmation indicator
  - [ ] Integration instructions (for vendor keys)
  - [ ] Warning: "This will only be shown once"
  - [ ] Confirmation checkbox: "I've saved the key securely"
  - [ ] Close button (only enabled after confirmation)
- [ ] Create `frontend/src/components/integrations/ApiKeyShowOnce.css`

### API Key Detail View
- [ ] Create `frontend/src/components/integrations/ApiKeyDetail.tsx`
  - [ ] Overview tab
    - [ ] Key metadata (name, type, created, expires)
    - [ ] Permissions list
    - [ ] Status indicator
    - [ ] Last used timestamp
    - [ ] Configuration details (service/vendor specific)
  - [ ] Usage tab
    - [ ] Recent API calls list
    - [ ] Actor attribution (for vendor keys)
    - [ ] Success/failure rates
    - [ ] Usage chart (last 30 days)
    - [ ] Export button
  - [ ] Settings tab
    - [ ] Update permissions
    - [ ] Update expiration
    - [ ] Update IP whitelist
    - [ ] Save changes button
- [ ] Create `frontend/src/components/integrations/ApiKeyDetail.css`

### Renew Dialog
- [ ] Create `frontend/src/components/integrations/ApiKeyRenewDialog.tsx`
  - [ ] Show current key info
  - [ ] Explain renewal process
  - [ ] Expiration date selector
  - [ ] Confirm button
  - [ ] Cancel button
  - [ ] After renewal: show new key in ShowOnce modal
- [ ] Create `frontend/src/components/integrations/ApiKeyRenewDialog.css`

### API Service Layer
- [ ] Create `frontend/src/services/api-keys.service.ts`
  - [ ] `createApiKey(config)` - POST to create key
  - [ ] `listApiKeys()` - GET list of keys
  - [ ] `getApiKey(id)` - GET key details
  - [ ] `updateApiKey(id, updates)` - PATCH key
  - [ ] `revokeApiKey(id)` - DELETE key
  - [ ] `renewApiKey(id, options)` - POST to renew
  - [ ] `getApiKeyUsage(id, options)` - GET usage history
- [ ] Add error handling and TypeScript types

### Design System Compliance
- [ ] Replace all emojis with Lucide icons
  - [ ] 🤖 → `<Bot size={16} />`
  - [ ] 👥 → `<Users size={16} />`
  - [ ] 🔑 → `<Key size={16} />`
  - [ ] 🔒 → `<Lock size={16} />`
  - [ ] ⚠️ → `<AlertTriangle size={16} />`
  - [ ] ✅ → `<CheckCircle size={16} />`
- [ ] Use design system colors
  - [ ] Primary: #8b5cf6 (purple)
  - [ ] Success: #10b981 (green)
  - [ ] Warning: #f59e0b (amber)
  - [ ] Danger: #ef4444 (red)
- [ ] Follow spacing scale (4px-48px)
- [ ] Follow typography scale (11px-28px)

## Phase 3: Testing

### Backend Tests
- [ ] Unit tests for key generation
- [ ] Unit tests for key hashing
- [ ] Integration tests for authentication middleware
- [ ] Integration tests for API key CRUD
- [ ] Integration tests for actor enforcement
- [ ] Integration tests for expiration
- [ ] Integration tests for IP whitelisting
- [ ] Integration tests for audit logging

### Frontend Tests
- [ ] Component tests for ApiKeyList
- [ ] Component tests for ApiKeyCreateWizard
- [ ] Component tests for ApiKeyShowOnce
- [ ] Component tests for ApiKeyDetail
- [ ] Component tests for ApiKeyRenewDialog

### E2E Tests
- [ ] Create `openspec/testing/tests/api-keys.test.ts`
  - [ ] Test: Create service API key
    - [ ] Navigate to Settings > Integrations
    - [ ] Click "Create New Key"
    - [ ] Select "Service" type
    - [ ] Fill service configuration
    - [ ] Create key
    - [ ] Verify ShowOnce modal
    - [ ] Copy key
    - [ ] Verify key appears in list
  - [ ] Test: Create vendor API key
    - [ ] Navigate to Settings > Integrations
    - [ ] Click "Create New Key"
    - [ ] Select "Vendor" type
    - [ ] Fill vendor configuration
    - [ ] Create key
    - [ ] Verify ShowOnce modal with integration instructions
    - [ ] Copy key
    - [ ] Verify key appears in list
  - [ ] Test: Use service API key
    - [ ] Make API request with service key
    - [ ] Verify request succeeds
    - [ ] Verify audit log created
  - [ ] Test: Use vendor API key with actor
    - [ ] Make API request with vendor key and actor headers
    - [ ] Verify request succeeds
    - [ ] Verify audit log includes actor attribution
  - [ ] Test: Use vendor API key without actor (expect failure)
    - [ ] Make API request with vendor key, no actor headers
    - [ ] Verify request returns 400
    - [ ] Verify error message mentions required headers
  - [ ] Test: Expired key (expect failure)
    - [ ] Create key with 1-second expiration
    - [ ] Wait 2 seconds
    - [ ] Make API request
    - [ ] Verify request returns 401
  - [ ] Test: Renew expired key
    - [ ] Navigate to key detail
    - [ ] Click "Renew Key"
    - [ ] Confirm renewal
    - [ ] Verify new key shown in ShowOnce modal
    - [ ] Verify old key marked as revoked
    - [ ] Verify new key works
  - [ ] Test: Revoke key
    - [ ] Navigate to key detail
    - [ ] Click "Revoke Key"
    - [ ] Confirm revocation
    - [ ] Verify key marked as revoked
    - [ ] Make API request with revoked key
    - [ ] Verify request returns 401

## Phase 4: Documentation

### User Documentation
- [ ] Create `docs/api-keys-user-guide.md`
  - [ ] Overview of API keys
  - [ ] When to use Service vs Vendor keys
  - [ ] Creating API keys step-by-step
  - [ ] Managing permissions
  - [ ] Handling expiration and renewal
  - [ ] Revoking keys
  - [ ] Viewing usage and audit logs

### Integration Documentation
- [ ] Create `docs/api-keys-integration-guide.md`
  - [ ] API key authentication flow
  - [ ] Request header format
  - [ ] Actor attribution requirements for vendor keys
  - [ ] Error handling
  - [ ] Code examples (JavaScript, Python, cURL)
  - [ ] Best practices

### API Reference
- [ ] Create `docs/api-keys-api-reference.md`
  - [ ] Authentication endpoints
  - [ ] Management endpoints
  - [ ] Request/response schemas
  - [ ] Error codes and messages

### Security Guide
- [ ] Create `docs/api-keys-security.md`
  - [ ] Key storage best practices
  - [ ] Rotation recommendations
  - [ ] IP whitelisting guidance
  - [ ] Actor attribution requirements
  - [ ] Audit log retention
  - [ ] Compliance considerations

## Phase 5: Monitoring & Alerts

### Monitoring
- [ ] Add metrics for API key usage
  - [ ] Total API calls per key
  - [ ] Success/failure rates
  - [ ] Average response times
  - [ ] Actor attribution compliance (vendor keys)
- [ ] Add dashboard for API key health
  - [ ] Active keys count
  - [ ] Expiring soon (< 14 days)
  - [ ] Recently used keys
  - [ ] Top 10 most used keys

### Alerts
- [ ] Alert on API key creation (security team notification)
- [ ] Alert on keys expiring in 14 days (owner notification)
- [ ] Alert on keys expiring in 7 days (owner notification)
- [ ] Alert on keys expiring in 1 day (owner notification)
- [ ] Alert on high failure rates (> 10% failures)
- [ ] Alert on IP whitelist violations
- [ ] Alert on vendor keys used without actor headers (should never happen after validation)

## Phase 6: Deployment

### Pre-deployment
- [ ] Review all code changes
- [ ] Run full test suite (unit, integration, E2E)
- [ ] Verify backward compatibility (JWT still works)
- [ ] Security review of key storage and authentication
- [ ] Performance testing under load

### Deployment Steps
- [ ] Run database migration
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Verify health checks pass
- [ ] Smoke test: Create API key and make authenticated request
- [ ] Monitor error rates and performance

### Post-deployment
- [ ] Monitor API key usage for first 24 hours
- [ ] Check audit logs for proper attribution
- [ ] Verify no regressions in existing auth (JWT)
- [ ] Collect user feedback
- [ ] Address any issues

## Success Checklist

- [ ] Helios MTP can authenticate and operate successfully
- [ ] All vendor API actions show human actor attribution
- [ ] Zero plaintext keys stored in database
- [ ] Audit logs meet enterprise compliance requirements
- [ ] Key creation takes < 2 minutes end-to-end
- [ ] Renewal workflow takes < 1 minute
- [ ] All E2E tests passing (100%)
- [ ] Documentation complete and reviewed
- [ ] Security review completed
- [ ] Performance targets met (< 200ms P95 for API key auth)

## Notes

- Keep tasks small and testable (1-2 hours each)
- Complete in order (backend → frontend → tests → docs)
- Run tests after each major milestone
- Update this checklist as tasks are completed
- Mark with `[x]` when done, not before
