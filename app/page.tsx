import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import type { Metadata } from "next";

export const dynamic = 'force-static';

export const metadata: Metadata = {
  // Page-specific og:url so social shares of the homepage point here,
  // not a leaked default from the root layout.
  openGraph: { url: "/" },
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-space-black/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center justify-between px-[var(--spacing-gutter)] py-4 max-w-[var(--spacing-container-max)] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[32px] font-semibold tracking-tight text-on-surface font-[family-name:var(--font-geist-sans)]">
              AgentUtils
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-8 text-base text-on-surface-variant">
            <Link href="/docs" className="text-primary-container font-bold hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center">
              Docs
            </Link>
            <Link href="/human-in-the-loop" className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center">
              Human-in-the-Loop
            </Link>
            <Link href="/tools/dlq" className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center">
              DLQ
            </Link>
            <Link href="/tools/checkpoint" className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center">
              Checkpoint
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile hamburger menu */}
            <MobileNav />
            <a
              href="https://github.com/gibtang/agent-utils"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="hidden sm:flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all active:opacity-80 p-3 min-w-[44px] min-h-[44px]"
            >
              <svg viewBox="0 0 16 16" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
            <Link
              href="/docs/v2"
              className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-md font-bold hover:bg-primary transition-all scale-100 active:scale-95 min-h-[44px] flex items-center"
            >
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32">
        {/* Hero Section */}
        <section className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)] grid lg:grid-cols-2 gap-12 items-center mb-32">
          <div className="space-y-8">
            <h1 className="text-5xl md:text-[48px] font-bold leading-[56px] tracking-[-0.02em]">
              The Missing Infrastructure Layer for{" "}
              <span className="text-primary-container">AI Agents</span>
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl leading-6">
              Production-ready dead letter queues, human-in-the-loop gates, and
              redactable memory—all behind a single API key. No SDKs, just curl
              and go.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/docs/v2"
                className="bg-on-surface text-space-black px-8 py-4 rounded-md font-bold text-lg hover:bg-primary transition-all"
              >
                Start building free
              </Link>
              <Link
                href="/docs"
                className="border border-border-subtle px-8 py-4 rounded-md font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em] hover:border-primary-container transition-all flex items-center gap-2"
              >
                Read the docs →
              </Link>
            </div>
          </div>

          {/* Terminal Mockup */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-container/20 to-secondary-container/20 blur opacity-75 group-hover:opacity-100 transition duration-1000" />
            <div className="relative bg-charcoal-gray border border-border-subtle rounded-lg p-6 font-[family-name:var(--font-jetbrains-mono)] text-sm terminal-glow overflow-hidden">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-error-container/40" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                <div className="w-3 h-3 rounded-full bg-green-500/40" />
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-primary-container">curl</span>
                  <span className="text-on-surface">-X POST</span>
                  <span className="text-syntax-keyword">
                    &quot;https://www.agent-utils.com/v1/checkpoints&quot;
                  </span>
                </div>
                <div className="pl-4 text-on-surface-variant">
                  -H{" "}
                  <span className="text-syntax-keyword">
                    &quot;x-agent-id: trade-bot&quot; \
                  </span>{" "}
                  -H{" "}
                  <span className="text-syntax-keyword">
                    &quot;x-api-key: $AGENT_KEY&quot;
                  </span>{" "}
                  \
                </div>
                <div className="pl-4 text-on-surface-variant">-d {"{"}</div>
                <div className="pl-8 flex gap-2">
                  <span className="text-primary-container">
                    &quot;title&quot;:
                  </span>
                  <span className="text-syntax-keyword">
                    &quot;Execute AAPL trade&quot;
                  </span>
                  ,
                </div>
                <div className="pl-8 flex gap-2">
                  <span className="text-primary-container">
                    &quot;callback_url&quot;:
                  </span>
                  <span className="text-syntax-keyword">
                    &quot;https://trade-bot.com/hook&quot;
                  </span>
                  ,
                </div>
                <div className="pl-8 flex gap-2">
                  <span className="text-primary-container">&quot;timeout_action&quot;:</span>
                  <span className="text-syntax-keyword">
                    &quot;auto_reject&quot;
                  </span>
                </div>
                <div className="pl-4 text-on-surface-variant">{"}"}</div>
              </div>
              <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-on-surface-variant opacity-50">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
                  // Terminal Output
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Bento Grid */}
        <section className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)] mb-32">
          <div className="grid md:grid-cols-2 gap-6">
            {/* DLQ Card */}
            <div className="bento-card group bg-charcoal-gray border border-border-subtle rounded-xl p-10 flex flex-col justify-between overflow-hidden relative min-h-[400px]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <div>
                <div className="w-12 h-12 bg-primary-container/10 border border-primary-container/20 rounded-lg flex items-center justify-center mb-8">
                  <svg className="w-6 h-6 text-primary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] mb-4">
                  Dead Letter Queue
                </h3>
                <p className="text-base text-on-surface-variant max-w-sm leading-6">
                  Catch, inspect, and retry failed agent tasks without losing
                  state. Never lose a lead or a transaction to an API timeout
                  again.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-4 text-on-primary-container font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em]">
                <span className="px-3 py-1 bg-primary-container/10 border border-primary-container/20 rounded">
                  RETRY_LOGIC
                </span>
                <span className="px-3 py-1 bg-primary-container/10 border border-primary-container/20 rounded">
                  STATE_PERSISTENCE
                </span>
              </div>
            </div>

            {/* HITL Card */}
            <div className="bento-card group bg-charcoal-gray border border-border-subtle rounded-xl p-10 flex flex-col justify-between overflow-hidden relative min-h-[400px]">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-container/5 rounded-full blur-3xl -ml-32 -mb-32" />
              <div>
                <div className="w-12 h-12 bg-secondary-container/10 border border-secondary-container/20 rounded-lg flex items-center justify-center mb-8">
                  <svg className="w-6 h-6 text-secondary-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] mb-4">
                  Human-in-the-Loop
                </h3>
                <p className="text-base text-on-surface-variant max-w-sm leading-6">
                  Pause agents until a human approves. Prevent costly errors and
                  hallucinated actions with automated Slack and email alerts.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-4 text-secondary font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em]">
                <span className="px-3 py-1 bg-secondary-container/10 border border-secondary-container/20 rounded">
                  APPROVAL_GATES
                </span>
                <span className="px-3 py-1 bg-secondary-container/10 border border-secondary-container/20 rounded">
                  WEBHOOKS
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tools Section — Quick access to DLQ and Checkpoint */}
        <section className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)] mb-32">
          <h2 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] mb-8 text-center">
            Free Tools
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/tools/dlq" className="bento-card group bg-charcoal-gray border border-border-subtle rounded-xl p-8 hover:border-primary-container/30 transition-colors">
              <h3 className="text-xl font-semibold mb-3">Dead Letter Queue</h3>
              <p className="text-sm text-on-surface-variant leading-6">
                Catch, inspect, and retry failed agent tasks. Never lose state to an API timeout.
              </p>
              <span className="inline-block mt-4 text-primary-container font-semibold text-sm group-hover:underline">
                Try it →
              </span>
            </Link>
            <Link href="/tools/checkpoint" className="bento-card group bg-charcoal-gray border border-border-subtle rounded-xl p-8 hover:border-primary-container/30 transition-colors">
              <h3 className="text-xl font-semibold mb-3">Checkpoint</h3>
              <p className="text-sm text-on-surface-variant leading-6">
                Pause agents until a human approves. Gate dangerous actions with automated alerts.
              </p>
              <span className="inline-block mt-4 text-primary-container font-semibold text-sm group-hover:underline">
                Try it →
              </span>
            </Link>
          </div>
        </section>

        {/* Framework Integrations */}
        <section className="border-y border-border-subtle bg-surface-container-lowest/50 py-16 mb-32">
          <div className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)]">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant text-center mb-12">
              Agnostic Infrastructure for Every Stack
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-12 items-center justify-items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
              <span className="text-[32px] font-semibold text-on-surface flex items-center gap-2">
                <span className="text-primary-container">⚡</span> OpenAI
              </span>
              <span className="text-[32px] font-semibold text-on-surface flex items-center gap-2">
                <span className="text-primary-container">✦</span> Anthropic
              </span>
              <span className="text-[32px] font-semibold text-on-surface flex items-center gap-2">
                <span className="text-primary-container">🔗</span> LangChain
              </span>
              <span className="text-[32px] font-semibold text-on-surface flex items-center gap-2">
                <span className="text-primary-container">👥</span> CrewAI
              </span>
              <span className="text-[32px] font-semibold text-on-surface flex items-center gap-2">
                <span className="text-primary-container">🤖</span> AutoGen
              </span>
            </div>
            <div className="mt-16 text-center">
              <p className="text-base text-on-surface-variant inline-flex items-center gap-2">
                <span className="text-green-500">🔓</span>
                Self-hostable under{" "}
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold bg-surface-container-highest px-2 py-0.5 rounded text-on-surface">
                  AGPL-3.0
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* How Agents Stay Safe */}
        <section className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)] mb-32">
          <h2 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] mb-8 text-center">
            How agents stay safe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="bento-card rounded-lg border border-border-subtle bg-charcoal-gray p-5">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="text-sm font-semibold">Redact PII</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Scrub sensitive data before it reaches LLMs or tools
              </p>
            </div>
            <div className="bento-card rounded-lg border border-border-subtle bg-charcoal-gray p-5">
              <div className="text-2xl mb-2">👤</div>
              <h3 className="text-sm font-semibold">Human approval</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Gate dangerous actions behind a human checkpoint
              </p>
            </div>
            <div className="bento-card rounded-lg border border-border-subtle bg-charcoal-gray p-5">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="text-sm font-semibold">Execute safely</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Approved actions execute with full audit logging
              </p>
            </div>
            <div className="bento-card rounded-lg border border-border-subtle bg-charcoal-gray p-5">
              <div className="text-2xl mb-2">📬</div>
              <h3 className="text-sm font-semibold">Recover failures</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Failed tasks land in a dead letter queue for replay
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-[var(--spacing-container-max)] mx-auto px-[var(--spacing-gutter)] mb-32">
          <div className="relative rounded-2xl overflow-hidden border border-border-subtle p-12 md:p-24 text-center">
            <div className="absolute inset-0 z-0 overflow-hidden" />
            <div className="relative z-10">
              <h2 className="text-[48px] font-bold leading-[56px] tracking-[-0.02em] mb-6">
                Scale your agents to production today.
              </h2>
              <p className="text-base text-on-surface-variant max-w-xl mx-auto mb-10 leading-6">
                Join 2,000+ engineers building reliable AI agents on the industry
                standard infrastructure. No platform lock-in.
              </p>
              <Link
                href="/docs/v2"
                className="bg-primary-container text-on-primary-container px-10 py-5 rounded-lg font-bold text-xl hover:bg-primary hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary-container/20 inline-block"
              >
                Get API Key
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-charcoal-gray border-t border-border-subtle w-full py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-[var(--spacing-gutter)] max-w-[var(--spacing-container-max)] mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[32px] font-semibold text-on-surface">
                AgentUtils
              </span>
            </div>
            <p className="text-on-surface-variant font-[family-name:var(--font-jetbrains-mono)] text-xs opacity-80">
              © {new Date().getFullYear()} AgentUtils Infrastructure. All rights
              reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em] text-primary-fixed-dim">
            <a
              href="https://github.com/gibtang/agent-utils"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              GitHub
            </a>
            <Link
              href="/docs"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              Documentation
            </Link>
            <Link
              href="/docs/v2"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              DLQ Docs
            </Link>
            <Link
              href="/docs/v2"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              Checkpoint Docs
            </Link>
            <Link
              href="/tools/dlq"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              DLQ Tool
            </Link>
            <Link
              href="/tools/checkpoint"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              Checkpoint Tool
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
