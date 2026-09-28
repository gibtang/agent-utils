'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function ToolAnalytics({ slug }: { slug: string }) {
  useEffect(() => {
    trackEvent('tool_viewed', { tool_slug: slug });
    trackEvent('tool_api_example_viewed', { tool_slug: slug });
  }, [slug]);

  return null;
}
