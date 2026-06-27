import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentAgentUtilsDocs } from '@/lib/agentutils-docs';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'AgentUtils Docs Index',
  description: 'Static, machine-readable documentation index for AgentUtils tools.',
  alternates: { canonical: '/docs' },
  openGraph: { url: '/docs' },
};

function Card({ title, text, href, badge }: { title: string; text: string; href: string; badge: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-wide text-zinc-400">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </Link>
  );
}

export default function DocsIndexPage() {
  const currentDocs = getCurrentAgentUtilsDocs();
  const frontmatter = `---
title: AgentUtils Docs Index
description: Static, machine-readable documentation index for AgentUtils tools.
canonical: /docs
kind: docs-index
---`;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">AgentUtils docs index</h1>
      <p className="mt-3 max-w-3xl text-zinc-400">
        Static documentation for each current tool, plus a separate legacy page for the old upload surface. The index is written for both humans and crawlers.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight">YAML frontmatter</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The index page exposes canonical metadata as frontmatter-shaped text for parsers.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{frontmatter}</pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Current tools</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {currentDocs.map((doc) => (
            <Card key={doc.slug} title={doc.title} text={doc.summary} href={doc.frontmatter.canonical} badge={doc.status} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Legacy surface</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card
            title="Image Upload"
            text="Legacy /api/upload and /api/file-host reference kept for discoverability and compatibility."
            href="/docs/image-upload"
            badge="legacy"
          />
          <Card
            title="Aggregate v2 reference"
            text="Consolidated /docs/v2 overview with authentication, callbacks, and conventions."
            href="/docs/v2"
            badge="overview"
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Machine-readable summary</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">
          {JSON.stringify(
            {
              canonical: '/docs',
              current_pages: currentDocs.map((doc) => doc.machineSummary),
              legacy_pages: [
                {
                  slug: 'image-upload',
                  status: 'legacy',
                  canonical: '/docs/image-upload',
                  endpoint: 'POST /api/upload',
                },
              ],
            },
            null,
            2,
          )}
        </pre>
      </section>
    </div>
  );
}
