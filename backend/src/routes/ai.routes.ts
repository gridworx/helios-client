import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { llmGatewayService, ChatMessage, Tool } from '../services/llm-gateway.service';
import { logger } from '../utils/logger';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '../utils/response';
import { ErrorCode } from '../types/error-codes';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All AI routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /ai/config:
 *   get:
 *     summary: Get AI Assistant configuration
 *     description: Returns the current AI Assistant configuration for the organization. API keys are masked.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI configuration (API keys masked)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isConfigured:
 *                       type: boolean
 *                     isEnabled:
 *                       type: boolean
 *                     primaryEndpointUrl:
 *                       type: string
 *                     primaryModel:
 *                       type: string
 *                     hasPrimaryApiKey:
 *                       type: boolean
 *                     fallbackEndpointUrl:
 *                       type: string
 *                     fallbackModel:
 *                       type: string
 *                     hasFallbackApiKey:
 *                       type: boolean
 *                     toolCallModel:
 *                       type: string
 *                     maxTokensPerRequest:
 *                       type: integer
 *                     temperature:
 *                       type: number
 *                     requestsPerMinuteLimit:
 *                       type: integer
 *                     tokensPerDayLimit:
 *                       type: integer
 */
router.get('/config', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      validationErrorResponse(res, [{ field: 'organizationId', message: 'Organization ID not found' }]);
      return;
    }

    const config = await llmGatewayService.getConfig(organizationId);

    if (!config) {
      successResponse(res, {
        isConfigured: false,
        isEnabled: false
      });
      return;
    }

    // Return config with masked API keys
    successResponse(res, {
      isConfigured: true,
      isEnabled: config.isEnabled,
      primaryEndpointUrl: config.primaryEndpointUrl,
      primaryModel: config.primaryModel,
      hasPrimaryApiKey: !!config.primaryApiKey,
      fallbackEndpointUrl: config.fallbackEndpointUrl || null,
      fallbackModel: config.fallbackModel || null,
      hasFallbackApiKey: !!config.fallbackApiKey,
      toolCallModel: config.toolCallModel || null,
      maxTokensPerRequest: config.maxTokensPerRequest,
      temperature: config.temperature,
      contextWindowTokens: config.contextWindowTokens,
      requestsPerMinuteLimit: config.requestsPerMinuteLimit,
      tokensPerDayLimit: config.tokensPerDayLimit
    });
  } catch (error: any) {
    logger.error('Failed to get AI config', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to get AI configuration');
  }
});

/**
 * @openapi
 * /ai/config:
 *   put:
 *     summary: Update AI Assistant configuration
 *     description: Save or update AI Assistant configuration. Admin only.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primaryEndpointUrl:
 *                 type: string
 *                 description: Primary LLM endpoint URL (e.g., https://api.openai.com/v1)
 *               primaryApiKey:
 *                 type: string
 *                 description: API key for primary endpoint (optional for local models)
 *               primaryModel:
 *                 type: string
 *                 description: Model name (e.g., gpt-4o, claude-3-opus)
 *               fallbackEndpointUrl:
 *                 type: string
 *               fallbackApiKey:
 *                 type: string
 *               fallbackModel:
 *                 type: string
 *               toolCallModel:
 *                 type: string
 *                 description: Optional separate model for tool/function calls
 *               isEnabled:
 *                 type: boolean
 *               maxTokensPerRequest:
 *                 type: integer
 *               temperature:
 *                 type: number
 *               requestsPerMinuteLimit:
 *                 type: integer
 *               tokensPerDayLimit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
router.put('/config', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      validationErrorResponse(res, [{ field: 'organizationId', message: 'Organization ID not found' }]);
      return;
    }

    const {
      primaryEndpointUrl,
      primaryApiKey,
      primaryModel,
      fallbackEndpointUrl,
      fallbackApiKey,
      fallbackModel,
      toolCallModel,
      isEnabled,
      maxTokensPerRequest,
      temperature,
      contextWindowTokens,
      requestsPerMinuteLimit,
      tokensPerDayLimit
    } = req.body;

    // Validate required fields for new config
    const existingConfig = await llmGatewayService.getConfig(organizationId);
    if (!existingConfig && (!primaryEndpointUrl || !primaryModel)) {
      validationErrorResponse(res, [
        { field: 'primaryEndpointUrl', message: 'Primary endpoint URL is required' },
        { field: 'primaryModel', message: 'Primary model is required' }
      ]);
      return;
    }

    await llmGatewayService.saveConfig(organizationId, {
      primaryEndpointUrl,
      primaryApiKey,
      primaryModel,
      fallbackEndpointUrl: fallbackEndpointUrl || undefined,
      fallbackApiKey: fallbackApiKey || undefined,
      fallbackModel: fallbackModel || undefined,
      toolCallModel: toolCallModel || undefined,
      isEnabled,
      maxTokensPerRequest,
      temperature,
      contextWindowTokens,
      requestsPerMinuteLimit,
      tokensPerDayLimit
    });

    successResponse(res, { message: 'AI configuration saved successfully' });
  } catch (error: any) {
    logger.error('Failed to save AI config', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to save AI configuration');
  }
});

/**
 * @openapi
 * /ai/test-connection:
 *   post:
 *     summary: Test LLM endpoint connection
 *     description: Test connection to an LLM endpoint. Admin only.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - model
 *             properties:
 *               endpoint:
 *                 type: string
 *                 description: LLM endpoint URL
 *               apiKey:
 *                 type: string
 *                 description: API key (optional for local models)
 *               model:
 *                 type: string
 *                 description: Model name to test
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     modelInfo:
 *                       type: object
 *                       properties:
 *                         model:
 *                           type: string
 *                         responseTime:
 *                           type: integer
 *                     error:
 *                       type: string
 */
router.post('/test-connection', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint, apiKey, model } = req.body;

    if (!endpoint || !model) {
      validationErrorResponse(res, [
        !endpoint && { field: 'endpoint', message: 'Endpoint URL is required' },
        !model && { field: 'model', message: 'Model name is required' }
      ].filter(Boolean) as Array<{ field: string; message: string }>);
      return;
    }

    const result = await llmGatewayService.testConnection(endpoint, apiKey, model);
    successResponse(res, result);
  } catch (error: any) {
    logger.error('Connection test failed', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Connection test failed');
  }
});

/**
 * @openapi
 * /ai/chat:
 *   post:
 *     summary: Send a chat message to the AI Assistant
 *     description: Send a message and receive an AI response. Supports multi-turn conversations via sessionId.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Session ID for multi-turn conversations
 *               pageContext:
 *                 type: string
 *                 description: Current page/route the user is on
 *               includeHistory:
 *                 type: boolean
 *                 default: true
 *                 description: Include conversation history from session
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       format: uuid
 *                     message:
 *                       type: string
 *                     model:
 *                       type: string
 *                     usage:
 *                       type: object
 *                       properties:
 *                         promptTokens:
 *                           type: integer
 *                         completionTokens:
 *                           type: integer
 *                         totalTokens:
 *                           type: integer
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      validationErrorResponse(res, [{ field: 'user', message: 'User not found' }]);
      return;
    }

    const { message, sessionId: providedSessionId, pageContext, includeHistory = true } = req.body;

    if (!message) {
      validationErrorResponse(res, [{ field: 'message', message: 'Message is required' }]);
      return;
    }

    // Use provided session ID or generate new one
    const sessionId = providedSessionId || uuidv4();

    // Build messages array
    const messages: ChatMessage[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: getSystemPrompt(pageContext)
    });

    // Include conversation history if requested
    if (includeHistory && providedSessionId) {
      const history = await llmGatewayService.getChatHistory(organizationId, sessionId);
      messages.push(...history);
    }

    // Add current user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };
    messages.push(userMessage);

    // Save user message to history
    await llmGatewayService.saveChatMessage(organizationId, userId, sessionId, userMessage, pageContext);

    // Send to LLM
    const response = await llmGatewayService.complete(organizationId, userId, {
      messages
    });

    // Save assistant response to history
    await llmGatewayService.saveChatMessage(organizationId, userId, sessionId, response.message, pageContext);

    successResponse(res, {
      sessionId,
      message: response.message.content,
      model: response.model,
      usage: response.usage,
      endpointUsed: response.endpointUsed
    });
  } catch (error: any) {
    logger.error('AI chat failed', { error: error.message });

    if (error.message.includes('not configured') || error.message.includes('disabled')) {
      errorResponse(res, ErrorCode.CONFIGURATION_ERROR, error.message);
      return;
    }

    if (error.message.includes('Rate limit') || error.message.includes('token limit')) {
      errorResponse(res, ErrorCode.RATE_LIMIT_EXCEEDED, error.message);
      return;
    }

    errorResponse(res, ErrorCode.INTERNAL_ERROR, error.message || 'AI chat failed');
  }
});

/**
 * @openapi
 * /ai/usage:
 *   get:
 *     summary: Get AI usage statistics
 *     description: Returns usage statistics for the AI Assistant. Admin only.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include in statistics
 *     responses:
 *       200:
 *         description: Usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: integer
 *                     totalTokens:
 *                       type: integer
 *                     avgLatencyMs:
 *                       type: number
 *                     errorRate:
 *                       type: number
 *                     byDay:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           requests:
 *                             type: integer
 *                           tokens:
 *                             type: integer
 *                     byModel:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           model:
 *                             type: string
 *                           requests:
 *                             type: integer
 *                           tokens:
 *                             type: integer
 */
router.get('/usage', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      validationErrorResponse(res, [{ field: 'organizationId', message: 'Organization ID not found' }]);
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const stats = await llmGatewayService.getUsageStats(organizationId, days);

    successResponse(res, stats);
  } catch (error: any) {
    logger.error('Failed to get AI usage stats', { error: error.message });
    errorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to get usage statistics');
  }
});

/**
 * @openapi
 * /ai/status:
 *   get:
 *     summary: Get AI Assistant status (for all users)
 *     description: Returns whether the AI Assistant is enabled and available. For showing/hiding the AI UI.
 *     tags: [AI Assistant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                       description: Whether AI Assistant is enabled and configured
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      validationErrorResponse(res, [{ field: 'organizationId', message: 'Organization ID not found' }]);
      return;
    }

    const config = await llmGatewayService.getConfig(organizationId);
    const available = config?.isEnabled && !!config?.primaryEndpointUrl && !!config?.primaryModel;

    successResponse(res, { available });
  } catch (error: any) {
    logger.error('Failed to get AI status', { error: error.message });
    // Default to unavailable on error
    successResponse(res, { available: false });
  }
});

/**
 * Generate system prompt based on context
 */
function getSystemPrompt(pageContext?: string): string {
  let contextInfo = '';
  if (pageContext) {
    contextInfo = `\n\nThe user is currently on the ${pageContext} page.`;
  }

  return `You are Helios AI Assistant, a helpful assistant for the Helios Client Portal - a workspace management system that integrates with Google Workspace and Microsoft 365.

Your capabilities:
- Answer questions about the Helios platform features
- Help users understand how to use Google Workspace and Microsoft 365 integrations
- Explain user management, groups, and license concepts
- Provide guidance on onboarding/offboarding workflows
- Help troubleshoot common issues

Your limitations (READ-ONLY):
- You CANNOT create, modify, or delete users, groups, or licenses
- You CANNOT trigger syncs or make configuration changes
- You can ONLY provide information and generate commands/scripts for users to execute themselves

When users ask you to perform actions:
1. Explain what the action would do
2. Provide step-by-step instructions
3. Generate curl/PowerShell/Python commands they can run
4. Direct them to the appropriate page in the UI

Be concise, helpful, and professional. Use markdown formatting for clarity.${contextInfo}`;
}

export default router;
