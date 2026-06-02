import Link from "next/link";
import { tools as allTools } from "@/lib/seo-tools";

const featuredTools = [
  { name: "Ephemeral File Host", desc: "Park files for agents. Auto-expires.", slug: "file-host" },
  { name: "Dead Letter Queue", desc: "Catch, inspect, and retry failed agent tasks.", slug: "dlq" },
  { name: "Human-in-the-Loop Gate", desc: "Pause agents until humans approve.", slug: "checkpoint" },
  { name: "Agent Shield", desc: "PII redaction proxy. Clean before LLM, hydrate after.", slug: "shield" },
  { name: "AgentVerify OTP", desc: "Temporary phone numbers for agent 2FA.", slug: "otp" },
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
          One API key. 6 agent-native utilities.
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
              href={`/tools/${tool.slug}`}
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
          <pre className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm leading-relaxed overflow-x-auto text-zinc-300">
{`# 1. Get your API key
curl -X POST https://agentutils.dev/api/keys \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"name": "my-agent"}'

# 2. Upload a file
curl -X POST https://agentutils.dev/api/file-host \\
  -H "x-api-key: au_..." \\
  -F "file=@report.csv"

# 3. Send a notification
curl -X POST https://agentutils.dev/api/notify \\
  -H "x-api-key: au_..." \\
  -d '{"message": "Task complete"}'`}
          </pre>
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
                href={`/tools/${tool.slug}`}
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
      <footer className="mt-auto border-t border-zinc-800 px-6 py-6 text-center text-sm text-zinc-500">
        Built for agents. By humans.
      </footer>
    </div>
  );
}
