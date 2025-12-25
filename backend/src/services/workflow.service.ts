import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface Workflow {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    definition: any;
    trigger_type?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateWorkflowDto {
    name: string;
    description?: string;
    definition: any;
    trigger_type?: string;
    is_active?: boolean;
}

export interface UpdateWorkflowDto {
    name?: string;
    description?: string;
    definition?: any;
    trigger_type?: string;
    is_active?: boolean;
}

export class WorkflowService {
    /**
     * List all workflows for an organization
     */
    async listWorkflows(organizationId: string): Promise<Workflow[]> {
        try {
            const result = await db.query(
                `SELECT * FROM workflows 
         WHERE organization_id = $1 
         ORDER BY updated_at DESC`,
                [organizationId]
            );

            return result.rows;
        } catch (error) {
            logger.error('Error listing workflows', { error, organizationId });
            throw error;
        }
    }

    /**
     * Get a specific workflow by ID
     */
    async getWorkflow(organizationId: string, workflowId: string): Promise<Workflow | null> {
        try {
            const result = await db.query(
                `SELECT * FROM workflows 
         WHERE id = $1 AND organization_id = $2`,
                [workflowId, organizationId]
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting workflow', { error, workflowId, organizationId });
            throw error;
        }
    }

    /**
     * Create a new workflow
     */
    async createWorkflow(organizationId: string, data: CreateWorkflowDto): Promise<Workflow> {
        try {
            const result = await db.query(
                `INSERT INTO workflows (
          organization_id, name, description, definition, trigger_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
                [
                    organizationId,
                    data.name,
                    data.description || null,
                    data.definition || {},
                    data.trigger_type || null,
                    data.is_active || false
                ]
            );

            logger.info('Created workflow', {
                workflowId: result.rows[0].id,
                organizationId
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating workflow', { error, organizationId });
            throw error;
        }
    }

    /**
     * Update an existing workflow
     */
    async updateWorkflow(organizationId: string, workflowId: string, data: UpdateWorkflowDto): Promise<Workflow | null> {
        try {
            // Build dynamic update query
            const updates: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (data.name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(data.name);
            }

            if (data.description !== undefined) {
                updates.push(`description = $${paramCount++}`);
                values.push(data.description);
            }

            if (data.definition !== undefined) {
                updates.push(`definition = $${paramCount++}`);
                values.push(data.definition);
            }

            if (data.trigger_type !== undefined) {
                updates.push(`trigger_type = $${paramCount++}`);
                values.push(data.trigger_type);
            }

            if (data.is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(data.is_active);
            }

            if (updates.length === 0) {
                return this.getWorkflow(organizationId, workflowId);
            }

            // Add WHERE clause params
            values.push(workflowId);
            values.push(organizationId);

            const query = `
        UPDATE workflows 
        SET ${updates.join(', ')} 
        WHERE id = $${paramCount++} AND organization_id = $${paramCount++}
        RETURNING *
      `;

            const result = await db.query(query, values);

            if (result.rows.length > 0) {
                logger.info('Updated workflow', { workflowId, organizationId });
                return result.rows[0];
            }

            return null;
        } catch (error) {
            logger.error('Error updating workflow', { error, workflowId, organizationId });
            throw error;
        }
    }

    /**
     * Delete a workflow
     */
    async deleteWorkflow(organizationId: string, workflowId: string): Promise<boolean> {
        try {
            const result = await db.query(
                `DELETE FROM workflows 
         WHERE id = $1 AND organization_id = $2`,
                [workflowId, organizationId]
            );

            const deleted = (result.rowCount || 0) > 0;

            if (deleted) {
                logger.info('Deleted workflow', { workflowId, organizationId });
            }

            return deleted;
        } catch (error) {
            logger.error('Error deleting workflow', { error, workflowId, organizationId });
            throw error;
        }
    }
}

export const workflowService = new WorkflowService();
