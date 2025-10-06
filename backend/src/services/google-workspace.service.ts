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
   * Test connection with domain-wide delegation
   */
  async testConnectionWithDelegation(
    serviceAccount: ServiceAccountCredentials,
    adminEmail: string,
    domain: string
  ): Promise<ConnectionTestResult> {
    try {
      // Create JWT client with domain-wide delegation
      const jwtClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.user.readonly',
          'https://www.googleapis.com/auth/admin.directory.group.readonly'
        ],
        subject: adminEmail // Impersonate admin for domain-wide delegation
      });

      // Create admin client
      const admin = google.admin({ version: 'directory_v1', auth: jwtClient });

      // Test by fetching user count
      const usersResponse = await admin.users.list({
        domain: domain,
        maxResults: 1
      });

      // Test groups access
      const groupsResponse = await admin.groups.list({
        domain: domain,
        maxResults: 1
      });

      return {
        success: true,
        message: 'Successfully connected to Google Workspace',
        details: {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          domain: domain,
          userCount: usersResponse.data.users?.length || 0,
          adminUsers: 0
        }
      };
    } catch (error: any) {
      logger.error('Connection test failed', { error: error.message });

      let errorMessage = 'Failed to connect to Google Workspace';
      if (error.message?.includes('invalid_grant')) {
        errorMessage = 'Domain-wide delegation not properly configured. Please ensure the service account has been granted domain-wide delegation in Google Workspace Admin.';
      } else if (error.message?.includes('unauthorized_client')) {
        errorMessage = 'Service account not authorized. Please add the required scopes in Google Workspace Admin > Security > API Controls.';
      } else if (error.message?.includes('Not Authorized')) {
        errorMessage = 'Admin email is not a super admin or domain is incorrect.';
      }

      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  }

  /**
   * Store service account credentials for an organization with Domain-Wide Delegation
   */
  async storeServiceAccountCredentials(
    organizationId: string,
    domain: string,
    credentials: ServiceAccountCredentials,
    adminEmail?: string
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

      // Store in gw_credentials table
      // Use the provided admin email for impersonation, not the service account email
      const adminEmailToUse = adminEmail || `admin@${domain}`;

      await db.query(`
        INSERT INTO gw_credentials (organization_id, service_account_key, admin_email, domain, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (organization_id)
        DO UPDATE SET
          service_account_key = EXCLUDED.service_account_key,
          admin_email = EXCLUDED.admin_email,
          domain = EXCLUDED.domain,
          updated_at = NOW()
      `, [
        organizationId,
        JSON.stringify(credentials),
        adminEmailToUse,
        domain
      ]);

      logger.info('Service account credentials stored with DWD', {
        organizationId,
        domain,
        projectId: credentials.project_id,
        clientEmail: credentials.client_email
      });

      // Get the Google Workspace module ID
      const moduleResult = await db.query(
        `SELECT id FROM modules WHERE slug = 'google-workspace' LIMIT 1`
      );

      if (moduleResult.rows.length > 0) {
        const moduleId = moduleResult.rows[0].id;

        // Mark the module as enabled for this organization
        await db.query(`
          INSERT INTO organization_modules (organization_id, module_id, is_enabled, config, updated_at)
          VALUES ($1, $2, true, $3, NOW())
          ON CONFLICT (organization_id, module_id)
          DO UPDATE SET
            is_enabled = true,
            config = $3,
            updated_at = NOW()
        `, [
          organizationId,
          moduleId,
          JSON.stringify({ domain, adminEmail: adminEmailToUse })
        ]);
      }

      return {
        success: true,
        message: 'Service account credentials stored successfully with Domain-Wide Delegation'
      };

    } catch (error: any) {
      logger.error('Failed to store service account credentials', {
        organizationId,
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
   * Get stored credentials for an organization
   */
  private async getCredentials(organizationId: string): Promise<ServiceAccountCredentials | null> {
    try {
      const result = await db.query(
        'SELECT service_account_key FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return JSON.parse(result.rows[0].service_account_key);
    } catch (error) {
      logger.error('Failed to get credentials', { organizationId, error });
      return null;
    }
  }

  /**
   * Test Google Workspace connection using Domain-Wide Delegation
   */
  async testConnection(
    organizationId: string,
    domain: string,
    adminEmail?: string
  ): Promise<ConnectionTestResult> {
    try {
      // Load credentials from database
      const credentials = await this.getCredentials(organizationId);

      if (!credentials) {
        return {
          success: false,
          message: 'Service account credentials not found',
          error: 'No credentials found for this organization. Please upload service account JSON file.'
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
        organizationId,
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
        organizationId,
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
    organizationId: string,
    domain: string,
    adminEmail?: string,
    maxResults: number = 100
  ): Promise<{ success: boolean; users?: WorkspaceUser[]; error?: string }> {
    try {
      const credentials = await this.getCredentials(organizationId);

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
        organizationId,
        domain,
        userCount: users.length
      });

      return {
        success: true,
        users
      };

    } catch (error: any) {
      logger.error('Failed to retrieve Google Workspace users via DWD', {
        organizationId,
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
  async getOrgUnits(organizationId: string): Promise<any> {
    try {
      // Get organization info and credentials
      const orgResult = await db.query(
        'SELECT domain FROM organizations WHERE id = $1',
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        return { success: false, error: 'Organization not found' };
      }

      const domain = orgResult.rows[0].domain;

      // Get stored credentials
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
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

      // Get user counts from database for each org unit
      const userCountsResult = await db.query(`
        SELECT org_unit_path, COUNT(*) as user_count
        FROM gw_synced_users
        WHERE organization_id = $1
        GROUP BY org_unit_path
      `, [organizationId]);

      const userCounts = new Map(
        userCountsResult.rows.map((row: any) => [row.org_unit_path, parseInt(row.user_count)])
      );

      logger.info('Retrieved organizational units', {
        organizationId,
        domain,
        count: orgUnits.length
      });

      return {
        success: true,
        data: {
          orgUnits: orgUnits.map((unit: any) => ({
            id: unit.orgUnitId,
            name: unit.name,
            path: unit.orgUnitPath,
            parentPath: unit.parentOrgUnitPath || null,
            description: unit.description || '',
            blockInheritance: unit.blockInheritance || false,
            userCount: userCounts.get(unit.orgUnitPath) || 0
          }))
        }
      };

    } catch (error: any) {
      logger.error('Failed to retrieve org units', {
        organizationId,
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
  async syncOrgUnits(organizationId: string): Promise<any> {
    try {
      // First get the org units from Google
      const fetchResult = await this.getOrgUnits(organizationId);

      if (!fetchResult.success) {
        return fetchResult;
      }

      const orgUnits = fetchResult.data.orgUnits;

      // Begin transaction
      await db.query('BEGIN');

      try {
        // Clear existing org units for this organization
        await db.query(
          'DELETE FROM gw_org_units WHERE organization_id = $1',
          [organizationId]
        );

        // Insert new org units
        for (const unit of orgUnits) {
          await db.query(`
            INSERT INTO gw_org_units
            (organization_id, google_id, name, path, parent_id, description, last_sync_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            organizationId,
            unit.id,
            unit.name,
            unit.path,
            unit.parentPath || null,
            unit.description || null
          ]);
        }

        // Get module ID for Google Workspace
        const moduleResult = await db.query(
          `SELECT id FROM modules WHERE slug = 'google-workspace' LIMIT 1`
        );

        if (moduleResult.rows.length > 0) {
          const moduleId = moduleResult.rows[0].id;

          // Update sync timestamp
          await db.query(`
            UPDATE organization_modules
            SET last_sync_at = NOW(),
                config = config || jsonb_build_object('org_units_count', $3::integer)
            WHERE organization_id = $1 AND module_id = $2
          `, [organizationId, moduleId, orgUnits.length]);
        }

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
        organizationId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get setup status for Google Workspace integration
   */
  async getSetupStatus(organizationId: string): Promise<{
    isConfigured: boolean;
    config?: {
      domain?: string;
      adminEmail?: string;
    };
  }> {
    try {
      // Check if credentials exist
      const credResult = await db.query(
        `SELECT domain, admin_email FROM gw_credentials
         WHERE organization_id = $1`,
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { isConfigured: false };
      }

      const row = credResult.rows[0];
      return {
        isConfigured: true,
        config: {
          domain: row.domain,
          adminEmail: row.admin_email
        }
      };
    } catch (error: any) {
      logger.error('Failed to get setup status', {
        organizationId,
        error: error.message
      });
      return { isConfigured: false };
    }
  }

  /**
   * Get Google Workspace groups
   */
  async getGroups(organizationId: string): Promise<any> {
    try {
      // Get organization and credentials
      const credResult = await db.query(
        'SELECT service_account_key, admin_email, domain FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email, domain } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      // Create admin client
      const adminClient = this.createAdminClient(credentials, admin_email);

      // Get groups
      const response = await adminClient.groups.list({
        customer: 'my_customer',
        maxResults: 200
      });

      const groups = (response.data.groups || []).map((group: any) => ({
        id: group.id,
        name: group.name,
        email: group.email,
        description: group.description || '',
        directMembersCount: group.directMembersCount || 0,
        adminCreated: group.adminCreated || false
      }));

      logger.info('Retrieved Google Workspace groups', {
        organizationId,
        groupCount: groups.length
      });

      return {
        success: true,
        data: {
          groups
        }
      };

    } catch (error: any) {
      logger.error('Failed to fetch groups', {
        organizationId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add a member to a group
   */
  async addGroupMember(organizationId: string, groupId: string, email: string, role: string = 'MEMBER'): Promise<any> {
    try {
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      const adminClient = this.createAdminClient(credentials, admin_email);

      await adminClient.members.insert({
        groupKey: groupId,
        requestBody: {
          email,
          role
        }
      });

      logger.info('Added member to group', {
        organizationId,
        groupId,
        email,
        role
      });

      return {
        success: true,
        message: `Successfully added ${email} to the group`
      };

    } catch (error: any) {
      logger.error('Failed to add group member', {
        organizationId,
        groupId,
        email,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove a member from a group
   */
  async removeGroupMember(organizationId: string, groupId: string, memberEmail: string): Promise<any> {
    try {
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      const adminClient = this.createAdminClient(credentials, admin_email);

      await adminClient.members.delete({
        groupKey: groupId,
        memberKey: memberEmail
      });

      logger.info('Removed member from group', {
        organizationId,
        groupId,
        memberEmail
      });

      return {
        success: true,
        message: `Successfully removed ${memberEmail} from the group`
      };

    } catch (error: any) {
      logger.error('Failed to remove group member', {
        organizationId,
        groupId,
        memberEmail,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new group
   */
  async createGroup(organizationId: string, email: string, name: string, description: string): Promise<any> {
    try {
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      const adminClient = this.createAdminClient(credentials, admin_email);

      const response = await adminClient.groups.insert({
        requestBody: {
          email,
          name,
          description
        }
      });

      logger.info('Created new group', {
        organizationId,
        groupId: response.data.id,
        email,
        name
      });

      return {
        success: true,
        message: `Successfully created group ${name}`,
        data: {
          group: {
            id: response.data.id,
            email: response.data.email,
            name: response.data.name,
            description: response.data.description
          }
        }
      };

    } catch (error: any) {
      logger.error('Failed to create group', {
        organizationId,
        email,
        name,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update group settings
   */
  async updateGroup(organizationId: string, groupId: string, updates: { name?: string; description?: string }): Promise<any> {
    try {
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      const adminClient = this.createAdminClient(credentials, admin_email);

      const response = await adminClient.groups.patch({
        groupKey: groupId,
        requestBody: updates
      });

      logger.info('Updated group', {
        organizationId,
        groupId,
        updates
      });

      return {
        success: true,
        message: 'Successfully updated group',
        data: {
          group: {
            id: response.data.id,
            email: response.data.email,
            name: response.data.name,
            description: response.data.description
          }
        }
      };

    } catch (error: any) {
      logger.error('Failed to update group', {
        organizationId,
        groupId,
        updates,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get members of a specific group
   */
  async getGroupMembers(organizationId: string, groupId: string): Promise<any> {
    try {
      // Get credentials
      const credResult = await db.query(
        'SELECT service_account_key, admin_email FROM gw_credentials WHERE organization_id = $1',
        [organizationId]
      );

      if (credResult.rows.length === 0) {
        return { success: false, error: 'No credentials found for this organization' };
      }

      const { service_account_key, admin_email } = credResult.rows[0];
      const credentials = JSON.parse(service_account_key);

      // Create admin client
      const adminClient = this.createAdminClient(credentials, admin_email);

      // Get group members
      const response = await adminClient.members.list({
        groupKey: groupId
      });

      const members = (response.data.members || []).map((member: any) => ({
        id: member.id,
        email: member.email,
        role: member.role,
        type: member.type,
        status: member.status
      }));

      logger.info('Retrieved group members', {
        organizationId,
        groupId,
        memberCount: members.length
      });

      return {
        success: true,
        data: {
          members
        }
      };

    } catch (error: any) {
      logger.error('Failed to fetch group members', {
        organizationId,
        groupId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync groups from Google Workspace to database
   */
  async syncGroups(organizationId: string): Promise<any> {
    try {
      // Fetch groups from Google
      const fetchResult = await this.getGroups(organizationId);

      if (!fetchResult.success) {
        return fetchResult;
      }

      const groups = fetchResult.data.groups;

      // Begin transaction
      await db.query('BEGIN');

      try {
        // Clear existing groups for this organization
        await db.query(
          'DELETE FROM gw_groups WHERE organization_id = $1',
          [organizationId]
        );

        // Insert new groups
        for (const group of groups) {
          await db.query(`
            INSERT INTO gw_groups
            (organization_id, google_id, name, email, description, member_count, last_sync_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            organizationId,
            group.id,
            group.name,
            group.email,
            group.description,
            group.directMembersCount || 0
          ]);
        }

        // Update module sync timestamp
        const moduleResult = await db.query(
          `SELECT id FROM modules WHERE slug = 'google-workspace' LIMIT 1`
        );

        if (moduleResult.rows.length > 0) {
          const moduleId = moduleResult.rows[0].id;

          await db.query(`
            UPDATE organization_modules
            SET last_sync_at = NOW(),
                config = config || jsonb_build_object('groups_count', $3::integer)
            WHERE organization_id = $1 AND module_id = $2
          `, [organizationId, moduleId, groups.length]);
        }

        await db.query('COMMIT');

        return {
          success: true,
          message: `Successfully synced ${groups.length} groups`,
          count: groups.length,
          groups
        };

      } catch (dbError) {
        await db.query('ROLLBACK');
        throw dbError;
      }

    } catch (error: any) {
      logger.error('Failed to sync groups', {
        organizationId,
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