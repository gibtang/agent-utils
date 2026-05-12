import { successResponse } from '@/lib/response';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'AgentUtils API',
    version: '1.0.0',
    description: 'One API key. 24 agent-native utilities. File hosting, PII redaction, dead letter queues, and more.',
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
      FileUpload: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Public URL with filename' },
          id: { type: 'string', description: 'File ID' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
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
      ShieldCleanRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'Text containing PII' },
        },
      },
      ShieldHydrateRequest: {
        type: 'object',
        required: ['text', 'sessionId'],
        properties: {
          text: { type: 'string', description: 'Text with placeholders' },
          sessionId: { type: 'string', description: 'Session ID from clean response' },
        },
      },
      OtpCreate: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', default: 'US', description: 'Country code (US only)' },
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
    '/api/file-host': {
      post: {
        tags: ['File Host'],
        summary: 'Upload a file',
        description: 'Upload a file for ephemeral hosting. Auto-expires based on tier.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
        },
        responses: {
          '201': {
            description: 'File uploaded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/api/file-host/{id}': {
      get: {
        tags: ['File Host'],
        summary: 'Retrieve a file',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'File data' },
          '404': { description: 'File not found or expired' },
        },
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
    '/api/shield': {
      get: {
        tags: ['Agent Shield'],
        summary: 'Shield info',
        description: 'Returns info about the PII redaction service.',
        responses: { '200': { description: 'Shield service info' } },
      },
    },
    '/api/shield/clean': {
      post: {
        tags: ['Agent Shield'],
        summary: 'Redact PII from text',
        description: 'Detect and replace PII with placeholders. Returns cleaned text + sessionId for later hydration.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ShieldCleanRequest' } } },
        },
        responses: { '200': { description: 'Redacted text with sessionId' } },
      },
    },
    '/api/shield/hydrate': {
      post: {
        tags: ['Agent Shield'],
        summary: 'Restore original PII values',
        description: 'Replace placeholders with original values using sessionId.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ShieldHydrateRequest' } } },
        },
        responses: { '200': { description: 'Hydrated text with original values' } },
      },
    },
    '/api/otp': {
      post: {
        tags: ['AgentVerify OTP'],
        summary: 'Provision temporary phone number',
        description: 'Provision a temporary phone number to receive SMS verification codes. Note: virtual numbers are blocked by WhatsApp, Google, Meta, and major crypto exchanges. Works for niche platforms and internal systems. Pro+ only.',
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OtpCreate' } } },
        },
        responses: { '201': { description: 'Session created with phone number' } },
      },
      get: {
        tags: ['AgentVerify OTP'],
        summary: 'List active OTP sessions',
        responses: { '200': { description: 'List of sessions' } },
      },
    },
    '/api/otp/{id}': {
      get: {
        tags: ['AgentVerify OTP'],
        summary: 'Poll for OTP code',
        description: 'Check if code has been received. Returns code when status=received.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Session status and code (if received)' } },
      },
      delete: {
        tags: ['AgentVerify OTP'],
        summary: 'Cancel OTP session',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Session cancelled' } },
      },
    },
    '/api/notify': {
      post: {
        tags: ['Notification Router'],
        summary: 'Send an email notification',
        description: 'Deliver a message to a human by email. If `to` is omitted, sends to your account email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message:  { type: 'string', description: 'Notification body' },
                  priority: { type: 'string', enum: ['urgent', 'normal', 'low'], default: 'normal' },
                  to:       { type: 'string', format: 'email', description: 'Recipient email (defaults to account email)' },
                  subject:  { type: 'string', description: 'Email subject (auto-generated if omitted)' },
                  metadata: { type: 'object', description: 'Arbitrary data shown in email and stored with the record' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Notification sent' },
          '502': { description: 'Email delivery failed' },
        },
      },
      get: {
        tags: ['Notification Router'],
        summary: 'List notification history',
        parameters: [
          { name: 'status',   in: 'query', schema: { type: 'string', enum: ['sent', 'failed'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['urgent', 'normal', 'low'] } },
          { name: 'limit',    in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset',   in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'Paginated notification history' } },
      },
    },
    '/api/notify/{id}': {
      get: {
        tags: ['Notification Router'],
        summary: 'Get notification detail',
        description: 'Returns full record including metadata.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Notification record' },
          '404': { description: 'Not found' },
        },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health and status' },
    { name: 'API Keys', description: 'Manage API keys' },
    { name: 'File Host', description: 'Ephemeral file hosting' },
{ name: 'Dead Letter Queue', description: 'Capture and retry failures' },
    { name: 'Human-in-the-Loop', description: 'Pause agents for human approval' },
    { name: 'Agent Shield', description: 'PII redaction and hydration' },
    { name: 'AgentVerify OTP', description: 'Temporary phone numbers for verification. Virtual numbers blocked by WhatsApp, Google, Meta, and major crypto exchanges. Works for niche platforms and internal systems.' },
    { name: 'Notification Router', description: 'Email notifications for agents' },
  ],
};

export async function GET() {
  return successResponse(spec);
}
