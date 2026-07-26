import { type MetadataRoute } from 'next';
import { getAllToolSlugs } from '@/lib/seo-tools';
import { toolDocPages } from '@/lib/docs-pages';

const BASE_URL = 'https://www.agent-utils.com';

// The tool and docs registries do not expose source-backed per-page update
// dates. Omit lastmod instead of keeping one stale date for every URL.
const LAST_MOD: Date | undefined = undefined;

export default function sitemap(): MetadataRoute.Sitemap {
  const toolSlugs = getAllToolSlugs();
  const toolPages = toolSlugs.map((slug) => ({
    url: `${BASE_URL}/tools/${slug}`,
    lastModified: LAST_MOD,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const docPages = [
    {
      url: `${BASE_URL}/docs/v2`,
      lastModified: LAST_MOD,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    ...toolDocPages.map((page) => ({
      url: `${BASE_URL}${page.canonicalPath}`,
      lastModified: LAST_MOD,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];

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
