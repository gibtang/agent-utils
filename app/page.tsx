import Link from "next/link";
import { tools as allTools } from "@/lib/seo-tools";

export const dynamic = 'force-static';

const featuredTools = [
  { name: "Dead Letter Queue", desc: "Catch, inspect, and retry failed agent tasks.", slug: "dlq" },
  { name: "Human-in-the-Loop Gate", desc: "Pause agents until humans approve.", slug: "checkpoint" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AgentUtils
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <Link href="/docs" className="hover:text-zinc-100 transition-colors">
            Docs
          </Link>
          <Link href="/human-in-the-loop" className="hover:text-zinc-100 transition-colors">
            Human-in-the-Loop
          </Link>
          <a
            href="https://github.com/gibtang/agent-utils"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Star
          </a>
          <Link href="/login" className="hover:text-zinc-100 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-950 font-medium hover:bg-white transition-colors"
          >
            Get API Key
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl font-bold tracking-tight">AgentUtils</h1>
        <p className="mt-4 text-xl text-zinc-400 max-w-xl">
          One API key. 2 agent-native utilities.
        </p>
        <Link
          href="/signup"
          className="mt-8 px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors"
        >
          Start building free
        </Link>
      </section>

      {/* Tools Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredTools.map((tool) => (
            <Link
              key={tool.name}
              href={'/tools/' + tool.slug}
              className="rounded-lg border border-zinc-800 p-5 hover:border-zinc-600 transition-colors block"
            >
              <h3 className="font-semibold text-sm">{tool.name}</h3>
              <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
                {tool.desc}
              </p>
              <span className="mt-2 inline-block text-xs text-zinc-500">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Quick start</h2>
          <pre className={"rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm leading-relaxed overflow-x-auto text-zinc-300"}>{"# 1. Get your API key\ncurl -X POST https://www.agent-utils.com/api/keys \\\n  -H \"Authorization: Bearer YOUR_TOKEN\" \\\n  -d '{\"name\": \"my-agent\"}'\n\n# 2. Pause for human approval\ncurl -X POST https://www.agent-utils.com/api/checkpoint \\\n  -H \"x-api-key: au_...\" \\\n  -d '{\"agentName\": \"deploy-bot\", \"payload\": {\"env\": \"prod\"}}'\n\n# 3. Catch failed tasks in DLQ\ncurl -X POST https://www.agent-utils.com/api/dlq \\\n  -H \"x-api-key: au_...\" \\\n  -d '{\"agentName\": \"data-pipeline\", \"error\": \"Timeout\", \"payload\": {}}'"}</pre>
        </div>
      </section>

      {/* All Tools */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">All tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {allTools.map((tool) => (
              <Link
                key={tool.slug}
                href={'/tools/' + tool.slug}
                className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors block"
              >
                <p className="text-sm font-medium">{tool.icon} {tool.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{tool.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800 px-6 py-6 flex items-center justify-between text-sm text-zinc-500">
        <span>Built for agents. By humans.</span>
        <a
          href="https://github.com/gibtang/agent-utils"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
      </footer>
    </div>
  );
}

