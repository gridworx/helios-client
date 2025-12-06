import { db } from '../database/connection';
import { google } from 'googleapis';
import * as Handlebars from 'handlebars';

interface SignatureTemplate {
  id: string;
  name: string;
  description: string;
  html_template: string;
  text_template?: string;
  available_variables: string[];
}

interface SignatureCampaign {
  id: string;
  name: string;
  description?: string;
  template_id: string;
  template_name?: string;
  html_template?: string;
  campaign_banner_html?: string;
  campaign_banner_position: 'top' | 'bottom';
  target_type: 'all' | 'users' | 'groups' | 'departments' | 'org_units' | 'rules';
  target_ids?: string[];
  target_rules?: any;
  priority: number;
  start_date?: Date;
  end_date?: Date;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed';
  requires_approval: boolean;
}

interface UserSignatureData {
  name: string;
  email: string;
  title?: string;
  department?: string;
  phone?: string;
  company: string;
  photoUrl?: string;
  calendar_link?: string;
}

export class SignatureCampaignService {
  /**
   * Create a new signature template
   */
  async createTemplate(
    organizationId: string,
    name: string,
    htmlTemplate: string,
    textTemplate?: string,
    description?: string,
    createdBy?: string
  ): Promise<SignatureTemplate> {
    const query = `
      INSERT INTO signature_templates (
        organization_id, name, description, html_template, text_template, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      organizationId,
      name,
      description,
      htmlTemplate,
      textTemplate,
      createdBy
    ]);

    return result.rows[0];
  }

  /**
   * Get all templates for an organization
   */
  async getTemplates(organizationId: string): Promise<SignatureTemplate[]> {
    const query = `
      SELECT * FROM signature_templates
      WHERE organization_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Create a new signature campaign
   */
  async createCampaign(
    organizationId: string,
    campaign: Partial<SignatureCampaign>,
    createdBy?: string
  ): Promise<SignatureCampaign> {
    const query = `
      INSERT INTO signature_campaigns (
        organization_id, name, description, template_id,
        campaign_banner_html, campaign_banner_position,
        target_type, target_ids, target_rules,
        priority, start_date, end_date,
        status, requires_approval, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const result = await db.query(query, [
      organizationId,
      campaign.name,
      campaign.description,
      campaign.template_id,
      campaign.campaign_banner_html,
      campaign.campaign_banner_position || 'bottom',
      campaign.target_type,
      campaign.target_ids,
      campaign.target_rules ? JSON.stringify(campaign.target_rules) : null,
      campaign.priority || 50,
      campaign.start_date,
      campaign.end_date,
      campaign.status || 'draft',
      campaign.requires_approval !== false,
      createdBy
    ]);

    const createdCampaign = result.rows[0];

    // If targeting specific users, create assignments
    if (campaign.target_type === 'users' && campaign.target_ids?.length) {
      await this.createUserAssignments(organizationId, createdCampaign.id, campaign.target_ids);
    }

    return createdCampaign;
  }

  /**
   * Create user assignments for a campaign
   */
  private async createUserAssignments(
    organizationId: string,
    campaignId: string,
    userIds: string[]
  ): Promise<void> {
    const values = userIds.map(userId =>
      `('${organizationId}', '${userId}', '${campaignId}')`
    ).join(',');

    const query = `
      INSERT INTO user_signature_assignments (organization_id, user_id, campaign_id)
      VALUES ${values}
      ON CONFLICT (user_id, campaign_id) DO NOTHING
    `;

    await db.query(query);
  }

  /**
   * Get active campaigns for an organization
   */
  async getActiveCampaigns(organizationId: string): Promise<SignatureCampaign[]> {
    const query = `
      SELECT c.*, t.name as template_name, t.html_template
      FROM signature_campaigns c
      JOIN signature_templates t ON c.template_id = t.id
      WHERE c.organization_id = $1
        AND c.status IN ('active', 'approved')
        AND (c.start_date IS NULL OR c.start_date <= CURRENT_TIMESTAMP)
        AND (c.end_date IS NULL OR c.end_date >= CURRENT_TIMESTAMP)
      ORDER BY c.priority DESC, c.created_at DESC
    `;

    const result = await db.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Get campaigns for a specific user based on targeting
   */
  async getUserCampaigns(userId: string): Promise<SignatureCampaign | null> {
    const query = `
      SELECT * FROM get_user_active_campaign($1)
    `;

    const result = await db.query(query, [userId]);

    if (!result.rows[0]?.get_user_active_campaign) {
      return null;
    }

    // Fetch the full campaign details
    const campaignQuery = `
      SELECT c.*, t.html_template, t.text_template
      FROM signature_campaigns c
      JOIN signature_templates t ON c.template_id = t.id
      WHERE c.id = $1
    `;

    const campaignResult = await db.query(campaignQuery, [result.rows[0].get_user_active_campaign]);
    return campaignResult.rows[0];
  }

  /**
   * Build signature HTML for a user
   */
  async buildUserSignature(userId: string): Promise<string | null> {
    // Get user data
    const userQuery = `
      SELECT
        u.id, u.email, u.first_name, u.last_name,
        u.title, u.department, u.phone_number, u.photo_url,
        o.name as company
      FROM organization_users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `;

    const userResult = await db.query(userQuery, [userId]);

    if (!userResult.rows[0]) {
      return null;
    }

    const user = userResult.rows[0];
    const userData: UserSignatureData = {
      name: `${user.first_name} ${user.last_name}`.trim() || user.email,
      email: user.email,
      title: user.title,
      department: user.department,
      phone: user.phone_number,
      company: user.company,
      photoUrl: user.photo_url,
      calendar_link: `https://calendar.google.com/calendar/u/0/appointments/schedules/${user.email}`
    };

    // Get active campaign for user
    const campaign = await this.getUserCampaigns(userId);

    if (!campaign) {
      // Use default template if no campaign
      const defaultTemplateQuery = `
        SELECT html_template FROM signature_templates
        WHERE organization_id = $1 AND name = 'Professional Standard'
        LIMIT 1
      `;

      const templateResult = await db.query(defaultTemplateQuery, [user.organization_id]);

      if (!templateResult.rows[0]) {
        return this.buildBasicSignature(userData);
      }

      const template = Handlebars.compile(templateResult.rows[0].html_template);
      return template(userData);
    }

    // Build signature with campaign
    if (!campaign.html_template) {
      // Fallback to template without campaign data
      const templateResult = await db.query(
        'SELECT html_template FROM signature_templates WHERE id = $1',
        [campaign.template_id]
      );
      const template = Handlebars.compile(templateResult.rows[0].html_template);
      return template(userData);
    }

    const template = Handlebars.compile(campaign.html_template);
    let signature = template(userData);

    // Add campaign banner if exists
    if (campaign.campaign_banner_html) {
      if (campaign.campaign_banner_position === 'top') {
        signature = campaign.campaign_banner_html + signature;
      } else {
        signature = signature + campaign.campaign_banner_html;
      }
    }

    return signature;
  }

  /**
   * Build a basic signature if no templates exist
   */
  private buildBasicSignature(userData: UserSignatureData): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #333; font-size: 14px;">
        <strong>${userData.name}</strong><br>
        ${userData.title || ''}<br>
        ${userData.company}<br>
        ${userData.email}
        ${userData.phone ? `| ${userData.phone}` : ''}
      </div>
    `;
  }

  /**
   * Apply signature to user's Gmail account
   */
  async applySignatureToGmail(
    userId: string,
    serviceAccountKey: any,
    adminEmail: string
  ): Promise<void> {
    try {
      // Get user email
      const userQuery = `SELECT email FROM organization_users WHERE id = $1`;
      const userResult = await db.query(userQuery, [userId]);
      const userEmail = userResult.rows[0]?.email;

      if (!userEmail) {
        throw new Error('User not found');
      }

      // Build signature HTML
      const signatureHtml = await this.buildUserSignature(userId);

      if (!signatureHtml) {
        throw new Error('Could not build signature');
      }

      // Initialize Gmail API with domain-wide delegation
      const auth = new google.auth.JWT({
        email: serviceAccountKey.client_email,
        key: serviceAccountKey.private_key,
        scopes: ['https://www.googleapis.com/auth/gmail.settings.basic'],
        subject: userEmail // Impersonate this user
      });

      const gmail = google.gmail({ version: 'v1', auth });

      // Get current signatures
      const signaturesResponse = await gmail.users.settings.sendAs.list({
        userId: 'me'
      });

      const primaryAddress = signaturesResponse.data.sendAs?.find(
        sendAs => sendAs.isPrimary
      );

      if (primaryAddress) {
        // Update the signature
        await gmail.users.settings.sendAs.update({
          userId: 'me',
          sendAsEmail: primaryAddress.sendAsEmail!,
          requestBody: {
            signature: signatureHtml
          }
        });

        // Log the successful update
        await this.logSignatureUpdate(userId, 'applied');
      }
    } catch (error) {
      console.error(`Failed to apply signature for user ${userId}:`, error);
      await this.logSignatureUpdate(userId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Log signature update status
   */
  private async logSignatureUpdate(
    userId: string,
    status: 'applied' | 'failed',
    error?: string
  ): Promise<void> {
    const query = `
      UPDATE user_signature_assignments
      SET
        last_applied_at = CURRENT_TIMESTAMP,
        apply_status = $1,
        apply_error = $2
      WHERE user_id = $3
    `;

    await db.query(query, [status, error, userId]);
  }

  /**
   * Sync signatures for all users in organization
   */
  async syncOrganizationSignatures(
    organizationId: string,
    serviceAccountKey: any,
    adminEmail: string,
    syncType: 'scheduled' | 'manual' | 'campaign_launch' = 'manual',
    triggeredBy?: string
  ): Promise<void> {
    // Create sync log entry
    const logQuery = `
      INSERT INTO signature_sync_logs (
        organization_id, sync_type, triggered_by
      ) VALUES ($1, $2, $3)
      RETURNING id
    `;

    const logResult = await db.query(logQuery, [organizationId, syncType, triggeredBy]);
    const syncLogId = logResult.rows[0].id;

    try {
      // Get all active users
      const usersQuery = `
        SELECT id FROM organization_users
        WHERE organization_id = $1 AND is_active = true
      `;

      const usersResult = await db.query(usersQuery, [organizationId]);
      const users = usersResult.rows;

      let succeeded = 0;
      let failed = 0;
      const errors: any[] = [];

      // Process users in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (user: any) => {
            try {
              await this.applySignatureToGmail(user.id, serviceAccountKey, adminEmail);
              succeeded++;
            } catch (error) {
              failed++;
              errors.push({
                userId: user.id,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          })
        );

        // Add delay between batches to respect rate limits
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update sync log
      const updateLogQuery = `
        UPDATE signature_sync_logs
        SET
          completed_at = CURRENT_TIMESTAMP,
          users_processed = $1,
          users_succeeded = $2,
          users_failed = $3,
          detailed_errors = $4
        WHERE id = $5
      `;

      await db.query(updateLogQuery, [
        users.length,
        succeeded,
        failed,
        JSON.stringify(errors),
        syncLogId
      ]);
    } catch (error) {
      // Update sync log with error
      const updateLogQuery = `
        UPDATE signature_sync_logs
        SET
          completed_at = CURRENT_TIMESTAMP,
          error_summary = $1
        WHERE id = $2
      `;

      await db.query(updateLogQuery, [
        error instanceof Error ? error.message : 'Sync failed',
        syncLogId
      ]);

      throw error;
    }
  }

  /**
   * Approve a campaign
   */
  async approveCampaign(
    campaignId: string,
    approvedBy: string,
    notes?: string
  ): Promise<void> {
    const query = `
      UPDATE signature_campaigns
      SET
        status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        approval_notes = $2
      WHERE id = $3
    `;

    await db.query(query, [approvedBy, notes, campaignId]);
  }

  /**
   * Launch a campaign (make it active)
   */
  async launchCampaign(campaignId: string): Promise<void> {
    const query = `
      UPDATE signature_campaigns
      SET status = 'active'
      WHERE id = $1 AND status = 'approved'
    `;

    await db.query(query, [campaignId]);
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT usa.user_id) as total_users,
        COUNT(DISTINCT CASE WHEN usa.apply_status = 'applied' THEN usa.user_id END) as users_applied,
        COUNT(DISTINCT CASE WHEN usa.user_opted_out = true THEN usa.user_id END) as users_opted_out
      FROM signature_campaigns c
      LEFT JOIN user_signature_assignments usa ON c.id = usa.campaign_id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const result = await db.query(query, [campaignId]);
    return result.rows[0];
  }

  /**
   * Check if user has permission for signature management
   */
  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    const query = `SELECT user_has_signature_permission($1, $2) as has_permission`;
    const result = await db.query(query, [userId, permission]);
    return result.rows[0]?.has_permission || false;
  }
}

export const signatureCampaignService = new SignatureCampaignService();