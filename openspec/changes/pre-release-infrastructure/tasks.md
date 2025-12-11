# Tasks: Pre-Release Infrastructure Cleanup

## Phase 1: Environment Validation

- [ ] **TASK-INFRA-001**: Create environment validation schema
  - File: `backend/src/config/env-validation.ts`
  - Use Joi to validate all required env vars
  - Different requirements for dev vs production
  - Clear error messages on failure

- [ ] **TASK-INFRA-002**: Add validation to startup
  - File: `backend/src/index.ts`
  - Call `validateEnv()` before anything else
  - Exit with code 1 if validation fails

- [ ] **TASK-INFRA-003**: Update .env.example with validation notes
  - Mark required vs optional
  - Note production requirements

## Phase 2: Request Tracing

- [ ] **TASK-INFRA-004**: Create request ID middleware
  - File: `backend/src/middleware/request-id.ts`
  - Generate UUID if not provided in `X-Request-ID` header
  - Attach to `req.requestId`
  - Set response header

- [ ] **TASK-INFRA-005**: Integrate with logger
  - File: `backend/src/utils/logger.ts`
  - Create child logger with requestId context
  - All route logs should include requestId

- [ ] **TASK-INFRA-006**: Add to index.ts
  - Register middleware early in chain
  - Before routes, after body parsing

## Phase 3: Response Standardization

- [ ] **TASK-INFRA-007**: Create response helpers
  - File: `backend/src/utils/response.ts`
  - `successResponse(res, data, meta)`
  - `errorResponse(res, status, code, message, details)`
  - `paginatedResponse(res, data, total, limit, offset)`
  - Include requestId in all responses

- [ ] **TASK-INFRA-008**: Create error codes enum
  - File: `backend/src/types/error-codes.ts`
  - Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, etc.
  - Export for use in routes and tests

- [ ] **TASK-INFRA-009**: Update error handler middleware
  - File: `backend/src/middleware/errorHandler.ts`
  - Use standardized error response format
  - Include requestId

## Phase 4: API Versioning

- [ ] **TASK-INFRA-010**: Update index.ts route registrations
  - Change all `/api/...` to `/api/v1/...`
  - Keep unversioned routes as aliases (deprecated)
  - Add deprecation warning header for unversioned

- [ ] **TASK-INFRA-011**: Update swagger config
  - File: `backend/src/config/swagger.ts`
  - Change base path to `/api/v1`
  - Update server URLs

- [ ] **TASK-INFRA-012**: Update frontend API config
  - File: `frontend/src/config/api.ts`
  - Add API_VERSION constant
  - Update apiPath helper to include version

- [ ] **TASK-INFRA-013**: Update all frontend fetch calls
  - This overlaps with frontend-api-url-refactor
  - All `/api/...` become `/api/v1/...`
  - 176 occurrences across 49 files

## Phase 5: CORS Cleanup

- [ ] **TASK-INFRA-014**: Fix CORS configuration
  - File: `backend/src/index.ts`
  - Use `FRONTEND_URL` and `PUBLIC_URL` env vars
  - Add `http://localhost:80` to dev origins
  - Add `X-Request-ID` to allowed headers

- [ ] **TASK-INFRA-015**: Remove deprecated env vars
  - Remove references to `APPURL`, `DOMAIN`
  - Update any documentation

## Phase 6: WebSocket Proxy

- [ ] **TASK-INFRA-016**: Add Socket.IO location to nginx
  - Files: `nginx/nginx.conf`, `nginx/nginx.prod.conf`
  - WebSocket upgrade headers
  - Extended timeout for long connections

- [ ] **TASK-INFRA-017**: Test WebSocket through nginx
  - Verify Socket.IO connects via port 80
  - Test presence/real-time features

## Phase 7: OpenAPI Documentation

### Core Schemas
- [ ] **TASK-INFRA-018**: Define User schema
- [ ] **TASK-INFRA-019**: Define Group schema
- [ ] **TASK-INFRA-020**: Define Organization schema
- [ ] **TASK-INFRA-021**: Define Department schema
- [ ] **TASK-INFRA-022**: Define common schemas (Pagination, Error, Success)

### Route Documentation (38 files)
- [ ] **TASK-INFRA-023**: Document auth.routes.ts
- [ ] **TASK-INFRA-024**: Document users.routes.ts
- [ ] **TASK-INFRA-025**: Document access-groups.routes.ts
- [ ] **TASK-INFRA-026**: Document dashboard.routes.ts
- [ ] **TASK-INFRA-027**: Document organization.routes.ts
- [ ] **TASK-INFRA-028**: Document departments.routes.ts
- [ ] **TASK-INFRA-029**: Document api-keys.routes.ts
- [ ] **TASK-INFRA-030**: Document audit-logs.routes.ts
- [ ] **TASK-INFRA-031**: Document labels.routes.ts
- [ ] **TASK-INFRA-032**: Document lifecycle.routes.ts
- [ ] **TASK-INFRA-033**: Document onboarding.routes.ts (if separate)
- [ ] **TASK-INFRA-034**: Document offboarding.routes.ts (if separate)
- [ ] **TASK-INFRA-035**: Document scheduled-actions.routes.ts (if separate)
- [ ] **TASK-INFRA-036**: Document google-workspace.routes.ts
- [ ] **TASK-INFRA-037**: Document assets.routes.ts
- [ ] **TASK-INFRA-038**: Document asset-proxy.routes.ts
- [ ] **TASK-INFRA-039**: Document signatures.routes.ts
- [ ] **TASK-INFRA-040**: Document org-chart.routes.ts
- [ ] **TASK-INFRA-041**: Document people.routes.ts
- [ ] **TASK-INFRA-042**: Document remaining route files (list all 38)

### Documentation Quality
- [ ] **TASK-INFRA-043**: Add request/response examples
- [ ] **TASK-INFRA-044**: Add error response examples
- [ ] **TASK-INFRA-045**: Verify all endpoints appear in /api/v1/openapi.json

## Phase 8: MCP Preparation

- [ ] **TASK-INFRA-046**: Install MCP SDK
  - Add `@modelcontextprotocol/sdk` to dependencies
  - Research latest API

- [ ] **TASK-INFRA-047**: Create OpenAPI to MCP converter
  - File: `backend/src/mcp/openapi-converter.ts`
  - Parse OpenAPI spec
  - Generate MCP tool definitions

- [ ] **TASK-INFRA-048**: Create MCP server skeleton
  - File: `backend/src/mcp/server.ts`
  - Register tools from OpenAPI
  - Authentication via API key

- [ ] **TASK-INFRA-049**: Add MCP endpoint
  - Route: `/api/v1/mcp` or separate port
  - WebSocket or HTTP transport

- [ ] **TASK-INFRA-050**: Document MCP integration
  - How to connect Claude/AI to Helios
  - Available tools and resources
  - Authentication requirements

## Phase 9: Refactor Existing Routes

- [ ] **TASK-INFRA-051**: Refactor auth routes to use response helpers
- [ ] **TASK-INFRA-052**: Refactor user routes to use response helpers
- [ ] **TASK-INFRA-053**: Refactor group routes to use response helpers
- [ ] **TASK-INFRA-054**: Refactor all remaining routes to use response helpers
  - Systematic update of all 38 route files
  - Replace inline `res.json()` with helpers

## Phase 10: Testing

- [ ] **TASK-INFRA-T01**: Test environment validation
  - Missing required vars fails startup
  - Optional vars have defaults
  - Production mode is stricter

- [ ] **TASK-INFRA-T02**: Test request tracing
  - Request ID in logs
  - Request ID in response headers
  - Request ID in error responses

- [ ] **TASK-INFRA-T03**: Test API versioning
  - `/api/v1/users` works
  - `/api/users` works (deprecated)
  - OpenAPI shows v1 paths

- [ ] **TASK-INFRA-T04**: Test CORS
  - Requests from FRONTEND_URL succeed
  - Requests from localhost:80 succeed
  - Requests from unknown origin blocked (production)

- [ ] **TASK-INFRA-T05**: Test WebSocket through nginx
  - Socket.IO connects via port 80
  - Real-time events work

- [ ] **TASK-INFRA-T06**: Test OpenAPI completeness
  - All endpoints documented
  - Schemas are valid
  - Swagger UI renders correctly

- [ ] **TASK-INFRA-T07**: Test MCP integration
  - Tool discovery works
  - Tool execution works
  - Authentication required

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Env Validation | 3 | 2 hours |
| Phase 2: Request Tracing | 3 | 2 hours |
| Phase 3: Response Standard | 3 | 2 hours |
| Phase 4: API Versioning | 4 | 3 hours |
| Phase 5: CORS Cleanup | 2 | 1 hour |
| Phase 6: WebSocket | 2 | 1 hour |
| Phase 7: OpenAPI Docs | 28 | 8-10 hours |
| Phase 8: MCP Prep | 5 | 4 hours |
| Phase 9: Route Refactor | 4 | 4 hours |
| Phase 10: Testing | 7 | 4 hours |

**Total: ~31-35 hours (~4-5 days focused work)**

## Route Files to Document (Full List)

```
backend/src/routes/
├── access-groups.routes.ts
├── api-keys.routes.ts
├── asset-proxy.routes.ts
├── assets.routes.ts
├── audit-logs.routes.ts
├── auth.routes.ts
├── cost-centers.routes.ts
├── custom-fields.routes.ts
├── dashboard.routes.ts
├── data-quality.routes.ts
├── departments.routes.ts
├── email-security.routes.ts
├── google-drive.routes.ts
├── google-workspace.routes.ts
├── helpdesk.routes.ts
├── labels.routes.ts
├── lifecycle.routes.ts
├── locations.routes.ts
├── modules.routes.ts
├── onboarding.routes.ts
├── org-chart.routes.ts
├── organization.routes.ts
├── people.routes.ts
├── public-files.routes.ts
├── security-events.routes.ts
├── setup.routes.ts
├── signature-assignments.routes.ts
├── signature-sync.routes.ts
├── signatures.routes.ts
├── tracking.routes.ts
├── transparent-proxy.routes.ts
├── users.routes.ts
├── workspaces.routes.ts
└── ... (count: 38 total)
```

## OpenAPI JSDoc Template

```typescript
/**
 * @openapi
 * /api/v1/resource:
 *   get:
 *     summary: Short description
 *     description: |
 *       Longer description with details.
 *       Can include markdown.
 *     tags: [TagName]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: paramName
 *         schema:
 *           type: string
 *         description: Parameter description
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResponseSchema'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
```

## Notes

### API Versioning Strategy
- v1 is frozen after release (no breaking changes)
- New features can be added to v1 (backwards compatible)
- Breaking changes require v2
- Deprecation period: 6 months minimum

### MCP Tool Naming Convention
- Prefix all tools with `helios_`
- Use snake_case: `helios_list_users`, `helios_create_group`
- Match OpenAPI operationId where possible

### OpenAPI Best Practices
- Every endpoint needs `summary` and `description`
- All parameters documented with types
- All response codes documented (200, 400, 401, 403, 404, 500)
- Request body schemas with examples
- Use `$ref` for reusable schemas
