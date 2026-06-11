import { type Metadata } from 'next';
import Link from 'next/link';
import { getToolBySlug, getAllToolSlugs, tools } from '@/lib/seo-tools';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getAllToolSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};

  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    openGraph: {
      title: tool.metaTitle,
      description: tool.metaDescription,
      type: 'website',
      url: `https://www.agent-utils.com/tools/${tool.slug}`,
      siteName: 'AgentUtils',
      images: [{ url: 'https://www.agent-utils.com/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.metaTitle,
      description: tool.metaDescription,
    },
    alternates: {
      canonical: `https://www.agent-utils.com/tools/${tool.slug}`,
    },
  };
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      <pre className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed overflow-x-auto text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SchemaMarkup({ tool }: { tool: ReturnType<typeof getToolBySlug> & {} }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${tool.name} — AgentUtils`,
    description: tool.metaDescription,
    url: `https://www.agent-utils.com/tools/${tool.slug}`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '49',
      offerCount: '3',
    },
    provider: {
      '@type': 'Organization',
      name: 'AgentUtils',
      url: 'https://www.agent-utils.com',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const related = tool.relatedTools
    .map((s) => getToolBySlug(s))
    .filter(Boolean) as ReturnType<typeof getToolBySlug>[];

  return (
    <>
      <SchemaMarkup tool={tool} />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-space-black/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center justify-between px-[var(--spacing-gutter)] py-4 max-w-[var(--spacing-container-max)] mx-auto">
          <Link href="/" className="text-[32px] font-semibold tracking-tight text-on-surface font-[family-name:var(--font-geist-sans)]">
            AgentUtils
          </Link>
          <div className="flex items-center gap-8 text-base text-on-surface-variant">
            <Link href="/docs" className="text-primary-container font-bold hover:text-primary-fixed-dim transition-colors duration-200">
              Docs
            </Link>
            <Link href="/human-in-the-loop" className="hover:text-primary-fixed-dim transition-colors duration-200">
              Human-in-the-Loop
            </Link>
            <Link
              href="/signup"
              className="bg-primary-container text-on-primary-container px-6 py-2 rounded-md font-bold hover:bg-primary transition-all scale-100 active:scale-95"
            >
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16 pt-28">
        {/* Hero */}
        <header>
          <p className="text-sm text-zinc-500 mb-2">{tool.icon} {tool.name}</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">{tool.h1}</h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl">{tool.subtitle}</p>
          <div className="mt-6 flex gap-3">
            <Link
              href={`/docs/${tool.slug}`}
              className="px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors text-sm"
            >
              View API Docs
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:border-zinc-500 transition-colors text-sm"
            >
              Get API Key Free
            </Link>
          </div>
        </header>

        {/* What it does */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold mb-4">What it does</h2>
          <p className="text-zinc-300 leading-relaxed">{tool.whatItDoes}</p>
        </section>

        {/* Why agents need this */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Why agents need this</h2>
          <ul className="space-y-3">
            {tool.whyAgentsNeed.map((reason, i) => (
              <li key={i} className="flex gap-3 text-zinc-300">
                <span className="text-zinc-600 mt-1 shrink-0">&#x2022;</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Code examples */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Get started in 30 seconds</h2>
          <p className="text-zinc-400 mb-4">One API call. No SDK. No configuration.</p>
          <div className="space-y-4">
            <CodeBlock label="cURL" code={tool.codeExample.curl} />
            <CodeBlock label="Python" code={tool.codeExample.python} />
            <CodeBlock label="JavaScript" code={tool.codeExample.js} />
          </div>
        </section>

        {/* Use cases */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Use cases</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tool.useCases.map((uc) => (
              <div key={uc.title} className="rounded-lg border border-zinc-800 p-4">
                <h3 className="font-medium text-zinc-100">{uc.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{uc.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Alternatives */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">AgentUtils vs. alternatives</h2>
          <p className="text-zinc-400 mb-3">
            Traditional tools like {tool.competitors.slice(0, 3).join(', ')} require SDK integration, credential management, and infrastructure setup. AgentUtils replaces all of that with a single HTTP call.
          </p>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium text-zinc-400"></th>
                  <th className="px-4 py-3 font-medium text-zinc-400">AgentUtils</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Alternatives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                <tr>
                  <td className="px-4 py-3 text-zinc-300">Setup time</td>
                  <td className="px-4 py-3 text-zinc-100">30 seconds</td>
                  <td className="px-4 py-3 text-zinc-400">Hours to days</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-zinc-300">SDK required</td>
                  <td className="px-4 py-3 text-zinc-100">No (REST API)</td>
                  <td className="px-4 py-3 text-zinc-400">Yes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-zinc-300">Credentials to manage</td>
                  <td className="px-4 py-3 text-zinc-100">1 API key</td>
                  <td className="px-4 py-3 text-zinc-400">Multiple keys/tokens</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-zinc-300">Infrastructure</td>
                  <td className="px-4 py-3 text-zinc-100">Zero-config</td>
                  <td className="px-4 py-3 text-zinc-400">Provision + configure</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Related tools */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Related tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((rt) => (
              <Link
                key={rt!.slug}
                href={`/tools/${rt!.slug}`}
                className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors block"
              >
                <p className="text-sm">{rt!.icon} {rt!.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{rt!.tagline}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* All tools */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">All AgentUtils tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tools.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className={`rounded-lg border p-3 text-sm hover:border-zinc-600 transition-colors ${
                  t.slug === slug ? 'border-zinc-600 bg-zinc-900' : 'border-zinc-800'
                }`}
              >
                <span>{t.icon} {t.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h2 className="text-2xl font-semibold">Start building for free</h2>
          <p className="mt-2 text-zinc-400">500 free API calls per month. No credit card required.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors"
            >
              Get API Key
            </Link>
            <Link
              href={`/docs/${tool.slug}`}
              className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:border-zinc-500 transition-colors"
            >
              Read Docs
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-charcoal-gray border-t border-border-subtle w-full py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-[var(--spacing-gutter)] max-w-[var(--spacing-container-max)] mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-[32px] font-semibold text-on-surface">AgentUtils</span>
            <p className="text-on-surface-variant font-[family-name:var(--font-jetbrains-mono)] text-xs opacity-80">
              © {new Date().getFullYear()} AgentUtils Infrastructure. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em] text-primary-fixed-dim">
            <a
              href="https://github.com/gibtang/agent-utils"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100"
            >
              GitHub
            </a>
            <Link
              href="/docs"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100"
            >
              Documentation
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
