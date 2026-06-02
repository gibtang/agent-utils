import { successResponse } from '@/lib/response';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'AgentUtils API',
    version: '1.0.0',
    description: 'One API key. 2 agent-native utilities. Checkpoint for human approval + Dead Letter Queue for error recovery.',
    contact: { name: 'AgentUtils', url: 'https://www.agent-utils.com' },
  },
  servers: [{ url: 'https://www.agent-utils.com', description: 'Production' }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key starting with au_',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {},
        },
        required: ['success', 'data'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['success', 'error'],
      },
DeadLetter: {
        type: 'object',
        required: ['agentName', 'taskType', 'payload', 'error'],
        properties: {
          agentName: { type: 'string', description: 'Name of the agent that failed' },
          taskType: { type: 'string', description: 'Type of task that failed' },
          payload: { description: 'Original task input data' },
          error: { type: 'string', description: 'Error message' },
          retryWebhook: { type: 'string', format: 'uri', description: 'URL to POST payload on retry' },
        },
      },
      CheckpointCreate: {
        type: 'object',
        required: ['agentName', 'taskDescription', 'state', 'webhookUrl'],
        properties: {
          agentName: { type: 'string' },
          taskDescription: { type: 'string', description: 'What the agent wants to do' },
          state: { description: 'Serialized agent state (returned on approve)' },
          webhookUrl: { type: 'string', format: 'uri', description: 'URL to POST when human acts' },
        },
      },
      ResumeRequest: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['approve', 'reject'] },
          reason: { type: 'string', description: 'Reason for rejection' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/api/keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of API keys' },
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create API key',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', description: 'Human-readable key name' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API key created (full key shown once)' },
        },
      },
    },
    '/api/keys/{id}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke API key',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Key revoked' } },
      },
    },
    '/api/dlq': {
      post: {
        tags: ['Dead Letter Queue'],
        summary: 'Capture a failure',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DeadLetter' } } },
        },
        responses: { '201': { description: 'Failure captured' } },
      },
      get: {
        tags: ['Dead Letter Queue'],
        summary: 'List failures',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'retried', 'resolved', 'dismissed'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated list of failures' } },
      },
    },
    '/api/dlq/{id}': {
      get: {
        tags: ['Dead Letter Queue'],
        summary: 'Inspect failure (full payload)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Full failure details' } },
      },
      delete: {
        tags: ['Dead Letter Queue'],
        summary: 'Dismiss failure',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Failure dismissed' } },
      },
    },
    '/api/dlq/{id}/retry': {
      post: {
        tags: ['Dead Letter Queue'],
        summary: 'Retry — forward payload to webhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Payload forwarded to retry webhook' } },
      },
    },
    '/api/checkpoint': {
      post: {
        tags: ['Human-in-the-Loop'],
        summary: 'Create checkpoint (agent sleeps)',
        description: 'Pause agent until human approves or rejects. Returns checkpoint ID for polling.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckpointCreate' } } },
        },
        responses: { '201': { description: 'Checkpoint created' } },
      },
      get: {
        tags: ['Human-in-the-Loop'],
        summary: 'List checkpoints',
        responses: { '200': { description: 'List of checkpoints' } },
      },
    },
    '/api/checkpoint/{id}': {
      get: {
        tags: ['Human-in-the-Loop'],
        summary: 'Poll checkpoint status',
        description: 'Returns state only when approved. Pending checkpoints return state=null.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Checkpoint status' } },
      },
    },
    '/api/checkpoint/{id}/resume': {
      post: {
        tags: ['Human-in-the-Loop'],
        summary: 'Approve or reject checkpoint',
        description: 'Human action. Fires webhook to wake the agent.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumeRequest' } } },
        },
        responses: { '200': { description: 'Checkpoint resolved, webhook fired' } },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health and status' },
    { name: 'API Keys', description: 'Manage API keys' },
    { name: 'Dead Letter Queue', description: 'Capture and retry failures' },
    { name: 'Human-in-the-Loop', description: 'Pause agents for human approval' },
  ],
};

export async function GET() {
  return successResponse(spec);
}