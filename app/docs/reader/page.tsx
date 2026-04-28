import Link from 'next/link';

export const dynamic = 'force-static';

export default function ReaderDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📖 AgentMarkdown Reader</h1>
      <p className="mt-3 text-zinc-400">
        Fetch any URL and get clean, LLM-optimized markdown. Uses Mozilla Readability + Turndown.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Read a URL</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl &quot;https://agentutils.dev/api/reader?url=https://example.com&quot; \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"title": "Example Domain",`}</p>
          <p className="ml-4">{`"markdown": "# Example Domain\\n\\nThis domain is for use...",`}</p>
          <p className="ml-4">{`"wordCount": 42,`}</p>
          <p className="ml-4">{`"url": "https://example.com"`}</p>
          <p>{`}}`}</p>
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
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">url</td>
                <td className="py-3 pr-4">query</td>
                <td className="py-3 pr-4">Yes</td>
                <td className="py-3">URL to fetch and convert to markdown</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`resp = requests.get(`}</p>
          <p className="ml-4">{`"https://agentutils.dev/api/reader",`}</p>
          <p className="ml-4">{`params={"url": "https://example.com"},`}</p>
          <p className="ml-4">{`headers={"x-api-key": "au_your_key"}`}</p>
          <p>{`)`}</p>
          <p className="mt-1">{`md = resp.json()["data"]["markdown"]`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">JavaScript</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`const res = await fetch(`}</p>
          <p className="ml-4">{`"/api/reader?url=" + encodeURIComponent(url),`}</p>
          <p className="ml-4">{`{ headers: { "x-api-key": "au_your_key" } }`}</p>
          <p>{`);`}</p>
          <p className="mt-1">{`const { data } = await res.json();`}</p>
          <p>{`console.log(data.markdown);`}</p>
        </div>
      </section>
    </div>
  );
}
