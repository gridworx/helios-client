/**
 * Knowledge Base MCP Tools
 *
 * Export all tool definitions and executors for AI integration.
 */

// Tool definitions (for OpenAI/MCP function schemas)
export { searchKnowledgeToolDefinition, executeSearchKnowledge } from './search-knowledge.tool';
export { getCommandToolDefinition, executeGetCommand } from './get-command.tool';
export { listCommandsToolDefinition, executeListCommands } from './list-commands.tool';

// Data query tools (read-only access to actual data)
export {
  queryGwUsersToolDefinition,
  queryGwGroupsToolDefinition,
  queryMs365UsersToolDefinition,
  getSyncStatusToolDefinition,
  dataQueryTools,
  executeDataQueryTool
} from './query-data.tool';

/**
 * All knowledge tool definitions (documentation search)
 */
export const knowledgeTools = [
  require('./search-knowledge.tool').searchKnowledgeToolDefinition,
  require('./get-command.tool').getCommandToolDefinition,
  require('./list-commands.tool').listCommandsToolDefinition
];

/**
 * Execute a knowledge tool by name
 */
export async function executeKnowledgeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'search_knowledge':
      const { executeSearchKnowledge } = await import('./search-knowledge.tool');
      return executeSearchKnowledge(params as Parameters<typeof executeSearchKnowledge>[0]);

    case 'get_command':
      const { executeGetCommand } = await import('./get-command.tool');
      return executeGetCommand(params as { name: string });

    case 'list_commands':
      const { executeListCommands } = await import('./list-commands.tool');
      return executeListCommands(params as { category?: string });

    default:
      return `Unknown tool: ${toolName}. Available tools: search_knowledge, get_command, list_commands`;
  }
}
