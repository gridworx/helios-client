/**
 * Run Google Workspace Migration 015
 *
 * This script runs the migration to create Google Workspace tables:
 * - gw_credentials
 * - gw_synced_users
 * - gw_groups
 * - gw_org_units
 *
 * Usage: npx ts-node src/scripts/run-gw-migration.ts
 */

import { db } from '../database/connection';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  try {
    console.log('🚀 Running Google Workspace Migration 015...\n');

    // Read migration file
    const migrationPath = join(__dirname, '../../../database/migrations/015_create_google_workspace_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await db.query(migrationSQL);

    console.log('\n✅ Migration 015 completed successfully!');
    console.log('\nGoogle Workspace tables created:');
    console.log('  ✓ gw_credentials');
    console.log('  ✓ gw_synced_users');
    console.log('  ✓ gw_groups');
    console.log('  ✓ gw_org_units');
    console.log('\nColumn added:');
    console.log('  ✓ organization_users.google_workspace_id');
    console.log('\n📋 Next steps:');
    console.log('  1. Start the backend server (npm run dev)');
    console.log('  2. Go to Settings > Modules in the frontend');
    console.log('  3. Enable Google Workspace');
    console.log('  4. Upload service account credentials');
    console.log('  5. Test connection and complete setup');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some tables already exist. This is normal if the migration was partially run before.');
      console.log('The migration handles this gracefully using IF NOT EXISTS clauses.');
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
