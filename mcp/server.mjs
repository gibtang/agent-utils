#!/usr/bin/env node

/**
 * Agent-Utils MCP Server (Streamable HTTP)
 *
 * Exposes all 11 agent-utils.com tools via the Model Context Protocol.
 * Run: node mcp/server.mjs
 * Endpoint: http://localhost:3100/mcp
 *
 * Configure in Claude / Cursor / Windsurf:
 *   { "mcpServers": { "agent-utils": { "url": "http://localhost:3100/mcp", "transport": "streamable-http" } } }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcpMcpServer.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import { z } from 'zod';

const BASE_URL = process.env.AGENT_UTILS_URL || 'https://www.agent-utils.com';
const API_KEY = process.env.AGENT_UTILS_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
};

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}: ${body.error || res.statusText}`);
  return body;
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'agent-utils',
  version: '1.0.0',
  description: 'Agent-utils.com — 11 micro-tools for AI agents',
});

// ── System ──────────────────────────────────────────────────────────────────

server.tool('health', 'Check API health and connectivity', {}, async () => {
  const data = await api('/api/health');
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── API Keys ────────────────────────────────────────────────────────────────

server.tool('create_api_key', 'Create a new API key with specified plan', {
  name: z.string().describe('Label for the key'),
  plan: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
}, async ({ name, plan }) => {
  const data = await api('/api/keys', { method: 'POST', body: JSON.stringify({ name, plan }) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('list_api_keys', 'List all API keys', {}, async () => {
  const data = await api('/api/keys');
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── File Host ───────────────────────────────────────────────────────────────

server.tool('upload_file', 'Upload a file and get a public URL', {
  filename: z.string().describe('File name'),
  content: z.string().describe('Base64-encoded file content'),
  contentType: z.string().optional().describe('MIME type'),
}, async ({ filename, content, contentType }) => {
  const data = await api('/api/file-host', {
    method: 'POST',
    body: JSON.stringify({ filename, content, contentType }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Dead Letter Queue ───────────────────────────────────────────────────────

server.tool('dlq_push', 'Push a failed message to the dead letter queue', {
  queue: z.string().describe('Queue name'),
  payload: z.record(z.any()).describe('Message payload'),
  error: z.string().optional().describe('Error description'),
}, async ({ queue, payload, error }) => {
  const data = await api('/api/dlq', { method: 'POST', body: JSON.stringify({ queue, payload, error }) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('dlq_list', 'List dead letter queue entries', {
  queue: z.string().optional().describe('Filter by queue name'),
}, async ({ queue }) => {
  const params = queue ? `?queue=${encodeURIComponent(queue)}` : '';
  const data = await api(`/api/dlq${params}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Human-in-the-Loop ───────────────────────────────────────────────────────

server.tool('create_checkpoint', 'Create a checkpoint requiring human approval', {
  agentName: z.string().describe('Agent identifier'),
  action: z.string().describe('Action description'),
  data: z.record(z.any()).optional().describe('Action payload'),
  timeout: z.number().optional().describe('Timeout in seconds'),
}, async ({ agentName, action, data, timeout }) => {
  const body = { agentName, action, ...(data && { data }), ...(timeout && { timeout }) };
  const res = await api('/api/checkpoint', { method: 'POST', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
});

server.tool('get_checkpoint', 'Get checkpoint status', {
  id: z.string().describe('Checkpoint ID'),
}, async ({ id }) => {
  const data = await api(`/api/checkpoint/${id}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Agent Shield (PII) ─────────────────────────────────────────────────────

server.tool('redact_pii', 'Redact PII from text', {
  text: z.string().describe('Input text'),
}, async ({ text }) => {
  const data = await api('/api/shield/redact', { method: 'POST', body: JSON.stringify({ text }) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('hydrate_pii', 'Restore redacted PII using token map', {
  text: z.string().describe('Redacted text'),
  tokenMap: z.record(z.string()).describe('Token-to-value mapping from redact response'),
}, async ({ text, tokenMap }) => {
  const data = await api('/api/shield/hydrate', { method: 'POST', body: JSON.stringify({ text, tokenMap }) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── AgentVerify OTP ─────────────────────────────────────────────────────────

server.tool('request_otp', 'Get a temporary phone number for OTP verification', {
  country: z.string().optional().describe('ISO country code (e.g. US, GB)'),
}, async ({ country }) => {
  const body = country ? { country } : {};
  const data = await api('/api/otp', { method: 'POST', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('check_otp', 'Check OTP verification status', {
  id: z.string().describe('OTP request ID'),
}, async ({ id }) => {
  const data = await api(`/api/otp/${id}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Notification Router ─────────────────────────────────────────────────────

server.tool('send_notification', 'Send an email notification', {
  to: z.string().describe('Recipient email'),
  subject: z.string().describe('Email subject'),
  body: z.string().describe('Email body (HTML or plain text)'),
}, async ({ to, subject, body }) => {
  const data = await api('/api/notify', { method: 'POST', body: JSON.stringify({ to, subject, body }) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('get_notification', 'Get notification status', {
  id: z.string().describe('Notification ID'),
}, async ({ id }) => {
  const data = await api(`/api/notify/${id}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Audit Log ───────────────────────────────────────────────────────────────

server.tool('log_audit', 'Record an audit event', {
  agentName: z.string().describe('Agent identifier'),
  action: z.string().describe('Action performed'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
  severity: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
}, async ({ agentName, action, metadata, severity }) => {
  const body = { agentName, action, severity, ...(metadata && { metadata }) };
  const data = await api('/api/audit', { method: 'POST', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('list_audit', 'List audit entries with optional filters', {
  agentName: z.string().optional().describe('Filter by agent'),
  action: z.string().optional().describe('Filter by action'),
  severity: z.string().optional().describe('Filter by severity'),
  limit: z.number().optional().default(50),
}, async ({ agentName, action, severity, limit }) => {
  const params = new URLSearchParams();
  if (agentName) params.set('agentName', agentName);
  if (action) params.set('action', action);
  if (severity) params.set('severity', severity);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const data = await api(`/api/audit${qs ? `?${qs}` : ''}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── KV Store ────────────────────────────────────────────────────────────────

server.tool('kv_set', 'Store a key-value pair', {
  key: z.string().describe('Key name'),
  value: z.any().describe('JSON value to store'),
  ttl: z.number().optional().describe('Time-to-live in seconds'),
}, async ({ key, value, ttl }) => {
  const body = { key, value, ...(ttl && { ttl }) };
  const data = await api('/api/kv', { method: 'PUT', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('kv_get', 'Retrieve a value by key', {
  key: z.string().describe('Key to look up'),
}, async ({ key }) => {
  const data = await api(`/api/kv/${encodeURIComponent(key)}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('kv_delete', 'Delete a key', {
  key: z.string().describe('Key to delete'),
}, async ({ key }) => {
  const data = await api(`/api/kv/${encodeURIComponent(key)}`, { method: 'DELETE' });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Rate Limiter ────────────────────────────────────────────────────────────

server.tool('rate_limit_check', 'Check if an action is within rate limits', {
  key: z.string().describe('Rate limit key (e.g. agent-name:endpoint)'),
  limit: z.number().describe('Max allowed actions in window'),
  window: z.number().describe('Window in seconds'),
}, async ({ key, limit, window }) => {
  const data = await api('/api/rate-limit/check', {
    method: 'POST',
    body: JSON.stringify({ key, limit, window }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('rate_limit_reset', 'Reset a rate limit counter', {
  key: z.string().describe('Rate limit key to reset'),
}, async ({ key }) => {
  const data = await api('/api/rate-limit/reset', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Webhook Inbox ───────────────────────────────────────────────────────────

server.tool('create_webhook_inbox', 'Create a temporary webhook inbox', {
  description: z.string().optional().describe('Description of the inbox'),
  ttl: z.number().optional().describe('Time-to-live in seconds'),
}, async ({ description, ttl }) => {
  const body = { ...(description && { description }), ...(ttl && { ttl }) };
  const data = await api('/api/webhook', { method: 'POST', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('list_webhook_inboxes', 'List all webhook inboxes', {}, async () => {
  const data = await api('/api/webhook');
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('get_webhook_inbox', 'Get inbox details and captured payloads', {
  id: z.string().describe('Inbox ID'),
}, async ({ id }) => {
  const data = await api(`/api/webhook/${id}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Agent Form ──────────────────────────────────────────────────────────────

server.tool('create_form', 'Create a web form for human input', {
  title: z.string().describe('Form title'),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'number', 'select', 'textarea', 'checkbox']),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional().describe('Options for select type'),
  })).describe('Form field definitions'),
  webhookUrl: z.string().optional().describe('URL to POST responses to'),
  ttl: z.number().optional().describe('Time-to-live in seconds'),
}, async ({ title, fields, webhookUrl, ttl }) => {
  const body = { title, fields, ...(webhookUrl && { webhookUrl }), ...(ttl && { ttl }) };
  const data = await api('/api/form', { method: 'POST', body: JSON.stringify(body) });
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

server.tool('get_form', 'Get form status and collected responses', {
  id: z.string().describe('Form ID'),
}, async ({ id }) => {
  const data = await api(`/api/form/${id}`);
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.MCP_PORT || '3100', 10);

async function start() {
  const transport = new StreamableHTTPServerTransport({ sessionIdManager: undefined });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    if (req.url === '/mcp' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          await transport.handleRequest(req, res, JSON.parse(body));
        } catch (err) {
          res.writeHead(500).end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404).end('Not found. POST to /mcp for MCP protocol.');
    }
  });

  httpServer.listen(PORT, () => {
    console.error(`agent-utils MCP server listening on http://localhost:${PORT}/mcp`);
  });
}

start().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
