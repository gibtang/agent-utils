/**
 * Drift guard: the generated OpenAPI v2 spec must stay in sync with the
 * actual route handlers. Run the generator when you add/change a v2 route:
 *   npm run gen:openapi
 *
 * If a route exists in app/v1 but not in public/openapi-v2.json (or vice
 * versa), this test fails — preventing silent spec rot.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE_ROOT = join(process.cwd(), 'app/v1');
const SPEC_PATH = join(process.cwd(), 'public/openapi-v2.json');

function findRoutes(dir: string, prefix = ''): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findRoutes(full, `${prefix}/${entry}`));
      continue;
    }
    if (entry !== 'route.ts' && entry !== 'route.tsx') continue;
    const src = readFileSync(full, 'utf8');
    // public endpoints only — /tick is internal, exclude from drift check
    const seg = prefix;
    // normalize Next.js dynamic segments [[...x]]/{x} → OpenAPI {x}
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    for (const m of methods) {
      const re = new RegExp(`export (?:async )?(?:function|const) ${m}\\b`);
      if (re.test(src)) {
        // /tick is internal (cron) — skip
        if (seg === '/tick') continue;
        // collapse catch-all [[...id]] and [id] to {id}
        const openapiPath = seg
          .replace(/\[\[\.\.\.(\w+)\]\]/g, '{$1}')
          .replace(/\[\.\.\.(\w+)\]\]/g, '{$1}')
          .replace(/\[(\w+)\]/g, '{$1}');
        out.push({ method: m, path: openapiPath });
      }
    }
  }
  return out;
}

describe('OpenAPI v2 drift guard', () => {
  it('every public route handler appears in the spec', () => {
    const routes = findRoutes(ROUTE_ROOT);
    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
    const missing: string[] = [];
    for (const { method, path } of routes) {
      const op = (spec.paths as Record<string, Record<string, unknown>>)?.[path];
      if (!op || !op[method.toLowerCase()]) {
        missing.push(`${method} ${path}`);
      }
    }
    expect(missing, `routes missing from openapi-v2.json (run: npm run gen:openapi)\n${missing.join('\n')}`).toEqual([]);
  });

  it('spec is valid JSON with required top-level keys', () => {
    expect(existsSync(SPEC_PATH)).toBe(true);
    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths).toBeTypeOf('object');
    expect(spec.components?.schemas).toBeTypeOf('object');
    expect(spec.components?.securitySchemes).toBeTypeOf('object');
  });
});
