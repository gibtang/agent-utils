import Link from 'next/link';

export const dynamic = 'force-static';

export default function KvDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🗄️ Key-Value Store</h1>
      <p className="mt-3 text-zinc-400">
        Simple state persistence for stateless agents. Store key-value pairs scoped to your API key, with atomic increment for counters.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Each API key gets its own isolated key-value namespace. Set a value with PUT, retrieve it with GET, and use atomic increment for counters. Entries auto-expire based on TTL (default 24 hours).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Set a value</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X PUT https://www.agent-utils.com/api/kv \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"key":"session:abc123","value":{"step":3,"status":"running"},"ttl":3600}'`}</p>
          <p className="mt-3 text-zinc-500"># Response (201 created or 200 updated)</p>
          <p>{`{"success":true,"data":{"key":"session:abc123","expiresAt":"2025-01-15T12:00:00Z"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Get a value</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://www.agent-utils.com/api/kv/session:abc123 \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"key":"session:abc123","value":{"step":3,"status":"running"},"expiresAt":"2025-01-15T12:00:00Z"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List keys</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># List all keys (values omitted)</p>
          <p>curl https://www.agent-utils.com/api/kv \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-2 text-zinc-500"># With pagination</p>
          <p>{`curl "https://www.agent-utils.com/api/kv?limit=10&offset=20" \\`}</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"items":[{"key":"session:abc123","expiresAt":"..."}],"total":1,"limit":50,"offset":0}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Delete a key</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X DELETE https://www.agent-utils.com/api/kv/session:abc123 \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"deleted":true}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Atomic increment</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Use atomic increment for counters, rate limiting, or tracking progress. If the key does not exist, it is created with the amount as the initial value.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Increment by 1 (default)</p>
          <p>curl -X POST https://www.agent-utils.com/api/kv/counter:emails/increment \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot;</p>
          <p className="mt-2 text-zinc-500"># Increment by a custom amount</p>
          <p>curl -X POST https://www.agent-utils.com/api/kv/counter:emails/increment \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"amount": 5}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"key":"counter:emails","value":6}}`}</p>
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
                <td className="py-3 pr-4 font-mono text-xs">key</td>
                <td className="py-3 pr-4">PUT</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Key name (max 256 chars)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">value</td>
                <td className="py-3 pr-4">PUT</td>
                <td className="py-3 pr-4">any</td>
                <td className="py-3">Value to store (JSON-serializable)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">ttl</td>
                <td className="py-3 pr-4">PUT</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Time-to-live in seconds (default: 86400)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">amount</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Increment amount (default: 1)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">limit</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Max keys to return (default: 50, max: 100)</td>
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
          <p className="mt-3 text-zinc-500"># Set a value</p>
          <p>{`requests.put("https://www.agent-utils.com/api/kv", headers=headers, json={`}</p>
          <p className="ml-4">{`"key": "agent:state",`}</p>
          <p className="ml-4">{`"value": {"step": 1, "data": "hello"},`}</p>
          <p className="ml-4">{`"ttl": 3600`}</p>
          <p>{`})`}</p>
          <p className="mt-3 text-zinc-500"># Get a value</p>
          <p>{`requests.get("https://www.agent-utils.com/api/kv/agent:state", headers=headers)`}</p>
          <p className="mt-3 text-zinc-500"># Atomic increment</p>
          <p>{`requests.post("https://www.agent-utils.com/api/kv/counter/increment",`}</p>
          <p className="ml-4">{`headers=headers, json={"amount": 1})`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Tier limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Max Keys</th>
                <th className="pb-3 font-medium">Max Value Size</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Free</td>
                <td className="py-3 pr-4">10</td>
                <td className="py-3">10 KB</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Builder</td>
                <td className="py-3 pr-4">100</td>
                <td className="py-3">10 KB</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Pro</td>
                <td className="py-3 pr-4">1,000</td>
                <td className="py-3">10 KB</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Enterprise</td>
                <td className="py-3 pr-4">Unlimited</td>
                <td className="py-3">10 KB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
