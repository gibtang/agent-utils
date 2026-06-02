import Link from 'next/link';

export const dynamic = 'force-static';

export default function FormDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">&larr; Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📝 Agent Form</h1>
      <p className="mt-3 text-zinc-400">
        Hosted forms for human-in-the-loop data collection. Your agent creates a form via API, humans fill it out at a public URL, and submissions are delivered to your webhook.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">How it works</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Create a form with custom fields via the API. You get a unique public URL (<code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">/f/{'{token}'}</code>) that you can share with humans. When someone submits the form, the data is stored and forwarded to your webhook URL.
        </p>
        <p className="text-sm text-zinc-400">
          The public form page requires <strong>no authentication</strong> — anyone with the URL can submit responses.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Create a form</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://agentutils.dev/api/form \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"title":"Customer Feedback","fields":[{"name":"name","label":"Your Name","type":"text","required":true},{"name":"email","label":"Email","type":"email","required":true},{"name":"rating","label":"Rating","type":"select","options":["Excellent","Good","Fair","Poor"]},{"name":"comments","label":"Comments","type":"textarea","placeholder":"Tell us more..."}],"webhookUrl":"https://myapp.com/webhook","ttl":604800}'`}</p>
          <p className="mt-3 text-zinc-500"># Response (201)</p>
          <p>{`{"success":true,"data":{"id":"...","token":"a1b2c3...","url":"https://agentutils.dev/f/a1b2c3...","title":"Customer Feedback","status":"active"}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">List forms</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/form \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"items":[{"id":"...","title":"Customer Feedback","status":"active","responseCount":5,"url":"https://agentutils.dev/f/a1b2c3...","expiresAt":"..."}],"total":1}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Get form + responses</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Get form details + latest 100 responses</p>
          <p>curl https://agentutils.dev/api/form/{`{form_id}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"form":{...},"responses":[{"id":"...","data":{"name":"Alice","email":"alice@example.com","rating":"Excellent","comments":"Great service!"},"sourceIp":"1.2.3.4","createdAt":"..."}]}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Delete a form</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X DELETE https://agentutils.dev/api/form/{`{form_id}`} \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{"deleted":true}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Public form page (no auth)</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Share the public URL with humans. The form is rendered as a styled page with your custom fields. No API key or login required.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Open in any browser — no auth needed</p>
          <p>https://agentutils.dev/f/{`{token}`}</p>
          <p className="mt-3 text-zinc-500"># Submit programmatically</p>
          <p>curl -X POST https://agentutils.dev/api/form-submit/{`{token}`} \</p>
          <p className="ml-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="ml-4">{`-d '{"name":"Alice","email":"alice@example.com","rating":"Excellent","comments":"Great!"}'`}</p>
          <p className="mt-3 text-zinc-500"># Returns HTML thank-you page</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Field types</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">text</td>
                <td className="py-3">Single-line text input</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">email</td>
                <td className="py-3">Email input with validation</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">number</td>
                <td className="py-3">Numeric input</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">textarea</td>
                <td className="py-3">Multi-line text input</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">select</td>
                <td className="py-3">Dropdown with options array</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">checkbox</td>
                <td className="py-3">Boolean checkbox</td>
              </tr>
            </tbody>
          </table>
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
                <td className="py-3 pr-4 font-mono text-xs">title</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Form title shown to humans (required)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">fields</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">array</td>
                <td className="py-3">Array of field objects (required, non-empty)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">webhookUrl</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">URL to receive submission payloads (required)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">ttl</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Time-to-live in seconds (default: 604800 / 7 days)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">limit</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3">Max forms to return (default: 50, max: 100)</td>
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
          <p className="mt-3 text-zinc-500"># Create a form</p>
          <p>{`form = requests.post("https://agentutils.dev/api/form", headers=headers, json={`}</p>
          <p className="ml-4">{`"title": "Customer Feedback",`}</p>
          <p className="ml-4">{`"fields": [`}</p>
          <p className="ml-8">{`{"name": "name", "label": "Your Name", "type": "text", "required": True},`}</p>
          <p className="ml-8">{`{"name": "comments", "label": "Comments", "type": "textarea"}`}</p>
          <p className="ml-4">{`],`}</p>
          <p className="ml-4">{`"webhookUrl": "https://myapp.com/webhook"`}</p>
          <p>{`}).json()["data"]`}</p>
          <p className="mt-2">{`print(f"Form URL: {form['url']}")`}</p>
          <p className="mt-3 text-zinc-500"># Retrieve responses</p>
          <p>{`result = requests.get(`}</p>
          <p className="ml-4">{`f"https://agentutils.dev/api/form/{form['id']}",`}</p>
          <p className="ml-4">{`headers=headers`}</p>
          <p>{`).json()["data"]`}</p>
          <p className="mt-2">{`for resp in result["responses"]:`}</p>
          <p className="ml-4">{`print(resp["data"])`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Tier limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Tier</th>
                <th className="pb-3 pr-4 font-medium">Max Forms</th>
                <th className="pb-3 font-medium">Default TTL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Free</td>
                <td className="py-3 pr-4">5</td>
                <td className="py-3">7 days</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Builder</td>
                <td className="py-3 pr-4">25</td>
                <td className="py-3">7 days</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4">Pro</td>
                <td className="py-3 pr-4">100</td>
                <td className="py-3">7 days</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Enterprise</td>
                <td className="py-3 pr-4">Unlimited</td>
                <td className="py-3">7 days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
