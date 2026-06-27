import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  agentUtilsDocOrder,
  getAgentUtilsDoc,
  toYamlFrontmatter,
  type AgentUtilsDocSlug,
} from '@/lib/agentutils-docs';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { slug: AgentUtilsDocSlug }[] {
  return agentUtilsDocOrder.filter((slug) => slug !== 'image-upload').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> | { slug: string } }): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const doc = getAgentUtilsDoc(resolvedParams.slug);

  if (!doc) {
    return {};
  }

  return {
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    alternates: {
      canonical: doc.frontmatter.canonical,
    },
    openGraph: {
      url: doc.frontmatter.canonical,
    },
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm font-mono text-zinc-300 whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function SummaryBlock({ doc }: { doc: NonNullable<ReturnType<typeof getAgentUtilsDoc>> }) {
  return (
    <>
      <SectionTitle>Machine-readable summary</SectionTitle>
      <p className="mt-2 text-sm text-zinc-400">
        This block is intentionally stable so crawlers and agent parsers can extract the page meaning without reading the full prose.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{JSON.stringify(doc.machineSummary, null, 2)}</pre>
    </>
  );
}

export default async function AgentUtilsDocPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const doc = getAgentUtilsDoc(resolvedParams.slug);

  if (!doc || doc.slug === 'image-upload') {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Docs index
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs uppercase tracking-wide text-zinc-400">
          {doc.status}
        </span>
      </div>

      <p className="mt-3 text-zinc-400">{doc.summary}</p>

      <SectionTitle>YAML frontmatter</SectionTitle>
      <p className="mt-2 text-sm text-zinc-400">
        The page exposes a readable frontmatter block so machines can ingest canonical metadata consistently.
      </p>
      <CodeBlock>{toYamlFrontmatter(doc)}</CodeBlock>

      <SectionTitle>What it is</SectionTitle>
      <p className="mt-3 text-zinc-300 leading-7">{doc.whatItIs}</p>

      <SectionTitle>Why agents use it</SectionTitle>
      <p className="mt-3 text-zinc-300 leading-7">{doc.agentUse}</p>

      <SectionTitle>Endpoint mapping</SectionTitle>
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
        <div className="flex flex-wrap gap-3">
          <span><strong className="text-zinc-100">Method:</strong> {doc.method}</span>
          <span><strong className="text-zinc-100">Endpoint:</strong> {doc.endpoint}</span>
        </div>
      </div>

      <SectionTitle>Request example</SectionTitle>
      <CodeBlock>{doc.requestExample}</CodeBlock>

      <SectionTitle>Example response</SectionTitle>
      <CodeBlock>{doc.responseExample}</CodeBlock>

      <SectionTitle>Failure modes</SectionTitle>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {doc.failureModes.map((mode) => (
          <li key={mode} className="flex gap-2">
            <span className="mt-1 text-zinc-500">•</span>
            <span>{mode}</span>
          </li>
        ))}
      </ul>

      <SectionTitle>Agent implementation notes</SectionTitle>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {doc.slug === 'kv' && (
          <>
            <li>Use CAS on writes when multiple agent steps may update the same namespace.</li>
            <li>Store compact JSON, not logs; this is a state store, not an archive.</li>
            <li>Prefer TTLs for scratch state that should disappear after completion.</li>
          </>
        )}
        {doc.slug === 'audit' && (
          <>
            <li>Write one audit entry per meaningful transition; avoid noisy heartbeat events.</li>
            <li>Include workflow IDs and actor names so humans can trace the sequence later.</li>
            <li>Use audit for observability, not for state retrieval.</li>
          </>
        )}
        {doc.slug === 'dlq' && (
          <>
            <li>Persist the original payload and the error together so retries are deterministic.</li>
            <li>Always claim before processing to avoid duplicate recovery work.</li>
            <li>Resolve explicitly after successful repair; do not silently drop items.</li>
          </>
        )}
        {doc.slug === 'scheduler' && (
          <>
            <li>Schedule a callback instead of running a sleeper process inside the agent.</li>
            <li>Keep callback handlers idempotent because retries can occur.</li>
            <li>Use scheduler for one-shot delays; hand recurring jobs to cron or external infrastructure.</li>
          </>
        )}
        {doc.slug === 'hitl' && (
          <>
            <li>Use for irreversible or high-stakes actions that need human review.</li>
            <li>Set a timeout strategy up front so paused work cannot hang forever.</li>
            <li>Design the agent flow so a reject path is a first-class outcome, not an exception.</li>
          </>
        )}
      </ul>

      <SummaryBlock doc={doc} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: doc.frontmatter.title,
            description: doc.frontmatter.description,
            mainEntityOfPage: doc.frontmatter.canonical,
            about: {
              '@type': 'SoftwareApplication',
              name: doc.title,
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
            },
          }),
        }}
      />
    </div>
  );
}
