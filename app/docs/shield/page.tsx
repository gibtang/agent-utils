import Link from 'next/link';

export const dynamic = 'force-static';

export default function ShieldDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🛡️ Agent Shield (PII)</h1>
      <p className="mt-3 text-zinc-400">
        Redact PII before sending to LLMs, then hydrate original values back. Pro+ feature.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-2">
          <li><strong className="text-zinc-200">Clean</strong> — Send text, get back redacted text + sessionId</li>
          <li>Send redacted text to your LLM</li>
          <li><strong className="text-zinc-200">Hydrate</strong> — Send LLM response + sessionId, get original values restored</li>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Clean (Redact)</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://www.agent-utils.com/api/shield/clean \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"text": "Call John at 555-1234 or john@example.com"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"cleaned": "Call [NAME_1] at [PHONE_1] or [EMAIL_1]",`}</p>
          <p className="ml-4">{`"sessionId": "abc123",`}</p>
          <p className="ml-4">{`"detected": ["email", "phone"]`}</p>
          <p>{`}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Hydrate (Restore)</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://www.agent-utils.com/api/shield/hydrate \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"text": "I emailed [EMAIL_1] for [NAME_1]", "sessionId": "abc123"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"hydrated": "I emailed john@example.com for John"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Detected PII Types</h2>
        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
          <li>Email addresses → <code className="rounded bg-zinc-800 px-1 text-xs">[EMAIL_N]</code></li>
          <li>Phone numbers → <code className="rounded bg-zinc-800 px-1 text-xs">[PHONE_N]</code></li>
          <li>SSN → <code className="rounded bg-zinc-800 px-1 text-xs">[SSN_N]</code></li>
          <li>Credit card numbers → <code className="rounded bg-zinc-800 px-1 text-xs">[CC_N]</code></li>
          <li>IP addresses → <code className="rounded bg-zinc-800 px-1 text-xs">[IP_N]</code></li>
          <li>Dates → <code className="rounded bg-zinc-800 px-1 text-xs">[DATE_N]</code></li>
        </ul>
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
                <td className="py-3 pr-4 font-mono text-xs">text</td>
                <td className="py-3 pr-4">clean, hydrate</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Input text</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">sessionId</td>
                <td className="py-3 pr-4">hydrate</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Session ID from clean response</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 rounded-md bg-blue-900/20 border border-blue-800 px-4 py-3 text-sm text-blue-300">
        <strong>Pro+ feature.</strong> Free tier users need to upgrade to use PII redaction.
      </div>
    </div>
  );
}
