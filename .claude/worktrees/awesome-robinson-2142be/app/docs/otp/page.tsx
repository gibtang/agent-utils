import Link from 'next/link';

export const dynamic = 'force-static';

export default function OtpDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🔑 AgentVerify OTP</h1>
      <p className="mt-3 text-zinc-400">
        Provision temporary phone numbers for agent 2FA/verification. Request a number, use it, poll for the code.
      </p>

      <div className="mt-6 rounded-md bg-yellow-900/20 border border-yellow-700 px-4 py-3 text-sm text-yellow-300">
        <strong>Platform Compatibility:</strong> Virtual numbers are blocked by WhatsApp, Google, Meta, and major crypto exchanges. This tool works for niche platforms, internal systems, and third-party APIs that do not maintain VoIP blocklists.
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-2">
          <li><strong className="text-zinc-200">Request</strong> — Get a temporary phone number</li>
          <li>Use the number in your target service&apos;s signup/verification form</li>
          <li><strong className="text-zinc-200">Poll</strong> — Check until the SMS/OTP code arrives</li>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Request a Number</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/otp \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"countryCode": "US"}'`}</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"sessionId": "abc123",`}</p>
          <p className="ml-4">{`"phoneNumber": "+15551234567",`}</p>
          <p className="ml-4">{`"status": "waiting",`}</p>
          <p className="ml-4">{`"expiresAt": "2025-01-15T11:00:00Z",`}</p>
          <p className="ml-4">{`"instructions": "Poll GET /api/otp/{sessionId}"`}</p>
          <p>{`}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Poll for Code</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Poll until status = &quot;received&quot;</p>
          <p>curl https://agentutils.dev/api/otp/{`{sessionId}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response (code received)</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"status": "received",`}</p>
          <p className="ml-4">{`"code": "482916",`}</p>
          <p className="ml-4">{`"senderNumber": "+15559876543"`}</p>
          <p>{`}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Cancel Session</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X DELETE https://agentutils.dev/api/otp/{`{sessionId}`} \</p>
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
                <td className="py-3 pr-4 font-mono text-xs">countryCode</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Country code (currently US only)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">sessionId</td>
                <td className="py-3 pr-4">GET/DELETE</td>
                <td className="py-3 pr-4">path</td>
                <td className="py-3">Session ID from create response</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Limits</h2>
        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
          <li>Max 5 concurrent sessions per user</li>
          <li>10-minute expiry per session</li>
          <li>US numbers only in current version</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests, time`}</p>
          <p className="mt-1">{`headers = {"x-api-key": "au_your_key"}`}</p>
          <p className="mt-1">{`# Request number`}</p>
          <p>{`resp = requests.post("https://agentutils.dev/api/otp",`}</p>
          <p className="ml-4">{`headers=headers, json={"countryCode": "US"})`}</p>
          <p>{`session_id = resp.json()["data"]["sessionId"]`}</p>
          <p className="mt-1">{`# Poll for code`}</p>
          <p>{`while True:`}</p>
          <p className="ml-4">{`r = requests.get(f"https://agentutils.dev/api/otp/{session_id}",`}</p>
          <p className="ml-8">{`headers=headers)`}</p>
          <p className="ml-4">{`data = r.json()["data"]`}</p>
          <p className="ml-4">{`if data["status"] == "received":`}</p>
          <p className="ml-8">{`print(f"OTP: {data['code']}")`}</p>
          <p className="ml-8">{`break`}</p>
          <p className="ml-4">{`time.sleep(3)`}</p>
        </div>
      </section>

      <div className="mt-8 rounded-md bg-blue-900/20 border border-blue-800 px-4 py-3 text-sm text-blue-300">
        <strong>Pro+ feature.</strong> Free tier users need to upgrade to use OTP verification.
      </div>
    </div>
  );
}
