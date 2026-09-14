'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function ToolAnalytics({ slug }: { slug: string }) {
  useEffect(() => {
    trackEvent('tool_viewed', { tool_slug: slug });
  }, [slug]);

  return null;
}
