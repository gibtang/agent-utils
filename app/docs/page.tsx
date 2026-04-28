import Link from 'next/link';

export const dynamic = 'force-static';

const tools = [
  { slug: 'file-host', name: 'Ephemeral File Host', desc: 'Park files for agents with auto-expiry. Upload, retrieve, done.', icon: '📎' },
  { slug: 'json', name: 'JSON Cleaner', desc: 'Normalize messy LLM output into valid, sorted JSON.', icon: '🧹' },
  { slug: 'dlq', name: 'Dead Letter Queue', desc: 'Catch failed agent tasks, inspect payloads, retry with webhooks.', icon: '📬' },
  { slug: 'checkpoint', name: 'Human-in-the-Loop Gate', desc: 'Pause agents until a human approves or rejects.', icon: '👤' },
  { slug: 'shield', name: 'Agent Shield (PII)', desc: 'Redact PII before LLM calls, hydrate it back after.', icon: '🛡️' },
  { slug: 'otp', name: 'AgentVerify OTP', desc: 'Temporary phone numbers for agent 2FA/verification.', icon: '🔑' },
  { slug: 'notify', name: 'Notification Router', desc: 'One API call to email a human. Priority routing, no SMTP config.', icon: '🔔' },
];

export default function DocsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-3 text-zinc-400">
        Agent-native API utilities. One API key, REST endpoints, JSON responses.
      </p>

      {/* Quick Start */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm font-mono text-zinc-300 leading-relaxed overflow-x-auto">
          <p className="text-zinc-500"># 1. Create an account & get API key</p>
          <p>curl -X POST https://agentutils.dev/api/user \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">-d {`'{"firebaseUid":"...", "email":"you@example.com"}'`}</p>
          <p className="mt-3 text-zinc-500"># 2. Use any endpoint with your API key</p>
          <p>curl https://agentutils.dev/api/health \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key_here&quot;</p>
          <p className="mt-3 text-zinc-500"># 3. All endpoints return JSON</p>
          <p>{`{"success": true, "data": {...}}`}</p>
        </div>
      </section>

      {/* Authentication */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        <p className="text-sm text-zinc-400 mb-3">
          All API endpoints require an API key sent via the <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">x-api-key</code> header.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300">
          <p>-H &quot;x-api-key: au_550e8400-e29b-41d4-a716-446655440000&quot;</p>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Rate Limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Requests/Day</th>
                <th className="pb-3 pr-4 font-medium">Max File Size</th>
                <th className="pb-3 font-medium">Retention</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Free</td>
                <td className="py-3 pr-4">100</td>
                <td className="py-3 pr-4">5 MB</td>
                <td className="py-3">1 hour</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Pro</td>
                <td className="py-3 pr-4">10,000</td>
                <td className="py-3 pr-4">50 MB</td>
                <td className="py-3">24 hours</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Enterprise</td>
                <td className="py-3 pr-4">Unlimited</td>
                <td className="py-3 pr-4">500 MB</td>
                <td className="py-3">72 hours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Tools</h2>
        <div className="space-y-3">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/docs/${tool.slug}`}
              className="flex items-start gap-3 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
            >
              <span className="text-xl">{tool.icon}</span>
              <div>
                <h3 className="font-semibold text-sm">{tool.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-400">{tool.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
