# Helios Database

This directory contains the database migrations and documentation for the Helios Client Portal.

## ⚠️ Important: Migration-Based Schema

**DO NOT use `database/schema.sql`** - it has been removed as it was outdated and incorrect.

Helios uses a **migration-based** database system. The schema is built by running migrations sequentially.

## Database Architecture

**Single Organization Per Installation:**
- This is a single-tenant client portal
- One `organizations` record per installation
- All tables reference `organization_id` (not `tenant_id`)

## How to Work with the Database

### View Current Schema

Export the current schema from a running database:

```bash
# Full schema with data types, constraints, indexes
docker exec helios_client_postgres pg_dump -U postgres -d helios_client --schema-only > schema-export.sql

# Just list tables
docker exec helios_client_postgres psql -U postgres -d helios_client -c "\dt"

# Describe a specific table
docker exec helios_client_postgres psql -U postgres -d helios_client -c "\d organization_users"
```

### Create New Migrations

1. **Create migration file:**
   ```bash
   # migrations/025_your_change_description.sql
   ```

2. **Migration template:**
   ```sql
   -- Migration 025: Your Change Description
   -- Purpose: Brief explanation
   -- Created: 2025-11-06

   -- Your SQL here
   ALTER TABLE organization_users
   ADD COLUMN new_field VARCHAR(255);

   -- Always add index for foreign keys
   CREATE INDEX IF NOT EXISTS idx_new_field
   ON organization_users(new_field);
   ```

3. **Test locally:**
   ```bash
   psql -U postgres -d helios_client -f migrations/025_your_change.sql
   ```

4. **Migration runs automatically** on container restart via `backend/src/database/migrate.ts`

### Migration Naming Convention

```
NNN_descriptive_name.sql

001-010: Core system (auth, org setup)
011-020: User management features
021-030: Module system
031-040: Advanced features
```

### Current Migrations

See `migrations/` directory - currently at migration 024.

Key migrations:
- **001-009:** Core system setup
- **012:** User status system (user_status field)
- **014:** User types (staff, guest, contact)
- **015:** Google Workspace integration
- **023:** Removed duplicate status column
- **024:** Renamed 'pending' to 'staged'

## Reference Schema Export

For reference, the actual current schema is exported periodically to:

```
docs/architecture/schema-actual-YYYY-MM-DD.sql
```

**Latest:** `docs/architecture/schema-actual-2025-11-06.sql`

This is a snapshot for documentation purposes. **Do not apply this directly** - use migrations instead.

## Key Tables

### Core System
- `organizations` - Single organization per installation
- `organization_users` - Users within the organization
- `organization_settings` - Org configuration
- `organization_modules` - Enabled modules

### User Management
- `user_groups` - Groups/teams
- `user_group_memberships` - User-group relationships
- `departments` - Organizational structure
- `user_sessions` - Authentication sessions

### Google Workspace Integration
- `gw_credentials` - Service account credentials
- `gw_synced_users` - Cached GWS users
- `gw_groups` - Cached GWS groups
- `gw_org_units` - Cached GWS org units

### Modules
- `modules` - Available integration modules
- `access_groups` - GWS/M365 groups
- `access_group_members` - Group membership

## Common Pitfalls

### ❌ DON'T
- Create or reference `tenants` table (doesn't exist)
- Use `tenant_id` in new tables (use `organization_id`)
- Apply schema.sql directly (use migrations)
- Skip migration numbering sequence

### ✅ DO
- Use `organization_id` for all foreign keys to organizations table
- Create migrations for all schema changes
- Test migrations locally before committing
- Add indexes for all foreign keys
- Use `user_status` not `status` for user status

## Database Connection

Docker Compose configuration:
```yaml
Database: helios_client
User: postgres
Password: postgres
Port: 5432 (host) → 5432 (container)
```

Connection string:
```
postgresql://postgres:postgres@localhost:5432/helios_client
```

## Backups

**Development:**
```bash
docker exec helios_client_postgres pg_dump -U postgres -d helios_client > backup.sql
```

**Production:**
Use automated backup solution with retention policy.

## Troubleshooting

### Migration Failed
```bash
# Check migration status
docker exec helios_client_postgres psql -U postgres -d helios_client -c "SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 10;"

# Manually run specific migration
docker exec helios_client_postgres psql -U postgres -d helios_client -f migrations/025_fix.sql
```

### Table Doesn't Exist
```bash
# List all tables
docker exec helios_client_postgres psql -U postgres -d helios_client -c "\dt"

# Check if migrations ran
docker logs helios_client_backend | grep migration
```

### Wrong Column Name
Check the actual schema export, not old documentation:
```bash
docker exec helios_client_postgres psql -U postgres -d helios_client -c "\d table_name"
```
