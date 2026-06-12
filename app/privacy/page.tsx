import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy Policy — AgentUtils',
  description: 'Privacy Policy for AgentUtils infrastructure platform.',
  openGraph: {
    title: 'Privacy Policy — AgentUtils',
    description: 'Privacy Policy for AgentUtils infrastructure platform.',
    url: 'https://www.agent-utils.com/privacy',
    siteName: 'AgentUtils',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.agent-utils.com/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-charcoal-gray text-on-surface">
      <nav className="border-b border-border-subtle px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-on-surface hover:text-primary transition-colors">
            AgentUtils
          </Link>
          <Link href="/" className="text-sm text-on-surface-variant hover:text-primary transition-colors min-h-[44px] flex items-center">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-on-surface mb-8">Privacy Policy</h1>
        <p className="text-on-surface-variant mb-8">Last updated: June 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-on-surface-variant">
          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">1. Information We Collect</h2>
            <p>
              We collect information you provide directly, including your email address when you create
              an account, and API keys generated through the Service. We also collect usage data such as
              API call logs and error rates to improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve the Service,
              to process your API requests, and to communicate with you about your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">3. Data Retention</h2>
            <p>
              API call data and checkpoint data are retained for 30 days by default. You may
              configure shorter retention periods through your account settings. Account data is
              retained for the lifetime of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">4. Data Sharing</h2>
            <p>
              We do not sell or share your personal data with third parties except as necessary
              to provide the Service (e.g., cloud hosting providers) or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">5. Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including
              encryption in transit (TLS) and at rest. API keys are hashed before storage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">6. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time
              by contacting us at{' '}
              <a href="mailto:admin@a2z-soft.co" className="text-primary hover:underline">admin@a2z-soft.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">7. Contact</h2>
            <p>
              For questions about this Privacy Policy, contact us at{' '}
              <a href="mailto:admin@a2z-soft.co" className="text-primary hover:underline">admin@a2z-soft.co</a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-charcoal-gray border-t border-border-subtle w-full py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-[var(--spacing-gutter)] max-w-[var(--spacing-container-max)] mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-[32px] font-semibold text-on-surface">AgentUtils</span>
            <p className="text-on-surface-variant font-[family-name:var(--font-jetbrains-mono)] text-xs opacity-80">
              © {new Date().getFullYear()} AgentUtils Infrastructure. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.05em] text-primary-fixed-dim">
            <a href="https://github.com/gibtang/agent-utils" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center">
              GitHub
            </a>
            <Link href="/docs" className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center">
              Documentation
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors opacity-80 hover:opacity-100 py-3.5 px-1 min-h-[44px] flex items-center">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
