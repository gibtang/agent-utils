import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Dead Letter Queue API Docs — AgentUtils',
  description: 'Capture failed agent tasks, inspect error payloads, and retry via webhook. Complete API reference for the AgentUtils Dead Letter Queue.',
  openGraph: { url: '/docs/dlq' },
  alternates: {
    canonical: '/docs/dlq',
  },
};

export default function DlqDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📬 Dead Letter Queue</h1>
      <p className="mt-3 text-zinc-400">
        Capture failed agent tasks, inspect error payloads, and retry via webhook.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Capture a Failure</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://www.agent-utils.com/api/dlq \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">-d {`'{`}</p>
          <p className="ml-8">{`"agentName": "email-agent",`}</p>
          <p className="ml-8">{`"taskType": "send_email",`}</p>
          <p className="ml-8">{`"payload": {"to": "user@example.com", "subject": "Welcome"},`}</p>
          <p className="ml-8">{`"error": "SMTP timeout after 30s",`}</p>
          <p className="ml-8">{`"retryWebhook": "https://myapp.com/api/retry"`}</p>
          <p className="ml-4">{`}'`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List Failures</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># List all (paginated)</p>
          <p>curl https://www.agent-utils.com/api/dlq \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-2 text-zinc-500"># Filter by status</p>
          <p>curl &quot;https://www.agent-utils.com/api/dlq?status=pending&quot; \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Retry</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Forward original payload to retry webhook</p>
          <p>curl -X POST https://www.agent-utils.com/api/dlq/{`{id}`}/retry \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Param</th>
                <th className="pb-3 pr-4 font-medium">Method</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">agentName</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Name of the agent that failed</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">taskType</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Type of task that failed</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">payload</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">object</td>
                <td className="py-3">Original task input data</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">error</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Error message</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">retryWebhook</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">URL to POST payload on retry</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">status</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Filter: pending, retried, resolved, dismissed</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">page / limit</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Pagination (default: page=1, limit=20)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
