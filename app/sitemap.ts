import { type MetadataRoute } from 'next';
import { getAllToolSlugs } from '@/lib/seo-tools';

const BASE_URL = 'https://www.agent-utils.com';

// Static dates — only update when content actually changes.
// Using new Date() on every build makes Google distrust lastmod.
const LAST_MOD = '2026-06-03';

export default function sitemap(): MetadataRoute.Sitemap {
  const toolSlugs = getAllToolSlugs();
  const toolPages = toolSlugs.map((slug) => ({
    url: `${BASE_URL}/tools/${slug}`,
    lastModified: LAST_MOD,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Only include docs pages that actually exist as routes.
  // /docs/dlq and /docs/checkpoint were deleted (commit 03d78af) — only
  // /docs/v2 and /docs/image-upload remain as sub-routes under /docs/.
  const existingDocSlugs = ['v2', 'image-upload'];
  const docPages = existingDocSlugs.map((slug) => ({
    url: `${BASE_URL}/docs/${slug}`,
    lastModified: LAST_MOD,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [
    { url: `${BASE_URL}/`, lastModified: LAST_MOD, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/tools`, lastModified: LAST_MOD, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/docs`, lastModified: LAST_MOD, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/human-in-the-loop`, lastModified: LAST_MOD, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/terms`, lastModified: LAST_MOD, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: LAST_MOD, changeFrequency: 'monthly', priority: 0.3 },
    // Auth pages excluded — not content pages, dilute sitemap quality
    ...toolPages,
    ...docPages,
  ];
}
