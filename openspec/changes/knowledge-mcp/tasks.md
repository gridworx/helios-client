# Knowledge MCP - Implementation Tasks

## Overview

Transform AI assistance from prompt-embedded documentation to a queryable Knowledge Base.

**Estimated Total Effort:** 4-5 days
**Priority:** P1 (Enables AI reliability)

---

## Phase 1: Core Infrastructure

### TASK-KB-001: Create Knowledge Base Schema and Types
**Priority:** P0
**Effort:** 2-3 hours
**Files to create:**
- `backend/src/knowledge/types.ts`
- `backend/src/knowledge/index.ts`

**Implementation:**

```typescript
// types.ts
export interface KnowledgeEntry {
  id: string;
  type: 'command' | 'api' | 'guide' | 'feature' | 'troubleshooting' | 'setting';
  title: string;
  category: string;
  subcategory?: string;
  content: string;
  summary: string;
  keywords: string[];
  aliases?: string[];           // Alternative ways to refer to this
  examples?: Example[];
  relatedIds?: string[];
  source?: string;              // 'manual' | 'auto:filename'
  lastUpdated: string;
}

export interface Example {
  description: string;
  code: string;
  output?: string;
}

export interface SearchOptions {
  type?: string;
  category?: string;
  limit?: number;
}

export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
  matchedOn: string[];          // What matched (title, keyword, alias, etc.)
}
```

**Acceptance Criteria:**
- [ ] Types exported and importable
- [ ] Interfaces match proposal schema
- [ ] JSDoc comments on all interfaces

---

### TASK-KB-002: Implement Keyword Search with Synonyms
**Priority:** P0
**Effort:** 3-4 hours
**Files to create:**
- `backend/src/knowledge/search.ts`
- `backend/src/knowledge/synonyms.ts`

**Implementation:**

```typescript
// synonyms.ts
export const SYNONYMS: Record<string, string[]> = {
  'get': ['list', 'show', 'view', 'display', 'retrieve', 'fetch', 'find'],
  'create': ['add', 'new', 'make', 'insert'],
  'delete': ['remove', 'destroy', 'drop', 'erase'],
  'update': ['edit', 'modify', 'change', 'patch'],
  'users': ['user', 'people', 'members', 'employees', 'staff'],
  'groups': ['group', 'teams', 'team'],
  'all': ['every', 'entire', 'complete'],
};

export function expandTerms(term: string): string[] {
  const lower = term.toLowerCase();
  const expanded = [lower];

  // Add synonyms
  if (SYNONYMS[lower]) {
    expanded.push(...SYNONYMS[lower]);
  }

  // Check if term is a synonym of something else
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.includes(lower)) {
      expanded.push(key, ...synonyms);
    }
  }

  return [...new Set(expanded)];
}
```

```typescript
// search.ts
import { KnowledgeEntry, SearchOptions, SearchResult } from './types';
import { expandTerms } from './synonyms';
import { loadKnowledgeBase } from './index';

export function searchKnowledge(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { type = 'all', category, limit = 5 } = options;

  // Tokenize and expand query
  const rawTerms = query.toLowerCase().split(/\s+/);
  const expandedTerms = rawTerms.flatMap(expandTerms);
  const uniqueTerms = [...new Set(expandedTerms)];

  // Load and filter knowledge base
  let entries = loadKnowledgeBase();
  if (type !== 'all') {
    entries = entries.filter(e => e.type === type);
  }
  if (category) {
    entries = entries.filter(e => e.category === category || e.subcategory === category);
  }

  // Score each entry
  const results: SearchResult[] = entries.map(entry => {
    const { score, matchedOn } = calculateScore(entry, uniqueTerms, rawTerms);
    return { entry, score, matchedOn };
  });

  // Sort and limit
  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function calculateScore(
  entry: KnowledgeEntry,
  expandedTerms: string[],
  originalTerms: string[]
): { score: number; matchedOn: string[] } {
  let score = 0;
  const matchedOn: string[] = [];

  // Exact full query match in title (highest)
  const titleLower = entry.title.toLowerCase();
  const fullQuery = originalTerms.join(' ');
  if (titleLower.includes(fullQuery)) {
    score += 50;
    matchedOn.push('title-exact');
  }

  // Alias match (very high)
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      if (alias.toLowerCase().includes(fullQuery)) {
        score += 40;
        matchedOn.push('alias');
        break;
      }
    }
  }

  // Title word match
  for (const term of expandedTerms) {
    if (titleLower.includes(term)) {
      score += 10;
      if (!matchedOn.includes('title')) matchedOn.push('title');
    }
  }

  // Keyword match
  for (const keyword of entry.keywords) {
    const kwLower = keyword.toLowerCase();
    for (const term of expandedTerms) {
      if (kwLower.includes(term) || term.includes(kwLower)) {
        score += 5;
        if (!matchedOn.includes('keyword')) matchedOn.push('keyword');
      }
    }
  }

  // Summary match
  const summaryLower = entry.summary.toLowerCase();
  for (const term of expandedTerms) {
    if (summaryLower.includes(term)) {
      score += 2;
      if (!matchedOn.includes('summary')) matchedOn.push('summary');
    }
  }

  // Content match (lowest weight)
  const contentLower = entry.content.toLowerCase();
  for (const term of originalTerms) {  // Use original terms for content
    if (contentLower.includes(term)) {
      score += 1;
      if (!matchedOn.includes('content')) matchedOn.push('content');
    }
  }

  return { score, matchedOn };
}
```

**Acceptance Criteria:**
- [ ] Synonyms expand search terms
- [ ] Alias matching works
- [ ] Scores prioritize exact matches
- [ ] Returns matchedOn for debugging

---

### TASK-KB-003: Create MCP Tool Definitions
**Priority:** P0
**Effort:** 2-3 hours
**Files to create:**
- `backend/src/knowledge/tools/search-knowledge.tool.ts`
- `backend/src/knowledge/tools/get-command.tool.ts`
- `backend/src/knowledge/tools/list-commands.tool.ts`
- `backend/src/knowledge/tools/index.ts`

**search-knowledge.tool.ts:**
```typescript
import { searchKnowledge } from '../search';
import { SearchResult } from '../types';

export const searchKnowledgeToolDefinition = {
  name: 'search_knowledge',
  description: `Search Helios knowledge base for commands, API endpoints, guides, and documentation.
ALWAYS use this before answering questions about how to do something in Helios.
Returns relevant documentation with exact commands and syntax.`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What you want to find (e.g., "list users", "create group", "sync google")'
      },
      type: {
        type: 'string',
        enum: ['all', 'command', 'api', 'guide', 'feature', 'troubleshooting', 'setting'],
        description: 'Filter by content type (default: all)'
      },
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "google-workspace", "microsoft-365")'
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 5)'
      }
    },
    required: ['query']
  }
};

export async function executeSearchKnowledge(params: {
  query: string;
  type?: string;
  category?: string;
  limit?: number;
}): Promise<string> {
  const results = searchKnowledge(params.query, {
    type: params.type,
    category: params.category,
    limit: params.limit || 5
  });

  if (results.length === 0) {
    return `No results found for "${params.query}".
Try using list_commands to see all available commands, or rephrase your search.`;
  }

  let response = `Found ${results.length} result(s) for "${params.query}":\n\n`;

  for (const result of results) {
    const { entry } = result;
    response += `### ${entry.title}\n`;
    response += `**Type:** ${entry.type} | **Category:** ${entry.category}\n\n`;
    response += `${entry.content}\n\n`;

    if (entry.examples && entry.examples.length > 0) {
      response += `**Example:**\n\`\`\`\n${entry.examples[0].code}\n\`\`\`\n\n`;
    }

    response += '---\n\n';
  }

  return response;
}
```

**Acceptance Criteria:**
- [ ] Tool definitions follow MCP schema
- [ ] Execute functions return formatted strings
- [ ] Clear descriptions for AI to understand usage
- [ ] Error handling for empty results

---

### TASK-KB-004: Wire Tools to AI Chat Endpoint
**Priority:** P0
**Effort:** 2-3 hours
**Files to modify:**
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/llm-gateway.service.ts`

**Changes to ai.routes.ts:**

```typescript
// Import knowledge tools
import {
  searchKnowledgeToolDefinition,
  executeSearchKnowledge,
  getCommandToolDefinition,
  executeGetCommand,
  listCommandsToolDefinition,
  executeListCommands
} from '../knowledge/tools';

// In /chat endpoint, add tools to the request if MCP is enabled
router.post('/chat', async (req, res) => {
  const config = await llmGatewayService.getConfig(organizationId);

  // Build tools array if MCP is enabled
  const tools: Tool[] = [];
  if (config?.mcpEnabled) {
    if (config.mcpTools.help) {
      tools.push({ type: 'function', function: searchKnowledgeToolDefinition });
    }
    if (config.mcpTools.commands) {
      tools.push({ type: 'function', function: getCommandToolDefinition });
      tools.push({ type: 'function', function: listCommandsToolDefinition });
    }
    // Add other tools based on mcpTools config...
  }

  // Send to LLM with tools
  const response = await llmGatewayService.complete(organizationId, userId, {
    messages,
    tools: tools.length > 0 ? tools : undefined
  });

  // Handle tool calls if present
  if (response.message.tool_calls) {
    // Execute tool calls and add results to conversation
    // Then make another LLM call with tool results
  }
});
```

**Acceptance Criteria:**
- [ ] Tools added based on mcpTools config
- [ ] Tool calls are executed
- [ ] Tool results fed back to LLM
- [ ] Multi-turn tool use works

---

## Phase 2: Content Migration

### TASK-KB-005: Create Initial Commands Knowledge Base
**Priority:** P0
**Effort:** 4-5 hours
**Files to create:**
- `backend/src/knowledge/content/commands.json`

**Structure each command as:**
```json
{
  "id": "cmd-gw-users-list",
  "type": "command",
  "title": "helios gw users list",
  "category": "developer-console",
  "subcategory": "google-workspace",
  "summary": "List all Google Workspace users from the synced directory",
  "content": "Lists all users synced from Google Workspace.\n\n**Syntax:**\n```\nhelios gw users list\n```\n\n**Output:** Table showing Email, Name, Status, Department for each user.\n\n**Note:** Data comes from the last sync. Use `helios gw sync users` to refresh.",
  "keywords": ["users", "list", "google", "workspace", "directory", "all"],
  "aliases": ["list google users", "show all users", "get gw users", "display workspace users"],
  "examples": [
    {
      "description": "List all users",
      "code": "helios gw users list"
    }
  ],
  "relatedIds": ["cmd-gw-users-get", "cmd-gw-sync-users"],
  "source": "manual",
  "lastUpdated": "2025-12-17"
}
```

**Commands to document (from DeveloperConsole.tsx):**

**Google Workspace Users (9 commands):**
- [ ] helios gw users list
- [ ] helios gw users get <email>
- [ ] helios gw users create <email> --firstName --lastName --password
- [ ] helios gw users update <email> --firstName --lastName
- [ ] helios gw users suspend <email>
- [ ] helios gw users restore <email>
- [ ] helios gw users delete <email>
- [ ] helios gw users move <email> --ou
- [ ] helios gw users groups <email>

**Google Workspace Groups (8 commands):**
- [ ] helios gw groups list
- [ ] helios gw groups get <email>
- [ ] helios gw groups create <email> --name --description
- [ ] helios gw groups update <email> --name
- [ ] helios gw groups delete <email>
- [ ] helios gw groups members <email>
- [ ] helios gw groups add-member <group> <user> --role
- [ ] helios gw groups remove-member <group> <user>

**Google Workspace OrgUnits (5 commands):**
- [ ] helios gw orgunits list
- [ ] helios gw orgunits get <path>
- [ ] helios gw orgunits create <parent> --name
- [ ] helios gw orgunits update <path> --name
- [ ] helios gw orgunits delete <path>

**Google Workspace Delegates (3 commands):**
- [ ] helios gw delegates list <user>
- [ ] helios gw delegates add <user> <delegate>
- [ ] helios gw delegates remove <user> <delegate>

**Google Workspace Sync (4 commands):**
- [ ] helios gw sync users
- [ ] helios gw sync groups
- [ ] helios gw sync orgunits
- [ ] helios gw sync all

**Helios Platform (2 commands):**
- [ ] helios users list
- [ ] helios users debug

**Direct API (4 commands):**
- [ ] helios api GET <path>
- [ ] helios api POST <path> <json>
- [ ] helios api PATCH <path> <json>
- [ ] helios api DELETE <path>

**Console Utilities (3 commands):**
- [ ] help
- [ ] examples
- [ ] clear

**Total: 38 commands**

**Acceptance Criteria:**
- [ ] All 38 commands documented
- [ ] Each has keywords and aliases
- [ ] Examples for common use cases
- [ ] relatedIds link related commands

---

### TASK-KB-006: Migrate Help Content to New Format
**Priority:** P1
**Effort:** 2-3 hours
**Files to create:**
- `backend/src/knowledge/content/guides.json`
- `backend/src/knowledge/content/features.json`

**Migrate from:** `backend/src/services/mcp/tools/help-search.tool.ts` (HELP_CONTENT array)

**Acceptance Criteria:**
- [ ] All existing help articles migrated
- [ ] New format with keywords and aliases
- [ ] Categories preserved
- [ ] Old HELP_CONTENT deprecated

---

### TASK-KB-007: Add Settings Documentation
**Priority:** P1
**Effort:** 2 hours
**Files to create:**
- `backend/src/knowledge/content/settings.json`

**Document configuration options for:**
- [ ] Google Workspace module settings
- [ ] Microsoft 365 module settings
- [ ] AI Assistant settings
- [ ] Sync settings
- [ ] Security settings

**Acceptance Criteria:**
- [ ] All configurable settings documented
- [ ] Where to find each setting
- [ ] What each option does

---

## Phase 3: Auto-Generation (Future Enhancement)

### TASK-KB-008: Command Auto-Generator
**Priority:** P2
**Effort:** 4-5 hours
**Files to create:**
- `backend/src/knowledge/generators/commands.generator.ts`

**Implementation:**
Parse `DeveloperConsole.tsx` to extract command handlers and generate knowledge entries.

**Acceptance Criteria:**
- [ ] Parses command handlers from source
- [ ] Generates valid KnowledgeEntry objects
- [ ] Writes to commands.json
- [ ] npm script: `npm run kb:generate:commands`

---

### TASK-KB-009: API Auto-Generator
**Priority:** P2
**Effort:** 4-5 hours
**Files to create:**
- `backend/src/knowledge/generators/api.generator.ts`

**Implementation:**
Parse OpenAPI spec to generate API endpoint documentation.

**Requires:** OpenAPI spec from `pre-release-infrastructure` proposal

**Acceptance Criteria:**
- [ ] Parses OpenAPI JSON
- [ ] Generates endpoint documentation
- [ ] Includes request/response examples
- [ ] npm script: `npm run kb:generate:api`

---

## Phase 4: Integration

### TASK-KB-010: Update System Prompt
**Priority:** P0
**Effort:** 1 hour
**Files to modify:**
- `backend/src/routes/ai.routes.ts`

**New minimal system prompt:**
```typescript
function getSystemPrompt(pageContext?: string, mcpEnabled?: boolean): string {
  if (!mcpEnabled) {
    // Fallback to existing prompt if MCP disabled
    return getStaticSystemPrompt(pageContext);
  }

  return `You are Helios AI Assistant, helping users with the Helios Client Portal.

## CRITICAL: Use Tools First
- ALWAYS use search_knowledge before answering questions about commands, API, or how-to
- Use get_command for exact syntax of a specific command
- Use list_commands to see all available commands
- NEVER make up commands or features - if search returns nothing, say so

## Your Capabilities
- Search documentation and guides
- Provide exact command syntax
- Explain features and settings
- Help troubleshoot issues

## Your Limitations
- You are READ-ONLY - cannot execute commands
- Cannot modify users, groups, or settings
- Can only tell users what to do, not do it for them

## Response Style
- Be concise and direct
- Provide exact commands when relevant
- Use code blocks for commands
- Link to relevant UI pages when helpful

${pageContext ? `User is currently on: ${pageContext}` : ''}`;
}
```

**Acceptance Criteria:**
- [ ] MCP-enabled prompt uses tools
- [ ] Non-MCP falls back to static prompt
- [ ] Shorter, focused instructions
- [ ] Clear tool usage guidance

---

### TASK-KB-011: Handle Tool Call Loop
**Priority:** P0
**Effort:** 3-4 hours
**Files to modify:**
- `backend/src/routes/ai.routes.ts`

**Implementation:**
When LLM returns tool_calls, execute them and send results back:

```typescript
async function processWithTools(
  organizationId: string,
  userId: string,
  messages: ChatMessage[],
  tools: Tool[],
  maxIterations: number = 3
): Promise<CompletionResponse> {
  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < maxIterations) {
    const response = await llmGatewayService.complete(organizationId, userId, {
      messages: currentMessages,
      tools
    });

    // If no tool calls, we're done
    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
      return response;
    }

    // Add assistant message with tool calls
    currentMessages.push(response.message);

    // Execute each tool call
    for (const toolCall of response.message.tool_calls) {
      const result = await executeToolCall(toolCall);
      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      });
    }

    iterations++;
  }

  throw new Error('Max tool iterations exceeded');
}

async function executeToolCall(toolCall: ToolCall): Promise<string> {
  const args = JSON.parse(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case 'search_knowledge':
      return await executeSearchKnowledge(args);
    case 'get_command':
      return await executeGetCommand(args);
    case 'list_commands':
      return await executeListCommands(args);
    default:
      return `Unknown tool: ${toolCall.function.name}`;
  }
}
```

**Acceptance Criteria:**
- [ ] Tool calls executed correctly
- [ ] Results fed back to LLM
- [ ] Multi-turn works (search → get_command → answer)
- [ ] Max iterations prevents infinite loops

---

## Testing

### TASK-KB-012: Unit Tests for Search
**Priority:** P1
**Effort:** 2-3 hours
**Files to create:**
- `backend/src/knowledge/__tests__/search.test.ts`

**Test cases:**
- [ ] Exact command match returns highest score
- [ ] Synonym expansion works ("get users" finds "list users")
- [ ] Alias matching works
- [ ] Category filtering works
- [ ] Empty results for unknown queries
- [ ] Limit parameter respected

---

### TASK-KB-013: Integration Tests for Tool Execution
**Priority:** P1
**Effort:** 2-3 hours
**Files to create:**
- `backend/src/knowledge/__tests__/tools.test.ts`

**Test cases:**
- [ ] search_knowledge returns formatted results
- [ ] get_command returns exact syntax
- [ ] list_commands shows all commands
- [ ] Tool call loop completes successfully

---

## Summary

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| 1. Infrastructure | KB-001 to KB-004 | 10-13 hours | P0 |
| 2. Content | KB-005 to KB-007 | 8-10 hours | P0-P1 |
| 3. Auto-Generate | KB-008 to KB-009 | 8-10 hours | P2 |
| 4. Integration | KB-010 to KB-011 | 4-5 hours | P0 |
| 5. Testing | KB-012 to KB-013 | 4-6 hours | P1 |

**Total Estimated Effort:** 34-44 hours (4-5 days)

**Recommended Order:**
1. KB-001, KB-002, KB-003, KB-004 (Core infrastructure)
2. KB-005 (Commands - most critical content)
3. KB-010, KB-011 (Integration)
4. KB-006, KB-007 (Additional content)
5. KB-012, KB-013 (Testing)
6. KB-008, KB-009 (Auto-generation - future)
