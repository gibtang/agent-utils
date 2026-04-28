import { describe, it, expect } from 'vitest';

import fs from 'fs';
import path from 'path';

interface OpenApiOp {
  requestBody?: unknown;
  parameters?: unknown[];
}

const specSource = fs.readFileSync(path.resolve(__dirname, '../app/api/docs/route.ts'), 'utf-8');
const specMatch = specSource.match(/const spec\s*=\s*({[\s\S]*?\n});/);
const spec = new Function(`return ${specMatch[1]}`)();

describe('OpenAPI spec', () => {
  it('is valid OpenAPI 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  it('has correct title', () => {
    expect(spec.info.title).toBe('AgentUtils API');
  });

  it('has production server', () => {
    expect(spec.servers[0].url).toBe('https://agentutils.dev');
  });

  it('defines ApiKeyAuth security scheme', () => {
    expect(spec.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey');
    expect(spec.components.securitySchemes.ApiKeyAuth.in).toBe('header');
    expect(spec.components.securitySchemes.ApiKeyAuth.name).toBe('x-api-key');
  });

  it('documents all 7 tool endpoints', () => {
    const pathPrefixes = [
      '/api/file-host',
      '/api/json',
      '/api/dlq',
      '/api/checkpoint',
      '/api/reader',
      '/api/shield',
      '/api/otp',
    ];
    for (const prefix of pathPrefixes) {
      const hasPath = Object.keys(spec.paths).some(p => p.startsWith(prefix));
      expect(hasPath, `Missing path: ${prefix}`).toBe(true);
    }
  });

  it('has tags for all tool groups', () => {
    const tagNames = spec.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain('File Host');
    expect(tagNames).toContain('JSON Cleaner');
    expect(tagNames).toContain('Dead Letter Queue');
    expect(tagNames).toContain('Human-in-the-Loop');
    expect(tagNames).toContain('AgentMarkdown');
    expect(tagNames).toContain('Agent Shield');
    expect(tagNames).toContain('AgentVerify OTP');
  });

  it('all POST endpoints have request bodies or parameters', () => {
    for (const [pPath, methods] of Object.entries(spec.paths)) {
      const typedMethods = methods as Record<string, OpenApiOp>;
      for (const [method, op] of Object.entries(typedMethods)) {
        if (method === 'post') {
          const hasBody = !!op.requestBody;
          const hasParams = op.parameters && op.parameters.length > 0;
          // POST should have body or params (some like file-host use multipart)
          expect(
            hasBody || hasParams || pPath.includes('retry'),
            `POST ${pPath} missing request body`
          ).toBe(true);
        }
      }
    }
  });

  it('health endpoint has no security', () => {
    expect(spec.paths['/api/health'].get.security).toEqual([]);
  });

  it('all schemas have required fields', () => {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      const s = schema as { required?: string[]; properties: Record<string, unknown> };
      if (s.required) {
        for (const field of s.required) {
          expect(s.properties[field], `Schema ${name} required field ${field} missing properties`).toBeDefined();
        }
      }
    }
  });
});
