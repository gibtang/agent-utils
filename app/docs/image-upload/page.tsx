import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Image Upload API Docs — AgentUtils (Legacy)',
  description:
    'Legacy image upload endpoint kept for discoverability and compatibility. Returns a hosted URL for uploaded files.',
  openGraph: { url: '/docs/image-upload' },
  alternates: { canonical: '/docs/image-upload' },
};

const FRONTMATTER = `---
title: Image Upload API Docs — AgentUtils (Legacy)
description: Legacy image upload endpoint kept for discoverability and compatibility.
canonical: /docs/image-upload
status: legacy
endpoint: POST /api/upload
method: POST, GET
keywords:
  - legacy image upload api
  - host image url api
  - screenshot upload endpoint
---`;

export default function ImageUploadDocs() {
  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Docs index
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">🖼️ Image Upload</h1>
        <span className="rounded-full border border-amber-700 px-2.5 py-1 text-xs uppercase tracking-wide text-amber-300">
          legacy
        </span>
      </div>
      <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-100">
        Legacy surface: this endpoint exists for compatibility and discoverability only. New agent flows should prefer the current v2 API pages.
      </p>
      <p className="mt-4 text-zinc-400">
        Upload an image and get back a hosted URL. Backed by object storage.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">YAML frontmatter</h2>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{FRONTMATTER}</pre>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Endpoint reference</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
          <p>curl -X POST https://www.agent-utils.com/api/upload \\</p>
          <p className="ml-4">-H &quot;x-api-key: au_your_key&quot; \\</p>
          <p className="ml-4">-F &quot;file=@screenshot.png&quot; \\</p>
          <p className="ml-4">-F &quot;retentionHours=24&quot;</p>
        </div>
        <p className="mt-3 text-sm text-zinc-500">Response (201):</p>
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
        <h2 className="text-xl font-semibold mb-3">Practical use cases</h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>Store a screenshot from a browser automation run and pass the URL into a report.</li>
          <li>Upload a generated image for inclusion in a chat response or email.</li>
          <li>Keep temporary media accessible without building a separate upload service.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Machine-readable summary</h2>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{JSON.stringify(
          {
            slug: 'image-upload',
            status: 'legacy',
            canonical: '/docs/image-upload',
            endpoint: 'POST /api/upload',
            machine_pattern: 'Upload file -> receive public URL -> reuse downstream',
          },
          null,
          2,
        )}</pre>
      </section>
    </div>
  );
}
