import Link from 'next/link';

export const dynamic = 'force-static';

export default function AuditDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📋 Audit Log</h1>
      <p className="mt-3 text-zinc-400">
        Immutable agent action history for user-facing accountability.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <p className="text-sm text-zinc-400">
          Your agents log actions via a simple POST request. End users can then view a complete,
          tamper-proof history of everything the agent did. No edits, no deletes — once written,
          audit entries are immutable. This provides user-facing accountability without any extra
          infrastructure on your end.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Log an action</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/audit \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"agentName":"billing-agent","action":"refund_issued"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"id":"64f1a2b3c4d5e6f7a8b9c0d1"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List logs with filters</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># List all (paginated)</p>
          <p>curl https://agentutils.dev/api/audit \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-2 text-zinc-500"># Filter by agent, action, severity, date range</p>
          <p>{`curl "https://agentutils.dev/api/audit?agent=billing-agent&severity=warn&limit=20"`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Get a single entry</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/audit/{'${id}'} \</p>
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
                <td className="py-3 pr-4 font-mono text-xs">action</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Required. Description of the action taken</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">agentName</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Name of the agent. Default: <code className="rounded bg-zinc-800 px-1 text-xs">unknown</code></td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">target</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">What the action was performed on (e.g. resource ID)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">metadata</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">object</td>
                <td className="py-3">Arbitrary key-value data attached to the entry</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">severity</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3"><code className="rounded bg-zinc-800 px-1 text-xs">info</code> · <code className="rounded bg-zinc-800 px-1 text-xs">warn</code> · <code className="rounded bg-zinc-800 px-1 text-xs">error</code> · <code className="rounded bg-zinc-800 px-1 text-xs">critical</code> — default: <code className="rounded bg-zinc-800 px-1 text-xs">info</code></td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">agent</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Filter by agentName</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">action</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Filter by action</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">severity</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Filter by severity level</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">startDate / endDate</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">ISO date strings to filter by createdAt range</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">limit / offset</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Pagination (default: limit=50, offset=0, max limit=100)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`requests.post(`}</p>
          <p className="ml-4">{`"https://agentutils.dev/api/audit",`}</p>
          <p className="ml-4">{`headers={"x-api-key": "au_your_key"},`}</p>
          <p className="ml-4">{`json={`}</p>
          <p className="ml-8">{`"agentName": "billing-agent",`}</p>
          <p className="ml-8">{`"action": "refund_issued",`}</p>
          <p className="ml-8">{`"target": "invoice_7842",`}</p>
          <p className="ml-8">{`"metadata": {"amount": 49.99},`}</p>
          <p className="ml-8">{`"severity": "info"`}</p>
          <p className="ml-4">{`}`}</p>
          <p>{`)`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Immutability guarantee</h2>
        <p className="text-sm text-zinc-400">
          Audit log entries cannot be modified or deleted via the API. There are no PUT, PATCH, or
          DELETE endpoints. This ensures a trustworthy trail of agent actions for compliance and
          debugging. Retention varies by tier: 30 days (Free), 90 days (Builder), 365 days (Pro),
          unlimited (Enterprise).
        </p>
      </section>
    </div>
  );
}
