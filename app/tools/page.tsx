import Link from 'next/link';
import { type Metadata } from 'next';
import MobileNav from '@/components/MobileNav';
import GetApiKeyButton from '@/components/GetApiKeyButton';
import { tools } from '@/lib/seo-tools';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'All Tools — AgentUtils',
  description: 'Browse the launch AgentUtils API tools for AI agents: Dead Letter Queue, Checkpoint, KV Store, Audit Log, and Image Upload.',
  openGraph: { url: '/tools' },
  alternates: {
    canonical: 'https://www.agent-utils.com/tools',
  },
};

export default function ToolsPage() {
  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-space-black/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center justify-between px-[var(--spacing-gutter)] py-4 max-w-[var(--spacing-container-max)] mx-auto">
          <Link href="/" className="text-[32px] font-semibold tracking-tight text-on-surface font-[family-name:var(--font-geist-sans)] min-h-[44px] flex items-center">
            AgentUtils
          </Link>
          <div className="hidden md:flex items-center gap-8 text-base text-on-surface-variant">
            <Link href="/docs" className="text-primary-container font-bold hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              Docs
            </Link>
            <Link href="/tools/dlq" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              DLQ
            </Link>
            <Link href="/tools/checkpoint" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              Checkpoint
            </Link>
            <Link href="/tools/kv-store" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              KV Store
            </Link>
            <Link href="/tools/audit-log" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              Audit Log
            </Link>
            <Link href="/tools/image-upload" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              Image Upload
            </Link>
            <Link href="/tools/scheduler" className="hover:text-primary-fixed-dim transition-colors duration-200 py-3 px-1 min-h-[44px] flex items-center">
              Scheduler
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile hamburger menu */}
            <MobileNav />
            <GetApiKeyButton
              className="bg-primary-container text-on-primary-container px-6 py-3 rounded-md font-bold hover:bg-primary transition-all scale-100 active:scale-95 min-h-[44px] flex items-center"
            >
              Get API Key
            </GetApiKeyButton>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 pt-28">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">All Tools</h1>
          <p className="mt-4 text-lg text-zinc-400">
            The launch tools as standalone pages. One API key. No SDK.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="rounded-xl border border-zinc-800 p-6 hover:border-zinc-600 transition-colors block group"
            >
              <div className="text-3xl mb-3">{tool.icon}</div>
              <h2 className="text-xl font-semibold text-zinc-100 group-hover:text-white">{tool.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{tool.tagline}</p>
              <p className="mt-4 text-xs text-zinc-600 font-mono">{tool.apiEndpoint}</p>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/docs/v2"
            className="inline-block px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors"
          >
            Get Free API Key
          </Link>
          <p className="mt-3 text-sm text-zinc-500">500 free API calls per month. No credit card.</p>
        </div>
      </main>

    </>
  );
}
