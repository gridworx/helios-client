import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Helios API Gateway',
      version: '1.0.0',
      description: `
# Helios API Gateway

Helios provides two types of APIs:

## 1. Helios-Specific Endpoints
Portal management, authentication, settings, and organization features.
These are documented below with full request/response schemas.

## 2. Transparent Proxy to Cloud Platforms
Access Google Workspace and Microsoft 365 APIs through Helios with full audit trail.

### Google Workspace Proxy

Any request to \`/api/v1/google/*\` is proxied to Google Workspace APIs:

**Example:**
\`\`\`bash
# Instead of calling Google directly:
POST https://admin.googleapis.com/admin/directory/v1/users

# Call through Helios (recommended - versioned):
POST https://helios.company.com/api/v1/google/admin/directory/v1/users

# Also works (deprecated - unversioned):
POST https://helios.company.com/api/google/admin/directory/v1/users
\`\`\`

**Benefits:**
- ✅ Full audit trail with actor attribution
- ✅ Automatic sync to Helios database
- ✅ Same request/response format as Google
- ✅ Works with ANY Google Workspace API endpoint

**Full API Reference:** [Google Workspace Admin SDK](https://developers.google.com/admin-sdk/directory/reference/rest)

### Microsoft 365 Proxy (Coming Soon)

\`/api/microsoft/*\` → Microsoft Graph API

---

## Authentication

All API requests require authentication using one of these methods:

### 1. User Token (JWT)
Login to Helios UI and get token from browser localStorage:
\`\`\`javascript
const token = localStorage.getItem('helios_token');
\`\`\`

### 2. Service API Key
For automation (Terraform, Ansible, CI/CD):
- Create in Settings > API Keys
- Type: Service
- Format: \`helios_service_<random>\`

### 3. Vendor API Key
For MSP/partner access with human attribution:
- Create in Settings > API Keys
- Type: Vendor
- Requires headers: \`X-Actor-Name\`, \`X-Actor-Email\`
- Format: \`helios_vendor_<random>\`

---

## Rate Limits

- Default: 100 requests per 15 minutes per IP
- Can be customized per API key
- Google/Microsoft rate limits still apply to proxied requests

---

## Support

- GitHub Issues: https://github.com/helios/helios-client/issues
- Documentation: https://docs.helios.io
      `,
      contact: {
        name: 'Helios Support',
        email: 'support@helios.io'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server (versioned API)'
      },
      {
        url: 'http://localhost:80/api/v1',
        description: 'Development server (via nginx proxy)'
      },
      {
        url: 'https://{domain}/api/v1',
        description: 'Production server',
        variables: {
          domain: {
            default: 'helios.example.com',
            description: 'Your Helios instance domain'
          }
        }
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Login, token refresh, and session management'
      },
      {
        name: 'Organization',
        description: 'Organization setup, users, groups, and settings'
      },
      {
        name: 'Google Workspace',
        description: 'Google Workspace module configuration and sync'
      },
      {
        name: 'API Keys',
        description: 'Manage service and vendor API keys'
      },
      {
        name: 'Google Workspace Proxy',
        description: 'Transparent proxy to Google Workspace APIs with audit trail',
        externalDocs: {
          description: 'Google Workspace Admin SDK Documentation',
          url: 'https://developers.google.com/admin-sdk/directory/reference/rest'
        }
      },
      {
        name: 'Labels & Customization',
        description: 'Customize entity labels (Users, Groups, etc.)'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/v1/auth/login'
        },
        ServiceApiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'Service API key for automation: "Bearer helios_service_..."'
        },
        VendorApiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'Vendor API key for MSP access: "Bearer helios_vendor_..." (requires X-Actor-Name and X-Actor-Email headers)'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            message: {
              type: 'string',
              example: 'Detailed error description'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ServiceApiKey: [] },
      { VendorApiKey: [] }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/middleware/transparent-proxy.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
