import Link from 'next/link';

export const dynamic = 'force-static';

export default function FileHostDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">📎 Ephemeral File Host</h1>
      <p className="mt-3 text-zinc-400">
        Upload files for agents to share. Auto-expires based on your tier. Get a URL back instantly.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Upload a File</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p className="text-zinc-500"># Upload a file</p>
          <p>curl -X POST https://agentutils.dev/api/file-host \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-F &quot;file=@report.csv&quot;</p>
          <p className="mt-3 text-zinc-500"># Response</p>
          <p>{`{"success":true,"data":{`}</p>
          <p className="ml-4">{`"url":"https://agentutils.dev/api/file-host/abc123-report.csv",`}</p>
          <p className="ml-4">{`"id":"abc123",`}</p>
          <p className="ml-4">{`"expiresAt":"2025-01-15T10:00:00Z"`}</p>
          <p>{`}}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Retrieve a File</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://agentutils.dev/api/file-host/{`{id}`} \</p>
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
                <td className="py-3 pr-4 font-mono text-xs">file</td>
                <td className="py-3 pr-4">POST</td>
                <td className="py-3 pr-4">multipart</td>
                <td className="py-3">File to upload</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">id</td>
                <td className="py-3 pr-4">GET</td>
                <td className="py-3 pr-4">path</td>
                <td className="py-3">File ID from upload response</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Python</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`import requests`}</p>
          <p className="mt-1">{`resp = requests.post(`}</p>
          <p className="ml-4">{`"https://agentutils.dev/api/file-host",`}</p>
          <p className="ml-4">{`headers={"x-api-key": "au_your_key"},`}</p>
          <p className="ml-4">{`files={"file": open("report.csv", "rb")}`}</p>
          <p>{`)`}</p>
          <p className="mt-1">{`print(resp.json()["data"]["url"])`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">JavaScript</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`const form = new FormData();`}</p>
          <p>{`form.append("file", fileBlob);`}</p>
          <p className="mt-1">{`const res = await fetch("/api/file-host", {`}</p>
          <p className="ml-4">{`method: "POST",`}</p>
          <p className="ml-4">{`headers: { "x-api-key": "au_your_key" },`}</p>
          <p className="ml-4">{`body: form`}</p>
          <p>{`});`}</p>
          <p className="mt-1">{`const { data } = await res.json();`}</p>
          <p>{`console.log(data.url);`}</p>
        </div>
      </section>
    </div>
  );
}
