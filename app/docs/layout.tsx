import Link from 'next/link';

export const dynamic = 'force-static';

const tools = [
  { slug: 'file-host', name: 'File Host', icon: '📎' },
  { slug: 'json', name: 'JSON Cleaner', icon: '🧹' },
  { slug: 'dlq', name: 'Dead Letter Queue', icon: '📬' },
  { slug: 'checkpoint', name: 'Human-in-the-Loop', icon: '👤' },
  { slug: 'shield', name: 'Agent Shield', icon: '🛡️' },
  { slug: 'otp', name: 'AgentVerify OTP', icon: '🔑' },
  { slug: 'notify', name: 'Notification Router', icon: '🔔' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-800 overflow-y-auto lg:block">
          <div className="p-6">
            <Link href="/docs" className="text-lg font-semibold tracking-tight hover:text-zinc-300">
              AgentUtils Docs
            </Link>

            <div className="mt-6">
              <Link
                href="/signup"
                className="block rounded-md bg-zinc-100 px-3 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
              >
                Get API Key
              </Link>
            </div>

            <nav className="mt-6 space-y-1">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/docs/${tool.slug}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                >
                  <span>{tool.icon}</span>
                  {tool.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="lg:hidden border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/docs" className="text-sm font-semibold">Docs</Link>
            <div className="flex gap-1 overflow-x-auto">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/docs/${tool.slug}`}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                >
                  {tool.icon} {tool.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="min-w-0 flex-1 px-6 py-10 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
