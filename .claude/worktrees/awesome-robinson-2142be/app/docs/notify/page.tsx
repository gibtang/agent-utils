import Link from 'next/link';

export const dynamic = 'force-static';

export default function NotifyDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🔔 Notification Router</h1>
      <p className="mt-3 text-zinc-400">
        One API call to reach a human. Agents send a message and a priority level — the router delivers it by email. No SMTP config, no credentials to manage.
      </p>

      {/* Send a notification */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Send a notification</h2>
        <p className="text-sm text-zinc-400 mb-3">
          If <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">to</code> is omitted, the email is delivered to your AgentUtils account email automatically.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/notify \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"message":"Wire transfer of $5,000 is pending approval.","priority":"urgent"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"id": "64f1a2b3c4d5e6f7a8b9c0d1",`}</p>
          <p className="ml-4">{`"status": "sent",`}</p>
          <p className="ml-4">{`"to": "you@example.com",`}</p>
          <p className="ml-4">{`"subject": "[AgentUtils] 🚨 New notification",`}</p>
          <p className="ml-4">{`"priority": "urgent",`}</p>
          <p className="ml-4">{`"resendId": "re_abc123"`}</p>
          <p>{`}}`}</p>
        </div>
      </section>

      {/* Parameters */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Request body</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Field</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Required</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">message</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4">Yes</td>
                <td className="py-3">Body of the notification</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">priority</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3"><code className="rounded bg-zinc-800 px-1 text-xs">urgent</code> · <code className="rounded bg-zinc-800 px-1 text-xs">normal</code> · <code className="rounded bg-zinc-800 px-1 text-xs">low</code> — default: <code className="rounded bg-zinc-800 px-1 text-xs">normal</code></td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">to</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Recipient email. Defaults to your account email.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">subject</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Email subject line. Auto-generated from priority if omitted.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">metadata</td>
                <td className="py-3 pr-4">object</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Arbitrary key-value data shown in the email body and stored with the record.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Checkpoint integration */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Use with Checkpoint</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Call <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">/notify</code> right after creating a checkpoint so the human knows to go approve it.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># 1. Create checkpoint</p>
          <p>{`CHECKPOINT=$(curl -sX POST https://agentutils.dev/api/checkpoint \\`}</p>
          <p className="ml-4">{`-H "x-api-key: au_your_key" \\`}</p>
          <p className="ml-4">{`-H "Content-Type: application/json" \\`}</p>
          <p className="ml-4">{`-d '{"agentName":"finance-bot","taskDescription":"Wire $5,000","state":{...},"webhookUrl":"https://your-server.com/resume"}')`}</p>
          <p className="mt-3 text-zinc-500"># 2. Notify the human immediately</p>
          <p>{`ID=$(echo $CHECKPOINT | jq -r '.data.id')`}</p>
          <p>{`curl -sX POST https://agentutils.dev/api/notify \\`}</p>
          <p className="ml-4">{`-H "x-api-key: au_your_key" \\`}</p>
          <p className="ml-4">{`-H "Content-Type: application/json" \\`}</p>
          <p className="ml-4">{`-d "{\"message\":\"Agent wants to wire \\$5,000. Approve here: https://agentutils.dev/dashboard/checkpoints/$ID\",\"priority\":\"urgent\"}"`}</p>
        </div>
      </section>

      {/* List history */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List notification history</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/notify \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-2 text-zinc-500"># Filter by status or priority</p>
          <p>curl &quot;https://agentutils.dev/api/notify?status=failed&priority=urgent&quot; \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
        </div>
      </section>

      {/* Python */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`requests.post(`}</p>
          <p className="ml-4">{`"https://agentutils.dev/api/notify",`}</p>
          <p className="ml-4">{`headers={"x-api-key": "au_your_key"},`}</p>
          <p className="ml-4">{`json={`}</p>
          <p className="ml-8">{`"message": "Task complete: report.pdf is ready.",`}</p>
          <p className="ml-8">{`"priority": "normal",`}</p>
          <p className="ml-8">{`"metadata": {"fileId": "abc123", "rows": 1042}`}</p>
          <p className="ml-4">{`}`}</p>
          <p>{`)`}</p>
        </div>
      </section>

      {/* Env vars */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Environment variables</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Variable</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">RESEND_API_KEY</td>
                <td className="py-3">Your Resend API key (required)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">RESEND_FROM_EMAIL</td>
                <td className="py-3">Sender address — defaults to <code className="rounded bg-zinc-800 px-1 text-xs">notify@agentutils.dev</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
