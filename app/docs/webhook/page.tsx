import Link from 'next/link';

export const dynamic = 'force-static';

export default function WebhookDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">&larr; Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📩 Webhook Inbox</h1>
      <p className="mt-3 text-zinc-400">
        Pre-provisioned public HTTPS endpoints for agents with no public URL. Create an inbox, get a unique URL, and receive webhooks from any external service.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Create a webhook inbox and get a unique public URL. Share that URL with any external service (Stripe, GitHub, Slack, etc.). Incoming requests are stored and can be retrieved via the API. Optionally forward payloads to another URL in real-time.
        </p>
        <p className="text-sm text-zinc-400">
          The public <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">/hook/{'{token}'}</code> endpoints require <strong>no authentication</strong> — anyone with the URL can send webhooks to your inbox.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Create an inbox</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/webhook \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"label":"Stripe payments","forwardUrl":"https://myapp.com/process","ttl":86400}'`}</p>
          <p className="mt-3 text-zinc-500"># Response (201)</p>
          <p>{`{"success":true,"data":{"id":"...","token":"a1b2c3...","url":"https://agentutils.dev/hook/a1b2c3...","label":"Stripe payments","expiresAt":"2025-01-16T12:00:00Z"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List inboxes</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/webhook \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"items":[{"id":"...","token":"a1b2c3...","url":"https://agentutils.dev/hook/a1b2c3...","label":"Stripe payments","messageCount":5,"expiresAt":"..."}],"total":1}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Get inbox messages</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Get inbox details + latest 50 messages</p>
          <p>curl https://agentutils.dev/api/webhook/{`{inbox_id}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"inbox":{...},"messages":[{"id":"...","method":"POST","headers":{...},"body":{...},"query":{},"sourceIp":"1.2.3.4","contentType":"application/json","createdAt":"..."}]}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Delete an inbox</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X DELETE https://agentutils.dev/api/webhook/{`{inbox_id}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"deleted":true}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Send webhooks (no auth)</h2>
        <p className="text-sm text-zinc-400 mb-3">
          External services send requests to the public URL. No API key needed. Supports GET, POST, PUT, PATCH, and DELETE.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Any HTTP method works — no auth header needed</p>
          <p>curl -X POST https://agentutils.dev/hook/{`{token}`} \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"event":"payment.completed","amount":4900}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"received":true}`}</p>
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
                <td className="py-3 pr-4 font-mono text-xs">label</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Human-readable inbox label</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">forwardUrl</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">URL to forward incoming webhooks to (fire-and-forget)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">ttl</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Time-to-live in seconds (default: 86400 / 24h)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">limit</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Max inboxes to return (default: 50, max: 100)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">offset</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Pagination offset (default: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`headers = {"x-api-key": "au_your_key"}`}</p>
          <p className="mt-3 text-zinc-500"># Create an inbox</p>
          <p>{`inbox = requests.post("https://agentutils.dev/api/webhook", headers=headers, json={`}</p>
          <p className="ml-4">{`"label": "GitHub webhooks",`}</p>
          <p className="ml-4">{`"forwardUrl": "https://myapp.com/handler"`}</p>
          <p>{`}).json()["data"]`}</p>
          <p className="mt-2">{`print(f"Webhook URL: {inbox['url']}")`}</p>
          <p className="mt-3 text-zinc-500"># Retrieve messages</p>
          <p>{`messages = requests.get(`}</p>
          <p className="ml-4">{`f"https://agentutils.dev/api/webhook/{inbox['id']}",`}</p>
          <p className="ml-4">{`headers=headers`}</p>
          <p>{`).json()["data"]`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Tier limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Max Inboxes</th>
                <th className="pb-3 font-medium">Default TTL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Free</td>
                <td className="py-3 pr-4">3</td>
                <td className="py-3">24 hours</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Builder</td>
                <td className="py-3 pr-4">10</td>
                <td className="py-3">24 hours</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Pro</td>
                <td className="py-3 pr-4">50</td>
                <td className="py-3">24 hours</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Enterprise</td>
                <td className="py-3 pr-4">Unlimited</td>
                <td className="py-3">24 hours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
