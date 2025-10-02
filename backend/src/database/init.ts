import fs from 'fs';
import path from 'path';
import { db } from './connection';
import { logger } from '../utils/logger';

export class DatabaseInitializer {
  private schemaPath: string;

  constructor() {
    this.schemaPath = path.join(__dirname, '../../..', 'database', 'schema_organization.sql');
  }

  public async initializeDatabase(): Promise<void> {
    try {
      logger.info('Starting database initialization...');

      // Check if schema file exists
      if (!fs.existsSync(this.schemaPath)) {
        throw new Error(`Schema file not found at: ${this.schemaPath}`);
      }

      // Read schema file
      const schema = fs.readFileSync(this.schemaPath, 'utf8');

      // Execute schema
      await db.query(schema);

      logger.info('Database schema initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize database schema', error);
      throw error;
    }
  }

  public async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Check if database is accessible
      const healthCheck = await db.healthCheck();
      if (!healthCheck) {
        return false;
      }

      // Check if required tables exist
      const requiredTables = [
        'organizations',
        'organization_users',
        'organization_settings',
        'modules',
        'organization_modules',
        'user_sessions',
        'audit_logs'
      ];

      for (const table of requiredTables) {
        const result = await db.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )`,
          [table]
        );

        if (!result.rows[0].exists) {
          logger.warn(`Required table '${table}' does not exist`);
          return false;
        }
      }

      logger.info('Database health check passed');
      return true;

    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }

  public async isPlatformSetupComplete(): Promise<boolean> {
    try {
      const result = await db.query(
        "SELECT is_setup_complete FROM organizations LIMIT 1"
      );

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].is_setup_complete === true;
    } catch (error) {
      logger.error('Failed to check platform setup status', error);
      return false;
    }
  }

  public async markPlatformSetupComplete(): Promise<void> {
    try {
      await db.query(
        `UPDATE organizations
         SET is_setup_complete = true,
         updated_at = NOW()
         WHERE id = (SELECT id FROM organizations LIMIT 1)`
      );

      logger.info('Organization setup marked as complete');
    } catch (error) {
      logger.error('Failed to mark organization setup as complete', error);
      throw error;
    }
  }

  public async getAdminCount(): Promise<number> {
    try {
      const result = await db.query(
        "SELECT COUNT(*) as count FROM organization_users WHERE role = 'admin'"
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get admin count', error);
      throw error;
    }
  }

  public async seedInitialData(): Promise<void> {
    try {
      logger.info('Seeding initial data...');

      // Check if data already exists
      const adminCount = await this.getAdminCount();
      if (adminCount > 0) {
        logger.info('Admins already exist, skipping seed');
        return;
      }

      // The actual admin will be created during setup process
      // This is just for ensuring the database is ready

      logger.info('Initial data seeded successfully');
    } catch (error) {
      logger.error('Failed to seed initial data', error);
      throw error;
    }
  }
}

export const dbInitializer = new DatabaseInitializer();