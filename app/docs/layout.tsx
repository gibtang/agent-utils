import Link from 'next/link';
import GetApiKeyButton from '@/components/GetApiKeyButton';
import { toolDocPages } from '@/lib/docs-pages';

export const dynamic = 'force-static';

const v2 = { slug: 'v2', name: 'v2 API (current)', icon: '⚡' };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-800 overflow-y-auto lg:block">
          <div className="p-6">
            <Link href="/docs" className="text-lg font-semibold tracking-tight hover:text-zinc-300 min-h-[44px] flex items-center">
              AgentUtils Docs
            </Link>

            <div className="mt-6">
              <GetApiKeyButton className="block rounded-md bg-zinc-100 px-3 py-2.5 text-center text-sm font-medium text-zinc-900 hover:bg-white transition-colors min-h-[44px] flex items-center justify-center">
                Get API Key
              </GetApiKeyButton>
            </div>

            <nav className="mt-6 space-y-1">
              <Link
                href={`/docs/${v2.slug}`}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 transition-colors min-h-[44px]"
              >
                <span>{v2.icon}</span>
                {v2.name}
              </Link>
              <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Tools
              </div>
              {toolDocPages.map((tool) => (
                <Link
                  key={tool.slug}
                  href={tool.canonicalPath}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors min-h-[44px]"
                >
                  <span>{tool.tool.icon}</span>
                  {tool.tool.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="lg:hidden border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/docs" className="text-sm font-semibold py-3 px-1 min-h-[44px] flex items-center">Docs</Link>
            <div className="flex gap-1 overflow-x-auto">
              <Link
                href={`/docs/${v2.slug}`}
                className="shrink-0 rounded-md bg-zinc-900 px-2 py-3 text-xs text-zinc-100 min-h-[44px] flex items-center"
              >
                {v2.icon} {v2.name}
              </Link>
              {toolDocPages.map((tool) => (
                <Link
                  key={tool.slug}
                  href={tool.canonicalPath}
                  className="shrink-0 rounded-md px-2 py-3 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 min-h-[44px] flex items-center"
                >
                  {tool.tool.icon} {tool.tool.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <main className="min-w-0 flex-1 px-6 py-10 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
