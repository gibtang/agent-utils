/**
 * /dashboard/handoffs — owner view of credential handoffs.
 *
 * Client page following the existing dashboard convention (client component
 * gated by AuthProvider; server-side middleware is the primary gate). All
 * data comes from metadata-only owner routes; there is no secret display
 * surface on this page.
 */
import HandoffsSection from '@/components/handoff/HandoffsSection';

export default function DashboardHandoffsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Handoffs</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Credential requests your agents created, with status and audit trail.
        </p>
      </header>
      <div className="mt-8">
        <HandoffsSection />
      </div>
    </main>
  );
}
