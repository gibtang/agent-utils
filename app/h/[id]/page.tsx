import HandoffForm from '@/components/handoff/HandoffForm';
import { viewHandoffForForm } from '@/lib/handoff/service';

export const dynamic = 'force-dynamic';
const unavailable = <main><p>This link is no longer available.</p></main>;

export default async function HandoffPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.t === 'string' ? query.t : '';
  let form;
  try { form = await viewHandoffForForm(token); } catch { return unavailable; }
  // Do not reveal whether a valid token was paired with a different path ID.
  if (form.handoffId !== id) return unavailable;
  return <main><HandoffForm handoffId={form.handoffId} token={token} title={form.title} fields={form.fields} /></main>;
}
