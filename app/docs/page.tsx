import Link from 'next/link';
import type { Metadata } from 'next';
import { toolDocPages } from '@/lib/docs-pages';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Documentation — AgentUtils',
  description:
    'AgentUtils API documentation. Dead-letter queue, checkpoint approvals, KV store, audit log, and image upload.',
  openGraph: { url: '/docs' },
  alternates: { canonical: '/docs' },
};

export default function DocsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-3 text-zinc-400">
        Multi-tenant, agent-native infrastructure. One key per agent, tenant-isolated,
        callback-signed, idempotent.
      </p>

      <Link
        href="/docs/v2"
        className="mt-6 flex items-start gap-3 rounded-lg border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 hover:border-zinc-500 transition-colors"
      >
        <span className="text-2xl">⚡</span>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">AgentUtils API</h3>
            <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs font-medium text-emerald-300">
              current
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Full quick-start and reference for the launch tools. Start here.
          </p>
        </div>
      </Link>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm font-mono text-zinc-300 leading-relaxed overflow-x-auto">
          <p className="text-zinc-500"># 1. Create a tenant (public) — store the one-time admin key</p>
          <p>curl -X POST https://www.agent-utils.com/v1/tenants \</p>
          <p className="ml-4">-H &quot;content-type: application/json&quot; \</p>
          <p className="ml-4">-d {"{ \"name\":\"my-agent\", \"owner_email\":\"me@x.com\" }"}</p>
          <p className="mt-3 text-zinc-500"># 2. Register an agent — store the one-time agent key</p>
          <p>curl -X POST https://www.agent-utils.com/v1/agents \</p>
          <p className="ml-4">-H &quot;x-admin-key: agutil_adm_…&quot; \</p>
          <p className="ml-4">-d {"{ \"agent_id\":\"worker-1\" }"}</p>
          <p className="mt-3 text-zinc-500"># 3. Call any tool with the agent key</p>
          <p>curl -X PUT &quot;https://www.agent-utils.com/v1/kv/state/last&quot; \</p>
          <p className="ml-4">-H &quot;x-agent-id: worker-1&quot; -H &quot;x-api-key: agutil_agt_…&quot; \</p>
          <p className="ml-4">-d {"{ \"value\": { \"ts\": 1234567890 } }"}</p>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          See the <Link href="/docs/v2" className="underline hover:text-zinc-300">full v2 reference</Link> for auth,
          callbacks, quotas, and every endpoint.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">The launch tools</h2>
        <div className="space-y-3">
          {toolDocPages.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.canonicalPath}
              className="flex items-start gap-3 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
            >
              <span className="text-xl">{tool.tool.icon}</span>
              <div>
                <h3 className="font-semibold text-sm">{tool.tool.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-400">{tool.tool.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Reference</h2>
        <div className="space-y-3">
          <Link
            href="/docs/v2"
            className="flex items-start gap-3 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
          >
            <span className="text-xl">📖</span>
            <div>
              <h3 className="font-semibold text-sm">v2 API reference (human-readable)</h3>
              <p className="mt-0.5 text-sm text-zinc-400">All endpoints with copy-pasteable curl.</p>
            </div>
          </Link>
          <Link
            href="/llms.txt"
            className="flex items-start gap-3 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
          >
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="font-semibold text-sm">llms.txt (agent-readable)</h3>
              <p className="mt-0.5 text-sm text-zinc-400">The summary an agent reads to learn the API.</p>
            </div>
          </Link>
          <Link
            href="/openapi-v2.json"
            className="flex items-start gap-3 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
          >
            <span className="text-xl">🔧</span>
            <div>
              <h3 className="font-semibold text-sm">OpenAPI 3.1 spec (machine-readable)</h3>
              <p className="mt-0.5 text-sm text-zinc-400">20 paths, 31 operations.</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
