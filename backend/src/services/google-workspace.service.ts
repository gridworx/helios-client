import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from '../utils/logger';
import { db } from '../database/connection';

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface WorkspaceUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  suspended: boolean;
  orgUnitPath: string;
  creationTime: string;
  lastLoginTime?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    projectId: string;
    clientEmail: string;
    domain?: string;
    userCount?: number;
    adminUsers?: number;
  };
  error?: string;
}

export class GoogleWorkspaceService {
  /**
   * Store service account credentials for a tenant with Domain-Wide Delegation
   */
  async storeServiceAccountCredentials(
    tenantId: string,
    domain: string,
    credentials: ServiceAccountCredentials
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate credentials structure
      const requiredFields = [
        'type', 'project_id', 'private_key', 'client_email', 'client_id'
      ];

      for (const field of requiredFields) {
        if (!credentials[field as keyof ServiceAccountCredentials]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Store in tenant_credentials table (using correct columns)
      await db.query(`
        INSERT INTO tenant_credentials (tenant_id, service_account_key, admin_email, domain, admin_email_stored, scopes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (tenant_id)
        DO UPDATE SET
          service_account_key = EXCLUDED.service_account_key,
          admin_email = EXCLUDED.admin_email,
          domain = EXCLUDED.domain,
          admin_email_stored = EXCLUDED.admin_email_stored,
          scopes = EXCLUDED.scopes,
          updated_at = NOW()
      `, [
        tenantId,
        JSON.stringify(credentials),
        credentials.client_email,
        domain,
        credentials.client_email, // Store the admin email separately
        [
          'https://www.googleapis.com/auth/admin.directory.user',
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.orgunit',
          'https://www.googleapis.com/auth/admin.directory.domain',
          'https://www.googleapis.com/auth/admin.reports.audit.readonly'
        ]
      ]);

      logger.info('Service account credentials stored with DWD', {
        tenantId,
        domain,
        projectId: credentials.project_id,
        clientEmail: credentials.client_email
      });

      // Mark the module as enabled for this tenant
      await db.query(`
        INSERT INTO tenant_modules (tenant_id, module_name, is_enabled, configuration, updated_at)
        VALUES ($1, 'google_workspace', true, $2, NOW())
        ON CONFLICT (tenant_id, module_name)
        DO UPDATE SET
          is_enabled = true,
          configuration = $2,
          updated_at = NOW()
      `, [
        tenantId,
        JSON.stringify({ domain, adminEmail: credentials.client_email })
      ]);

      return {
        success: true,
        message: 'Service account credentials stored successfully with Domain-Wide Delegation'
      };

    } catch (error: any) {
      logger.error('Failed to store service account credentials', {
        tenantId,
        domain,
        error: error.message
      });

      return {
        success: false,
        message: `Failed to store credentials: ${error.message}`
      };
    }
  }

  /**
   * Create authenticated Google Admin SDK client with Domain-Wide Delegation
   */
  private createAdminClient(credentials: ServiceAccountCredentials, adminEmail: string) {
    const jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.orgunit',
        'https://www.googleapis.com/auth/admin.directory.domain',
        'https://www.googleapis.com/auth/admin.reports.audit.readonly'
      ],
      subject: adminEmail // This enables Domain-Wide Delegation - impersonate admin user
    });

    return google.admin({ version: 'directory_v1', auth: jwtClient });
  }

  /**
   * Get stored credentials for a tenant (matching backup structure)
   */
  private async getCredentials(tenantId: string): Promise<ServiceAccountCredentials | null> {
    try {
      const result = await db.query(
        'SELECT service_account_key FROM tenant_credentials WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return JSON.parse(result.rows[0].service_account_key);
    } catch (error) {
      logger.error('Failed to get credentials', { tenantId, error });
      return null;
    }
  }

  /**
   * Test Google Workspace connection using Domain-Wide Delegation
   */
  async testConnection(
    tenantId: string,
    domain: string,
    adminEmail?: string
  ): Promise<ConnectionTestResult> {
    try {
      // Load credentials from database
      const credentials = await this.getCredentials(tenantId);

      if (!credentials) {
        return {
          success: false,
          message: 'Service account credentials not found',
          error: 'No credentials found for this tenant. Please upload service account JSON file.'
        };
      }

      // Use provided admin email or construct from domain
      const testAdminEmail = adminEmail || `admin@${domain}`;

      // Create admin client with Domain-Wide Delegation
      const adminClient = this.createAdminClient(credentials, testAdminEmail);

      // Test basic domain access
      const domains = await adminClient.domains.list({ customer: 'my_customer' });

      // Test user access to verify DWD is working
      const users = await adminClient.users.list({
        customer: 'my_customer',
        maxResults: 5
      });

      const userCount = users.data.users?.length || 0;
      const adminUsers = users.data.users?.filter((user: any) => user.isAdmin).length || 0;

      logger.info('Google Workspace DWD connection test successful', {
        tenantId,
        domain,
        projectId: credentials.project_id,
        userCount,
        adminUsers
      });

      return {
        success: true,
        message: 'Domain-Wide Delegation connection successful',
        details: {
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          domain,
          userCount,
          adminUsers
        }
      };

    } catch (error: any) {
      logger.error('Google Workspace DWD connection test failed', {
        tenantId,
        domain,
        error: error.message
      });

      let errorMessage = 'Connection test failed';

      if (error.message.includes('domain-wide delegation')) {
        errorMessage = 'Domain-wide delegation not properly configured. Please enable domain-wide delegation for this service account in Google Admin Console.';
      } else if (error.message.includes('insufficient permissions')) {
        errorMessage = 'Insufficient permissions. Please ensure the service account has the required scopes enabled in domain-wide delegation.';
      } else if (error.message.includes('invalid_grant')) {
        errorMessage = 'Invalid service account credentials or domain-wide delegation not properly configured.';
      } else if (error.message.includes('unauthorized_client')) {
        errorMessage = 'Service account not authorized for domain-wide delegation. Please check your Google Admin Console configuration.';
      }

      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  }

  /**
   * Get Google Workspace users using Domain-Wide Delegation
   */
  async getUsers(
    tenantId: string,
    domain: string,
    adminEmail?: string,
    maxResults: number = 100
  ): Promise<{ success: boolean; users?: WorkspaceUser[]; error?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId);

      if (!credentials) {
        return {
          success: false,
          error: 'Service account credentials not found. Please configure Domain-Wide Delegation.'
        };
      }

      const testAdminEmail = adminEmail || `admin@${domain}`;
      const adminClient = this.createAdminClient(credentials, testAdminEmail);

      // Get users with Domain-Wide Delegation
      const response = await adminClient.users.list({
        customer: 'my_customer',
        maxResults,
        orderBy: 'email'
      });

      const users: WorkspaceUser[] = (response.data.users || []).map((user: any) => ({
        id: user.id || '',
        primaryEmail: user.primaryEmail || '',
        name: {
          givenName: user.name?.givenName || '',
          familyName: user.name?.familyName || '',
          fullName: user.name?.fullName || ''
        },
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        suspended: user.suspended || false,
        orgUnitPath: user.orgUnitPath || '/',
        creationTime: user.creationTime || '',
        lastLoginTime: user.lastLoginTime || undefined
      }));

      logger.info('Retrieved Google Workspace users via DWD', {
        tenantId,
        domain,
        userCount: users.length
      });

      return {
        success: true,
        users
      };

    } catch (error: any) {
      logger.error('Failed to retrieve Google Workspace users via DWD', {
        tenantId,
        domain,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Domain-Wide Delegation setup information
   */
  getDomainWideDelegationInfo(): {
    clientId: string | null;
    serviceAccountEmail: string | null;
    requiredScopes: string[];
    setupInstructions: string[];
  } {
    const requiredScopes = [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.orgunit',
      'https://www.googleapis.com/auth/admin.directory.domain',
      'https://www.googleapis.com/auth/admin.reports.audit.readonly'
    ];

    return {
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      requiredScopes,
      setupInstructions: [
        'Create a service account in Google Cloud Console',
        'Download the service account JSON file',
        'Enable Domain-Wide Delegation for the service account',
        'In Google Admin Console, go to Security > API Controls > Domain-wide delegation',
        'Add the service account client ID with the required scopes',
        'Upload the service account JSON file to this platform'
      ]
    };
  }

  /**
   * Get organizational units from Google Workspace
   */
  async getOrgUnits(tenantId: string): Promise<any> {
    try {
      // Get tenant info and credentials
      const tenantResult = await db.query(
        'SELECT domain FROM tenants WHERE id = $1',
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        return { success: false, error: 'Tenant not found' };
      }

      const domain = tenantResult.rows[0].domain;

      // Get stored credentials
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM tenant_credentials WHERE tenant_id = $1',
        [tenantId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this tenant' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      // Create JWT client with domain-wide delegation
      const authClient = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/admin.directory.orgunit'],
        subject: admin_email // Impersonate the admin
      });

      // Create Admin SDK client
      const admin = google.admin({ version: 'directory_v1', auth: authClient });

      // Get org units
      const response = await admin.orgunits.list({
        customerId: 'my_customer', // Use 'my_customer' for the customer of the admin user
        type: 'all'
      });

      const orgUnits = response.data.organizationUnits || [];

      logger.info('Retrieved organizational units', {
        tenantId,
        domain,
        count: orgUnits.length
      });

      return {
        success: true,
        orgUnits: orgUnits.map((unit: any) => ({
          id: unit.orgUnitId,
          name: unit.name,
          path: unit.orgUnitPath,
          parentPath: unit.parentOrgUnitPath || null,
          description: unit.description || '',
          blockInheritance: unit.blockInheritance || false
        }))
      };

    } catch (error: any) {
      logger.error('Failed to retrieve org units', {
        tenantId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync organizational units from Google Workspace to database
   */
  async syncOrgUnits(tenantId: string): Promise<any> {
    try {
      // First get the org units from Google
      const fetchResult = await this.getOrgUnits(tenantId);

      if (!fetchResult.success) {
        return fetchResult;
      }

      const orgUnits = fetchResult.orgUnits;

      // Begin transaction
      await db.query('BEGIN');

      try {
        // Clear existing org units for this tenant
        await db.query(
          'DELETE FROM organizational_units WHERE tenant_id = $1',
          [tenantId]
        );

        // Insert new org units
        for (const unit of orgUnits) {
          await db.query(`
            INSERT INTO organizational_units
            (id, tenant_id, name, path, parent_path, description, source_platform, external_id, sync_status, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            unit.id,
            tenantId,
            unit.name,
            unit.path,
            unit.parentPath,
            unit.description,
            'google_workspace',
            unit.id,
            'synced'
          ]);
        }

        // Update sync timestamp
        await db.query(`
          UPDATE tenant_modules
          SET last_sync = NOW(),
              configuration = configuration || jsonb_build_object('org_units_count', $2)
          WHERE tenant_id = $1 AND module_name = 'google_workspace'
        `, [tenantId, orgUnits.length]);

        await db.query('COMMIT');

        return {
          success: true,
          message: `Successfully synced ${orgUnits.length} organizational units`,
          count: orgUnits.length,
          orgUnits
        };

      } catch (dbError) {
        await db.query('ROLLBACK');
        throw dbError;
      }

    } catch (error: any) {
      logger.error('Failed to sync org units', {
        tenantId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();