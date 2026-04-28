import Link from 'next/link';

export const dynamic = 'force-static';

export default function CheckpointDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">👤 Human-in-the-Loop Gate</h1>
      <p className="mt-3 text-zinc-400">
        Pause your agent until a human approves or rejects. Agent sleeps, webhook wakes it up.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Create Checkpoint</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/checkpoint \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">-d {`'{`}</p>
          <p className="ml-8">{`"agentName": "deploy-agent",`}</p>
          <p className="ml-8">{`"taskDescription": "Deploy v2.1 to production",`}</p>
          <p className="ml-8">{`"state": {"branch": "main", "version": "2.1.0"},`}</p>
          <p className="ml-8">{`"webhookUrl": "https://myapp.com/api/resume"`}</p>
          <p className="ml-4">{`}'`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Poll for Approval</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Agent polls until status changes from &quot;pending&quot;</p>
          <p>curl https://agentutils.dev/api/checkpoint/{`{id}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-2 text-zinc-500"># Response (still waiting)</p>
          <p>{`{"success":true,"data":{"status":"pending","state":null}}`}</p>
          <p className="mt-2 text-zinc-500"># Response (approved — state released)</p>
          <p>{`{"success":true,"data":{"status":"approved","state":{"branch":"main",...}}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Resume (Human Action)</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Approve</p>
          <p>curl -X POST https://agentutils.dev/api/checkpoint/{`{id}`}/resume \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"action": "approve"}'`}</p>
          <p className="mt-2 text-zinc-500"># Reject</p>
          <p>curl -X POST https://agentutils.dev/api/checkpoint/{`{id}`}/resume \</p>
          <p className="ml-4">-d {`'{"action": "reject", "reason": "Not ready yet"}'`}</p>
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
                <td className="py-3">Agent identifier</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">taskDescription</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">What the agent wants to do</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">state</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">object</td>
                <td className="py-3">Serialized agent state (returned on approve)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">webhookUrl</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">URL to POST when human acts</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">action</td>
                <td className="py-3 pr-4">POST /resume</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">&quot;approve&quot; or &quot;reject&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
