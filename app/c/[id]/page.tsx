import { notFound } from 'next/navigation';
import ConfessionResponseForm from './ConfessionResponseForm';
export const dynamic = 'force-dynamic';
/** Public shell only: credentials and confession content are never server-rendered. */
export default async function ConfessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id.startsWith('conf_')) notFound();
  return <main className="mx-auto max-w-2xl px-6 py-12"><p className="text-sm text-gray-500">AgentUtils · Confession review</p><h1 className="mt-2 text-3xl font-bold">Authenticate to review this confession</h1><p className="mt-3 text-gray-700">Use a tenant admin or approval-proxy credential. The confession is fetched only after authentication.</p><ConfessionResponseForm id={id} /></main>;
}
