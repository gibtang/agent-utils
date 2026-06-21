import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'AgentUtils v2 API — Multi-tenant Infrastructure',
  description:
    'Tenant-isolated KV store, audit log, dead-letter queue, scheduler, and human-in-the-loop checkpoints. v2 API quick start and reference.',
  openGraph: { url: '/docs/v2' },
  alternates: { canonical: '/docs/v2' },
};

// Code snippets as plain template strings — avoids fragile JSX-embedded curlies.
const SNIP_CREATE_TENANT = `curl -X POST https://agentutils.dev/v1/tenants \\
  -H "content-type: application/json" \\
  -d '{ "name":"my-agent", "owner_email":"me@x.com", "plan":"free" }'

# → { "data": { "tenant_id":"ten_…", "admin_key":"agutil_adm_…" } }`;

const SNIP_REGISTER_AGENT = `curl -X POST https://agentutils.dev/v1/agents \\
  -H "x-admin-key: agutil_adm_…" \\
  -H "content-type: application/json" \\
  -d '{ "agent_id":"worker-1" }'

# → { "data": { "agent_id":"worker-1", "api_key":"agutil_agt_…" } }`;

const SNIP_KV = `curl -X PUT "https://agentutils.dev/v1/kv/state/last-run" \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{ "value": { "ts": 1234567890 }, "ttl_seconds": 3600 }'`;

const SNIP_AUDIT = `curl -X POST https://agentutils.dev/v1/audit \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{ "action":"email.sent", "workflow_id":"wf-42" }'`;

const SNIP_DLQ = `# capture
curl -X POST https://agentutils.dev/v1/dlq \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{ "payload": { "job": 7 }, "error": "SMTP timeout" }'

# claim atomically
curl -X POST https://agentutils.dev/v1/dlq/{id}/claim \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…"`;

const SNIP_SCHEDULE = `curl -X POST https://agentutils.dev/v1/schedules \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{ "callback_url":"https://myapp.com/hook", "callback_payload": {"job":7}, "fire_at":"2026-07-01T00:00:00Z" }'`;

const SNIP_HITL = `# create checkpoint
curl -X POST https://agentutils.dev/v1/checkpoints \\
  -H "x-agent-id: worker-1" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{ "title":"Approve refund?", "callback_url":"https://myapp.com/cb", "timeout_action":"auto_reject", "timeout_seconds": 3600 }'

# approve (admin or approval-proxy key)
curl -X POST https://agentutils.dev/v1/checkpoints/{id}/approve \\
  -H "x-admin-key: agutil_adm_…"`;

const SNIP_CALLBACK = `# verify (Node.js)
const sig = crypto.createHmac('sha256', secret)
  .update(\`\${ts}.\${rawBody}\`).digest('hex');
if (sig !== headerSignature) return 401;`;

const SNIP_ERROR = `{ "error": { "code": "…", "message": "…", "details": {}, "request_id": "…" } }`;

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200/90">
      {children}
    </div>
  );
}

export default function V2Docs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Docs
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">⚡ AgentUtils v2 API</h1>
      <p className="mt-3 text-zinc-400">
        Multi-tenant, agent-native infrastructure: KV store, audit log, dead-letter queue, scheduler,
        and human-in-the-loop checkpoints. Tenant-isolated, callback-signed, idempotent.
      </p>

      <Note>
        <strong>v2 is the current API.</strong> It lives under <code>/v1/*</code> and replaces the
        legacy single-tenant <code>/api/*</code> surface. The full machine-readable reference is at{' '}
        <Link href="/openapi-v2.json" className="underline">
          /openapi-v2.json
        </Link>{' '}
        and the agent-readable summary at{' '}
        <Link href="/llms-v2.txt" className="underline">
          /llms-v2.txt
        </Link>
        .
      </Note>

      {/* Auth */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Authentication</h2>
        <p className="mt-3 text-zinc-400">
          Identity is server-derived from the key prefix. <code>tenant_id</code> is never sent by the
          client — it is resolved from your key.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Prefix</th>
                <th className="py-2">Header(s)</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-900">
                <td className="py-2 pr-4">Admin</td>
                <td className="py-2 pr-4 font-mono text-xs">agutil_adm_…</td>
                <td className="py-2 font-mono text-xs">x-admin-key</td>
              </tr>
              <tr className="border-b border-zinc-900">
                <td className="py-2 pr-4">Agent</td>
                <td className="py-2 pr-4 font-mono text-xs">agutil_agt_…</td>
                <td className="py-2 font-mono text-xs">x-agent-id + x-api-key</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Approval-proxy</td>
                <td className="py-2 pr-4 font-mono text-xs">agutil_apr_…</td>
                <td className="py-2 font-mono text-xs">X-Approval-Key</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Keys are shown exactly once at creation/rotation and hashed at rest (SHA-256).
        </p>
      </section>

      {/* Quick start */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Quick start</h2>
        <p className="mt-3 text-zinc-400">
          Create a tenant, register an agent, then call any tool. Store both one-time keys
          immediately — they are not retrievable.
        </p>
        <h3 className="mt-6 text-lg font-medium">1. Create a tenant (public)</h3>
        <Code>{SNIP_CREATE_TENANT}</Code>
        <h3 className="mt-6 text-lg font-medium">2. Register an agent</h3>
        <Code>{SNIP_REGISTER_AGENT}</Code>
      </section>

      {/* Tools */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">The five tools</h2>

        <h3 className="mt-6 text-lg font-medium">🗃️ KV Store — tenant-isolated key-value with CAS + TTL</h3>
        <p className="mt-2 text-zinc-400">
          Namespaces isolate data within a tenant. Use <code>cas_version</code> for optimistic
          concurrency; set <code>ttl_seconds</code> to auto-expire.
        </p>
        <div className="mt-3">
          <Code>{SNIP_KV}</Code>
        </div>

        <h3 className="mt-6 text-lg font-medium">📜 Audit Log — append-only, immutable</h3>
        <p className="mt-2 text-zinc-400">
          Server stamps the timestamp and request id. Entries are immutable and never visible
          across tenants.
        </p>
        <div className="mt-3">
          <Code>{SNIP_AUDIT}</Code>
        </div>

        <h3 className="mt-6 text-lg font-medium">📬 Dead Letter Queue — pull-based failure inbox</h3>
        <p className="mt-2 text-zinc-400">
          Capture failures, then <code>claim</code> → process → <code>resolve</code> or{' '}
          <code>fail</code>. Locks auto-expire. AgentUtils does not execute retries — your agent pulls
          and resolves.
        </p>
        <div className="mt-3">
          <Code>{SNIP_DLQ}</Code>
        </div>

        <h3 className="mt-6 text-lg font-medium">⏰ Scheduler — once-callbacks with fixed retry</h3>
        <p className="mt-2 text-zinc-400">
          Schedule a signed callback at <code>fire_at</code>. Fixed retry on failure: at the time,
          then +30s, +90s. Optional DLQ cascade on exhaustion.
        </p>
        <div className="mt-3">
          <Code>{SNIP_SCHEDULE}</Code>
        </div>

        <h3 className="mt-6 text-lg font-medium">👤 Human-in-the-Loop — checkpoints for approval</h3>
        <p className="mt-2 text-zinc-400">
          Create a checkpoint to pause for human approval. Approve/reject with the admin key or a
          scoped approval-proxy key. Timeouts auto-reject or DLQ per <code>timeout_action</code>.
        </p>
        <div className="mt-3">
          <Code>{SNIP_HITL}</Code>
        </div>
      </section>

      {/* Callbacks */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Signed callbacks</h2>
        <p className="mt-3 text-zinc-400">
          When AgentUtils calls your <code>callback_url</code> (scheduler fire, checkpoint
          resolution), every request is HMAC-SHA256 signed over the tenant&apos;s{' '}
          <code>callback_secret</code>. Verify on receipt and reject callbacks older than 5 minutes.
        </p>
        <div className="mt-3">
          <Code>{SNIP_CALLBACK}</Code>
        </div>
      </section>

      {/* Conventions */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Conventions</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li>
            <strong className="text-zinc-200">Idempotency:</strong> send{' '}
            <code>Idempotency-Key</code> on any <code>POST</code> that creates a resource. Replays
            return the original result.
          </li>
          <li>
            <strong className="text-zinc-200">Pagination:</strong> list endpoints use{' '}
            <code>?cursor=</code> + <code>?limit=</code>. Response includes <code>meta.cursor</code>{' '}
            and <code>meta.has_more</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Rate limiting:</strong> per-tenant sliding minute.{' '}
            <code>429 RATE_LIMITED</code> includes a <code>Retry-After</code> header.
          </li>
          <li>
            <strong className="text-zinc-200">Quota:</strong> per-plan limits.{' '}
            <code>402 QUOTA_EXCEEDED</code> on overrun. Check usage via{' '}
            <code>GET /v1/tenants/&#123;id&#125;</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Errors:</strong>{' '}
            <code className="font-mono">{SNIP_ERROR}</code>. Every response includes{' '}
            <code>X-Request-Id</code>.
          </li>
        </ul>
      </section>

      <section className="mt-10 mb-4">
        <h2 className="text-2xl font-semibold">Full reference</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link href="/openapi-v2.json" className="text-zinc-300 underline">
              OpenAPI 3.1 spec (machine-readable)
            </Link>
          </li>
          <li>
            <Link href="/llms-v2.txt" className="text-zinc-300 underline">
              llms-v2.txt (agent-readable summary)
            </Link>
          </li>
          <li>
            <Link
              href="https://github.com/gibtang/agent-utils/blob/v2-rebuild/docs/product/agentutils-v2-migration-plan.md"
              className="text-zinc-300 underline"
            >
              Migration plan from v1
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
