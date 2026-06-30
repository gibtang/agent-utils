import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import GetApiKeyButton from "@/components/GetApiKeyButton";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-space-black/80 backdrop-blur-md border-b border-border-subtle">
        <div className="flex items-center justify-between px-[var(--spacing-gutter)] py-4 max-w-[var(--spacing-container-max)] mx-auto">
          <Link
            href="/"
            className="text-[32px] font-semibold tracking-tight text-on-surface font-[family-name:var(--font-geist-sans)] min-h-[44px] flex items-center"
          >
            AgentUtils
          </Link>
          <div className="hidden md:flex items-center gap-8 text-base text-on-surface-variant">
            <Link
              href="/docs"
              className="text-primary-container font-bold hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              Docs
            </Link>
            <Link
              href="/human-in-the-loop"
              className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              Human-in-the-Loop
            </Link>
            <Link
              href="/tools/dlq"
              className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              DLQ
            </Link>
            <Link
              href="/tools/checkpoint"
              className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              Checkpoint
            </Link>
            <Link
              href="/tools/kv-store"
              className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              KV Store
            </Link>
            <Link
              href="/tools/audit-log"
              className="hover:text-primary-fixed-dim transition-colors duration-200 py-2.5 px-1 min-h-[44px] flex items-center"
            >
              Audit Log
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile hamburger menu */}
            <MobileNav />
            <a
              href="https://github.com/gibtang/agent-utils"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="hidden sm:flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all active:opacity-80 p-3 min-w-[44px] min-h-[44px]"
            >
              <svg viewBox="0 0 16 16" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <GetApiKeyButton
              className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-md font-bold hover:bg-primary transition-all scale-100 active:scale-95 min-h-[44px] flex items-center"
            >
              Get API Key
            </GetApiKeyButton>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-[var(--spacing-gutter)] pt-32 pb-16">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold uppercase tracking-[0.05em] text-primary-container mb-6">
          Error 404
        </p>
        <h1 className="text-5xl md:text-[64px] font-bold leading-[56px] tracking-[-0.02em] mb-6">
          Page not found
        </h1>
        <p className="text-base text-on-surface-variant max-w-xl leading-6 mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Head back home or explore the docs.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="bg-on-surface text-space-black px-8 py-4 rounded-md font-bold text-lg hover:bg-primary transition-all min-h-[44px] flex items-center"
          >
            Back to Home
          </Link>
          <Link
            href="/docs/v2"
            className="border border-border-subtle px-8 py-4 rounded-md font-bold text-lg hover:border-primary-container transition-all min-h-[44px] flex items-center"
          >
            Read the docs →
          </Link>
        </div>
      </main>
    </div>
  );
}
