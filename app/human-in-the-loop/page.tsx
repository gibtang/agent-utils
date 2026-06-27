import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Human-in-the-Loop API for AI Agents — Pause, Approve, Resume | AgentUtils',
  description: 'Add human approval gates to any AI agent workflow. One API call to pause agents, wait for human review, then resume. Free tier. No infrastructure needed.',
  keywords: [
    'human in the loop',
    'human in the loop ai',
    'human in the loop api',
    'ai agent approval',
    'human oversight ai',
    'ai guardrails',
    'agent checkpoint',
    'ai approval workflow',
    'human in the loop machine learning',
    'hitl api',
  ],
  openGraph: {
    title: 'Human-in-the-Loop API for AI Agents',
    description: 'Pause AI agents for human approval. One API call. No infrastructure.',
    url: 'https://www.agent-utils.com/human-in-the-loop',
    siteName: 'AgentUtils',
    type: 'website',
    images: [{ url: 'https://www.agent-utils.com/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Human-in-the-Loop API for AI Agents',
    description: 'Pause AI agents for human approval. One API call. No infrastructure.',
  },
  alternates: {
    canonical: 'https://www.agent-utils.com/human-in-the-loop',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
}

export default function HumanInTheLoopPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight min-h-[44px] flex items-center">
          AgentUtils
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <Link href="/docs" className="hover:text-zinc-100 transition-colors py-3 px-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
            Docs
          </Link>
          <Link href="/tools/checkpoint" className="hover:text-zinc-100 transition-colors py-3 px-1 min-h-[44px] flex items-center">
            API Reference
          </Link>
          <Link
            href="/docs/v2"
            className="px-3 py-3 rounded-md bg-zinc-100 text-zinc-950 font-medium hover:bg-white transition-colors min-h-[44px] flex items-center"
          >
            Get API Key
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-16">
        <div className="text-sm text-zinc-500 mb-4">👤 Checkpoint</div>
        <h1 className="text-5xl font-bold tracking-tight max-w-3xl">
          Human-in-the-Loop for AI Agents
        </h1>
        <p className="mt-4 text-xl text-zinc-400 max-w-2xl">
          Pause any AI agent at a critical step. Wait for human approval. Resume with one API call.
          No message brokers. No infrastructure. Just one HTTP request.
        </p>
        <div className="flex gap-4 mt-8">
          <Link
            href="/docs/v2"
            className="px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors min-h-[44px] flex items-center"
          >
            Start building free
          </Link>
          <Link
            href="/tools/checkpoint"
            className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-semibold hover:border-zinc-500 transition-colors min-h-[44px] flex items-center"
          >
            API Docs →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-8 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border border-zinc-800 p-6">
              <div className="text-3xl mb-3">1️⃣</div>
              <h3 className="font-semibold mb-2">Agent pauses</h3>
              <p className="text-sm text-zinc-400">
                Your agent calls <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">POST /v1/checkpoints</code> with
                the task description and current state. It gets a checkpoint ID back.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <div className="text-3xl mb-3">2️⃣</div>
              <h3 className="font-semibold mb-2">Human reviews</h3>
              <p className="text-sm text-zinc-400">
                A human gets notified (email, Slack, dashboard). They review what the agent wants to do
                and approve or reject it.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <div className="text-3xl mb-3">3️⃣</div>
              <h3 className="font-semibold mb-2">Agent resumes</h3>
              <p className="text-sm text-zinc-400">
                On approval, the agent&apos;s webhook fires with the original state. It picks up exactly
                where it left off. Rejection includes a reason.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">3 lines to add human approval</h2>
          <pre className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm leading-relaxed overflow-x-auto text-zinc-300">
{`// In your agent's critical step:
const checkpoint = await fetch("https://www.agent-utils.com/v1/checkpoints", {
  method: "POST",
  headers: { "x-api-key": "au_...", "Content-Type": "application/json" },
  body: JSON.stringify({
    agentName: "deploy-bot",
    taskDescription: "Deploy v2.3.1 to production",
    state: { version: "2.3.1", target: "prod" },
    webhookUrl: "https://your-agent.com/resume"
  })
});

// Agent sleeps. Human approves via dashboard.
// Webhook fires → agent resumes with original state.`}
          </pre>
        </div>
      </section>

      {/* Why HITL */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Why human-in-the-loop?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-zinc-800 p-6">
              <h3 className="font-semibold mb-2">🇪🇺 EU AI Act compliance</h3>
              <p className="text-sm text-zinc-400">
                The EU AI Act mandates human oversight for high-risk AI systems. Checkpoint gives you
                auditable approval logs out of the box.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <h3 className="font-semibold mb-2">🛡️ Prevent costly mistakes</h3>
              <p className="text-sm text-zinc-400">
                Agents making production deployments, financial transactions, or data deletions?
                Add a human gate before the irreversible action.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <h3 className="font-semibold mb-2">⚡ Zero infrastructure</h3>
              <p className="text-sm text-zinc-400">
                No Redis. No message queues. No state machines. One API call pauses your agent,
                one webhook resumes it. We handle the rest.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <h3 className="font-semibold mb-2">📊 Audit trail</h3>
              <p className="text-sm text-zinc-400">
                Every approval/rejection is logged with timestamps, reasons, and the full agent state.
                Export for compliance audits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-4">Add human oversight to your agents</h2>
          <p className="text-zinc-400 mb-6">
            Free tier: 100 checkpoints/month. No credit card required.
          </p>
          <Link
            href="/docs/v2"
            className="inline-block px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-semibold hover:bg-white transition-colors min-h-[44px] flex items-center"
          >
            Get your API key →
          </Link>
        </div>
      </section>

    </div>
  )
}
