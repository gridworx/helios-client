import axios from 'axios';

// Get API URL from env or default to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface WorkflowDefinition {
    nodes: any[];
    edges: any[];
    viewport?: { x: number; y: number; zoom: number };
}

export interface Workflow {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    trigger_type?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateWorkflowDto {
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    trigger_type?: string;
    is_active?: boolean;
}

export interface UpdateWorkflowDto {
    name?: string;
    description?: string;
    definition?: WorkflowDefinition;
    trigger_type?: string;
    is_active?: boolean;
}

class WorkflowsService {
    /**
     * List all workflows
     */
    async listWorkflows(): Promise<Workflow[]> {
        const response = await axios.get(`${API_URL}/workflows`);
        return response.data.data;
    }

    /**
     * Get a specific workflow
     */
    async getWorkflow(id: string): Promise<Workflow> {
        const response = await axios.get(`${API_URL}/workflows/${id}`);
        return response.data.data;
    }

    /**
     * Create a new workflow
     */
    async createWorkflow(data: CreateWorkflowDto): Promise<Workflow> {
        const response = await axios.post(`${API_URL}/workflows`, data);
        return response.data.data;
    }

    /**
     * Update a workflow
     */
    async updateWorkflow(id: string, data: UpdateWorkflowDto): Promise<Workflow> {
        const response = await axios.put(`${API_URL}/workflows/${id}`, data);
        return response.data.data;
    }

    /**
     * Delete a workflow
     */
    async deleteWorkflow(id: string): Promise<boolean> {
        await axios.delete(`${API_URL}/workflows/${id}`);
        return true;
    }
}

export const workflowsService = new WorkflowsService();
