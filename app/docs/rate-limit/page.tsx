import Link from 'next/link';

export const dynamic = 'force-static';

export default function RateLimitDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">&larr; Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">&#9889; Rate Limiter</h1>
      <p className="mt-3 text-zinc-400">
        Outbound API rate limiting for agents. Check if an action is allowed before making it.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <p className="text-sm text-zinc-400 mb-3">
          The Rate Limiter uses a sliding window counter pattern with atomic check-and-increment.
          Each call to the check endpoint atomically increments a counter and compares it against
          your limit. If the counter exceeds the limit within the window, the request is blocked
          with a 429 response and a <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">retryAfter</code> value
          telling you how many seconds until the window resets.
        </p>
        <p className="text-sm text-zinc-400">
          Counters are stored in the KV Store with an internal <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">__rl:</code> prefix,
          so they share your KV key quota and auto-expire with the window.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Check a rate limit</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/rate-limit/check \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"key":"openai:calls","limit":100,"windowSeconds":3600}'`}</p>
          <p className="mt-3 text-zinc-500"># Response (200 allowed)</p>
          <p>{`{"success":true,"data":{"allowed":true,"count":1,"remaining":99,"resetAt":"2025-01-15T13:00:00Z"}}`}</p>
          <p className="mt-2 text-zinc-500"># Response (429 blocked)</p>
          <p>{`{"success":true,"data":{"allowed":false,"count":101,"remaining":0,"resetAt":"2025-01-15T13:00:00Z","retryAfter":2341}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Reset a rate limit</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/rate-limit/reset \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"key":"openai:calls"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"key":"openai:calls","reset":true}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Get rate limit status</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/rate-limit/openai:calls \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"key":"openai:calls","count":42,"remaining":58,"resetAt":"2025-01-15T13:00:00Z","windowExpired":false}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Param</th>
                <th className="pb-3 pr-4 font-medium">Endpoint</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">key</td>
                <td className="py-3 pr-4">check, reset</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Identifier for the rate limit counter</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">limit</td>
                <td className="py-3 pr-4">check</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Max requests allowed in the window (min 1)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">windowSeconds</td>
                <td className="py-3 pr-4">check</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Sliding window duration in seconds (min 1)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">key</td>
                <td className="py-3 pr-4">status (URL)</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">URL-encoded key name (e.g. openai%3Acalls)</td>
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
          <p className="mt-3 text-zinc-500"># Check rate limit before calling external API</p>
          <p>{`resp = requests.post("https://agentutils.dev/api/rate-limit/check",`}</p>
          <p className="ml-4">{`headers=headers, json={`}</p>
          <p className="ml-4">{`"key": "openai:calls",`}</p>
          <p className="ml-4">{`"limit": 100,`}</p>
          <p className="ml-4">{`"windowSeconds": 3600`}</p>
          <p>{`})`}</p>
          <p className="mt-2">{`data = resp.json()["data"]`}</p>
          <p>{`if data["allowed"]:`}</p>
          <p className="ml-4">{`# Safe to make the external API call`}</p>
          <p className="ml-4">{`call_openai()`}</p>
          <p>{`else:`}</p>
          <p className="ml-4">{`print(f"Rate limited. Retry after {data['retryAfter']}s")`}</p>
          <p className="mt-3 text-zinc-500"># Reset counter</p>
          <p>{`requests.post("https://agentutils.dev/api/rate-limit/reset",`}</p>
          <p className="ml-4">{`headers=headers, json={"key": "openai:calls"})`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Dependency</h2>
        <p className="text-sm text-zinc-400">
          The Rate Limiter stores counters in the <Link href="/docs/kv" className="text-zinc-300 underline hover:text-white">KV Store</Link> with
          an internal <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">__rl:</code> prefix. Rate limit counters count toward
          your KV key quota and auto-expire when the window elapses.
        </p>
      </section>
    </div>
  );
}
