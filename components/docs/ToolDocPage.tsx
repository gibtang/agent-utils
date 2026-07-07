import Link from 'next/link';
import { type ToolDocPage } from '@/lib/docs-pages';

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</p>
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function JsonBlock({ id, value }: { id: string; value: unknown }) {
  return (
    <script
      id={id}
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(value, null, 2) }}
    />
  );
}

export default function ToolDocPageView({ page }: { page: ToolDocPage }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: page.title,
    description: page.summary,
    url: `https://www.agent-utils.com${page.canonicalPath}`,
    about: {
      '@type': 'SoftwareApplication',
      name: `${page.tool.name} — AgentUtils`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
    },
  };

  const summary = {
    slug: page.slug,
    title: page.title,
    canonical: page.canonicalPath,
    endpoint: page.endpoint,
    method: page.method,
    auth: page.auth,
    machine_readable: page.machineReadable,
    request_shape: page.requestShape,
    agent_workflows: page.agentWorkflows,
    failure_modes: page.failureModes,
  };

  return (
    <article className="max-w-3xl">
      <JsonBlock id={`tool-doc-summary-${page.slug}`} value={summary} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Docs
      </Link>

      <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
        <span>{page.tool.icon}</span>
        <span>{page.tool.name}</span>
        <span>•</span>
        <span>{page.endpoint}</span>
      </div>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">{page.title}</h1>
      <p className="mt-3 text-lg text-zinc-400">{page.summary}</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">What it does</h2>
        <p className="mt-3 leading-relaxed text-zinc-300">{page.whatItDoes}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Endpoint</h2>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          <p><span className="text-zinc-500">Method:</span> {page.method}</p>
          <p className="mt-1"><span className="text-zinc-500">Path:</span> {page.endpoint}</p>
          <p className="mt-1"><span className="text-zinc-500">Auth:</span> {page.auth}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Request shape</h2>
        <ul className="mt-3 space-y-2 text-zinc-300">
          {page.requestShape.map((shape) => (
            <li key={shape} className="flex gap-3">
              <span className="text-zinc-600">•</span>
              <span>{shape}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Example requests</h2>
        <p className="mt-2 text-sm text-zinc-500">Copy-pasteable examples for agents and automation.</p>
        <div className="mt-4 space-y-4">
          <CodeBlock label="cURL" code={page.codeExamples.curl} />
          <CodeBlock label="Python" code={page.codeExamples.python} />
          <CodeBlock label="JavaScript" code={page.codeExamples.js} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">How agents use it</h2>
        <div className="mt-3 space-y-3">
          {page.agentWorkflows.map((workflow) => (
            <div key={workflow} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-zinc-300">
              {workflow}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">When to use it</h2>
        <ul className="mt-3 space-y-2 text-zinc-300">
          {page.whenToUse.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="text-emerald-500">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">When not to use it</h2>
        <ul className="mt-3 space-y-2 text-zinc-300">
          {page.whenNotToUse.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="text-amber-500">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Failure modes</h2>
        <ul className="mt-3 space-y-2 text-zinc-300">
          {page.failureModes.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="text-rose-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Machine-readable summary</h2>
        <p className="mt-2 text-sm text-zinc-500">This JSON block is stable for crawlers, agents, and downstream documentation pipelines.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300">
          <code>{JSON.stringify(summary, null, 2)}</code>
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-50">Related docs</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {page.relatedSlugs.map((slug) => (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              className="rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              {slug}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
