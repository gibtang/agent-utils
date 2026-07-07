import type { Metadata } from 'next';
import ToolDocPageView from '@/components/docs/ToolDocPage';
import { getToolDocPageBySlug } from '@/lib/docs-pages';

export const dynamic = 'force-static';

const page = getToolDocPageBySlug('dlq')!;

export const metadata: Metadata = {
  title: page.tool.metaTitle,
  description: page.tool.metaDescription,
  alternates: { canonical: page.canonicalPath },
  openGraph: { url: page.canonicalPath },
};

export default function DlqDocsPage() {
  return <ToolDocPageView page={page} />;
}
