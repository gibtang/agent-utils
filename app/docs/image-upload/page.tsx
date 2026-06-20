import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Image Upload API Docs — AgentUtils',
  description: 'Upload images and receive a hosted URL in a single API call. Complete API reference for the AgentUtils Image Upload tool.',
  openGraph: { url: '/docs/image-upload' },
  alternates: {
    canonical: '/docs/image-upload',
  },
};

export default function ImageUploadDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">← Docs</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">🖼️ Image Upload</h1>
      <p className="mt-3 text-zinc-400">
        Upload an image and get back a hosted URL. Backed by Backblaze B2 object storage.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Upload an Image</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://www.agent-utils.com/api/upload \</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \</p>
          <p className="ml-4">-F &quot;file=@screenshot.png&quot; \</p>
          <p className="ml-4">-F &quot;retentionHours=24&quot;</p>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Response (201):
        </p>
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>{`{`}</p>
          <p className="ml-4">{`"success": true,`}</p>
          <p className="ml-4">{`"data": {`}</p>
          <p className="ml-8">{`"id": "9f3c1b2a-...",`}</p>
          <p className="ml-8">{`"url": "https://www.agent-utils.com/api/file-host/9f3c1b2a-...",`}</p>
          <p className="ml-8">{`"filename": "screenshot.png",`}</p>
          <p className="ml-8">{`"contentType": "image/png",`}</p>
          <p className="ml-8">{`"size": 184320,`}</p>
          <p className="ml-8">{`"expiresAt": "2026-06-20T12:00:00.000Z"`}</p>
          <p className="ml-4">{`}`}</p>
          <p>{`}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Field</th>
                <th className="pb-3 pr-4 font-medium">In</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">file</td>
                <td className="py-3 pr-4">form</td>
                <td className="py-3 pr-4">binary</td>
                <td className="py-3">Required. The image file (jpeg, png, webp, or gif). Max 10&nbsp;MB.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 font-mono text-xs">retentionHours</td>
                <td className="py-3 pr-4">form</td>
                <td className="py-3 pr-4">number</td>
                <td className="py-3">Optional. Hours until the file expires (default 24). Must be positive.</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-xs">x-api-key</td>
                <td className="py-3 pr-4">header</td>
                <td className="py-3 pr-4">string</td>
                <td className="py-3">Required. Your AgentUtils API key.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Accessing a File</h2>
        <p className="text-sm text-zinc-400 mb-3">
          The returned <code className="text-zinc-300">url</code> is publicly accessible — no API key required.
          It serves the image with the original content type and is cacheable. Files
          past their <code className="text-zinc-300">expiresAt</code> return a 404.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl https://www.agent-utils.com/api/file-host/{`{id}`}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Errors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Cause</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800/50"><td className="py-3 pr-4 font-mono text-xs">400</td><td className="py-3">Missing <code>file</code> field or invalid <code>retentionHours</code>.</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-3 pr-4 font-mono text-xs">401</td><td className="py-3">Missing or invalid API key.</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-3 pr-4 font-mono text-xs">413</td><td className="py-3">File exceeds 10&nbsp;MB.</td></tr>
              <tr className="border-b border-zinc-800/50"><td className="py-3 pr-4 font-mono text-xs">415</td><td className="py-3">Unsupported content type.</td></tr>
              <tr><td className="py-3 pr-4 font-mono text-xs">500</td><td className="py-3">Storage backend error.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
