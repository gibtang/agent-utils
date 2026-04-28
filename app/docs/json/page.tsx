import Link from 'next/link';

export const dynamic = 'force-static';

export default function JsonDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🧹 JSON Cleaner</h1>
      <p className="mt-3 text-zinc-400">
        Normalize messy LLM output into valid JSON. Strips markdown fences, validates against schemas, deep-sorts keys.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Clean JSON</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Basic cleaning</p>
          <p>curl -X POST https://agentutils.dev/api/json \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">-d {`'{"json": "~~~json~~~{\\"key\\": \\"value\\"}~~~"}'`}</p>
          <p className="mt-3 text-zinc-500"># With schema validation</p>
          <p>curl -X POST https://agentutils.dev/api/json \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"json": "...", "schema": {"type": "object", "required": ["name"]}}'`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Param</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Required</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">json</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3 pr-4">Yes</td>
                <td className="py-3">Raw JSON string (may include markdown fences)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">schema</td>
                <td className="py-3 pr-4">object</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">JSON Schema for validation (AJV)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">sortKeys</td>
                <td className="py-3 pr-4">boolean</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Deep-sort object keys alphabetically (default: true)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">What gets cleaned</h2>
        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
          <li>Strips <code className="rounded bg-zinc-800 px-1 text-xs">```json ... ```</code> markdown fences</li>
          <li>Parses stringified JSON within strings</li>
          <li>Validates against optional JSON Schema</li>
          <li>Deep-sorts keys for consistent output</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`resp = requests.post(`}</p>
          <p className="ml-4">{`"https://agentutils.dev/api/json",`}</p>
          <p className="ml-4">{`headers={"x-api-key": "au_your_key"},`}</p>
          <p className="ml-4">{`json={"json": messy_llm_output}`}</p>
          <p>{`)`}</p>
          <p className="mt-1">{`clean = resp.json()["data"]["cleaned"]`}</p>
        </div>
      </section>
    </div>
  );
}
