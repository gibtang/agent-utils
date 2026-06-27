import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms of Service — AgentUtils',
  description: 'Terms of Service for AgentUtils infrastructure platform.',
  openGraph: {
    title: 'Terms of Service — AgentUtils',
    description: 'Terms of Service for AgentUtils infrastructure platform.',
    url: 'https://www.agent-utils.com/terms',
    siteName: 'AgentUtils',
    type: 'website',
    images: [{ url: 'https://www.agent-utils.com/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — AgentUtils',
    description: 'Terms of Service for AgentUtils infrastructure platform.',
  },
  alternates: {
    canonical: 'https://www.agent-utils.com/terms',
  },
}

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-on-surface mb-8">Terms of Service</h1>
        <p className="text-on-surface-variant mb-8">Last updated: June 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-on-surface-variant">
          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AgentUtils (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">2. Description of Service</h2>
            <p>
              AgentUtils provides infrastructure tools for AI agents, including but not limited to
              checkpointing, dead letter queue management, and human-in-the-loop workflows.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">3. API Usage</h2>
            <p>
              Access to the API is provided on a tiered basis. Free tier usage is subject to rate limits
              as documented. Abuse of the API or exceeding rate limits may result in temporary or permanent
              suspension of access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">4. Data</h2>
            <p>
              You retain ownership of all data you submit to the Service. We process your data solely to
              provide the Service and do not use it for any other purpose. See our{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">5. Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. In no event shall AgentUtils
              be liable for any indirect, incidental, special, or consequential damages arising out of the use
              of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-on-surface mt-12 mb-4">6. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:admin@a2z-soft.co" className="text-primary hover:underline">admin@a2z-soft.co</a>.
            </p>
          </section>
        </div>
      </main>

    </div>
  )
}
