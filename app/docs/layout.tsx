import Link from 'next/link';
import { getCurrentAgentUtilsDocs } from '@/lib/agentutils-docs';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getCurrentAgentUtilsDocs();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-6 lg:w-64">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Docs navigation</p>
            <nav className="mt-3 space-y-2 text-sm">
              <Link href="/docs" className="block text-zinc-200 hover:text-white">
                Docs index
              </Link>
              <Link href="/docs/v2" className="block text-zinc-400 hover:text-zinc-200">
                Aggregate v2 reference
              </Link>
              {docs.map((doc) => (
                <Link key={doc.slug} href={doc.frontmatter.canonical} className="block text-zinc-400 hover:text-zinc-200">
                  {doc.title}
                </Link>
              ))}
              <Link href="/docs/image-upload" className="block text-zinc-400 hover:text-zinc-200">
                Image Upload (legacy)
              </Link>
            </nav>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
