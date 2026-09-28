/**
 * Remote MCP endpoint over Streamable HTTP in stateless mode.
 *
 * POST handles every JSON-RPC message (initialize, tools/list, tools/call);
 * GET would open a server→client SSE stream, which a stateless deployment
 * does not need, so it is answered 405 by the transport itself; DELETE ends
 * the request-scoped session and always answers 200.
 *
 * Auth runs BEFORE the server is built: an `Authorization: Bearer au_conn_…`
 * header resolves a connection actor, anything else (including an invalid
 * credential) gets an actor-less server exposing only public operations.
 * Per request there is a fresh McpServer + fresh transport; stateless
 * transports must never be reused across requests.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildMcpServer } from '@/lib/mcp/server';
import { extractBearerToken } from '@/lib/owner/auth';
import { authenticateConnection } from '@/lib/connections/service';

/** Per-request McpServer + stateless transport; never shared across requests. */
async function handle(request: Request): Promise<Response> {
  const token = extractBearerToken(request.headers);
  let actor: Parameters<typeof buildMcpServer>[0];
  if (token) {
    try {
      actor = await authenticateConnection(token);
    } catch {
      actor = undefined; // invalid credential → public surface only
    }
  }

  const server: McpServer = buildMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no Mcp-Session-Id, no GET SSE stream
    enableJsonResponse: true, // plain JSON-RPC responses instead of SSE framing
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
