import { NextRequest } from 'next/server';
import { validateApiKey, errorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return errorResponse(authResult);

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return successResponse({ error: 'Missing "url" query parameter' }, 400);
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return successResponse({ error: 'Invalid URL. Must be http:// or https://' }, 400);
    }

    // Fetch the page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AgentUtils/1.0 (https://agentutils.dev)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return successResponse({
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`
      }, 400);
    }

    const html = await response.text();

    // Parse with Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return successResponse({
        error: 'Could not extract article content from this page',
        url,
      }, 400);
    }

    // Convert to markdown
    const markdown = turndown.turndown(article.content || '');

    // Calculate token estimate (~4 chars per token)
    const estimatedTokens = Math.ceil(markdown.length / 4);

    return successResponse({
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      siteName: article.siteName,
      url,
      markdown,
      estimatedTokens,
      length: markdown.length,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return successResponse({ error: 'Request timed out (15s)' }, 408);
    }
    console.error('Reader error:', err);
    return successResponse({ error: 'Failed to read URL' }, 500);
  }
}
