import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '../../database/migrations/061_create_workflows_table.sql');
        console.log(`Reading migration from: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        await db.query(sql);

        console.log('✅ Migration 061_create_workflows_table.sql executed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
