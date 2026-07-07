import type { Metadata } from 'next';
import ToolDocPageView from '@/components/docs/ToolDocPage';
import { getToolDocPageBySlug } from '@/lib/docs-pages';

export const dynamic = 'force-static';

const page = getToolDocPageBySlug('kv-store')!;

export const metadata: Metadata = {
  title: page.tool.metaTitle,
  description: page.tool.metaDescription,
  alternates: { canonical: page.canonicalPath },
  openGraph: { url: page.canonicalPath },
};

export default function KvStoreDocsPage() {
  return <ToolDocPageView page={page} />;
}
