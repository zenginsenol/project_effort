import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

/**
 * OpenAPI 3.0 specification for EstimatePro Public REST API
 *
 * This configuration generates interactive API documentation at /api/docs
 * following OpenAPI 3.0 specification standards.
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'EstimatePro Public API',
      version: '1.0.0',
      description: `
# EstimatePro Public REST API

The EstimatePro Public API allows you to integrate project estimation and cost analysis capabilities into your applications.

## Authentication

All API requests require authentication using an API key. Include your API key in the \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

API keys can be created and managed from your EstimatePro dashboard at \`/dashboard/api-keys\`.

## Rate Limiting

API requests are rate-limited based on your plan:
- **Standard Plan**: 1,000 requests per minute per API key
- **Enterprise Plan**: Custom limits

Rate limit information is included in response headers:
- \`X-RateLimit-Limit\`: Maximum requests per minute
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Timestamp when the rate limit resets

## Pagination

List endpoints support pagination using \`limit\` and \`offset\` query parameters:
- \`limit\`: Number of items to return (default: 20, max: 100)
- \`offset\`: Number of items to skip (default: 0)

## Errors

The API uses standard HTTP status codes and returns errors in JSON format:

\`\`\`json
{
  "error": "Error Type",
  "message": "Human-readable error description"
}
\`\`\`

Common error codes:
- \`400\`: Bad Request - Invalid parameters
- \`401\`: Unauthorized - Invalid or missing API key
- \`403\`: Forbidden - Insufficient permissions
- \`404\`: Not Found - Resource not found
- \`429\`: Too Many Requests - Rate limit exceeded
- \`500\`: Internal Server Error - Server error

## Webhooks

EstimatePro supports webhooks for real-time event notifications. See the Webhooks section in your dashboard to configure webhook endpoints.

Supported events:
- \`estimation.completed\`: Triggered when an estimation session is completed
- \`task.created\`: Triggered when a new task is created
- \`task.updated\`: Triggered when a task is updated
- \`analysis.exported\`: Triggered when a cost analysis is exported
- \`sync.completed\`: Triggered when an integration sync completes

## Support

For API support, contact us at api-support@estimatepro.com or visit our documentation at https://docs.estimatepro.com
      `.trim(),
      contact: {
        name: 'EstimatePro API Support',
        email: 'api-support@estimatepro.com',
        url: 'https://docs.estimatepro.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://estimatepro.com/terms',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
        description: 'API Server',
      },
    ],
    tags: [
      {
        name: 'Projects',
        description: 'Project management endpoints',
      },
      {
        name: 'Tasks',
        description: 'Task management endpoints',
      },
      {
        name: 'Estimates',
        description: 'Estimation session endpoints',
      },
      {
        name: 'Cost Analyses',
        description: 'Cost analysis and effort tracking endpoints',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API key authentication. Include your API key in the Authorization header as: `Bearer YOUR_API_KEY`',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type identifier',
              example: 'Unauthorized',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'API key required. Provide via Authorization: Bearer <api-key> header.',
            },
          },
        },
        RateLimitError: {
          type: 'object',
          required: ['error', 'message', 'retryAfter'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
              example: 'Too Many Requests',
            },
            message: {
              type: 'string',
              description: 'Rate limit error message',
              example: 'Rate limit exceeded. Maximum 1000 requests per minute allowed.',
            },
            retryAfter: {
              type: 'integer',
              description: 'Seconds to wait before retrying',
              example: 60,
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          required: ['total', 'limit', 'offset'],
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of items available',
              example: 150,
            },
            limit: {
              type: 'integer',
              description: 'Number of items per page',
              example: 20,
            },
            offset: {
              type: 'integer',
              description: 'Number of items skipped',
              example: 0,
            },
            hasMore: {
              type: 'boolean',
              description: 'Whether more items are available',
              example: true,
            },
          },
        },
        Project: {
          type: 'object',
          required: ['id', 'name', 'key', 'status', 'defaultEstimationMethod', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique project identifier',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
            organizationId: {
              type: 'string',
              format: 'uuid',
              description: 'Organization identifier',
              example: '660e8400-e29b-41d4-a716-446655440000',
            },
            name: {
              type: 'string',
              description: 'Project name',
              example: 'Mobile App Redesign',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Project description',
              example: 'Complete redesign of our mobile application',
            },
            key: {
              type: 'string',
              description: 'Short project identifier (2-10 uppercase letters)',
              pattern: '^[A-Z]+$',
              example: 'MAR',
            },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'completed'],
              description: 'Project status',
              example: 'active',
            },
            defaultEstimationMethod: {
              type: 'string',
              enum: ['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi'],
              description: 'Default estimation method for the project',
              example: 'planning_poker',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Project creation timestamp',
              example: '2024-01-15T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Project last update timestamp',
              example: '2024-01-20T14:45:00Z',
            },
          },
        },
        Task: {
          type: 'object',
          required: ['id', 'projectId', 'title', 'status', 'priority', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique task identifier',
              example: '770e8400-e29b-41d4-a716-446655440000',
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              description: 'Parent project identifier',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
            title: {
              type: 'string',
              description: 'Task title',
              example: 'Implement user authentication',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Task description',
              example: 'Add JWT-based authentication with refresh tokens',
            },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'review', 'done'],
              description: 'Task status',
              example: 'in_progress',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Task priority',
              example: 'high',
            },
            estimatedHours: {
              type: 'number',
              nullable: true,
              description: 'Estimated hours to complete the task',
              example: 8.5,
            },
            actualHours: {
              type: 'number',
              nullable: true,
              description: 'Actual hours spent on the task',
              example: 10.2,
            },
            assigneeId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Assigned user identifier',
              example: '880e8400-e29b-41d4-a716-446655440000',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task creation timestamp',
              example: '2024-01-15T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task last update timestamp',
              example: '2024-01-16T09:15:00Z',
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
};

/**
 * Swagger UI configuration for interactive API documentation
 * Accessible at /api/docs
 */
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/api/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    defaultModelsExpandDepth: 3,
    defaultModelExpandDepth: 3,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  theme: {
    title: 'EstimatePro API Documentation',
    favicon: [
      {
        filename: 'favicon.ico',
        rel: 'icon',
        sizes: '32x32',
        type: 'image/x-icon',
        content: Buffer.from(''),
      },
    ],
  },
};
