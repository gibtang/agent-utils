#!/usr/bin/env node

/**
 * Regenerates public/llms.txt from the OpenAPI spec and pricing config.
 * Run: node scripts/generate-llms-txt.mjs
 *
 * Reads:
 *   - app/api/docs/route.ts  (OpenAPI spec)
 *   - lib/pricing.ts          (tier configs)
 *   - app/page.tsx            (tool list from landing page)
 *
 * Writes:
 *   - public/llms.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNamedExport(filePath, exportName) {
  const src = fs.readFileSync(path.join(ROOT, filePath), 'utf-8');

  // const spec = { ... } | const spec: Type = {
  const re = new RegExp(`(?:const|let|var)\\s+${exportName}\\s*(?::\\s*[^=]+)?\\s*=\\s*({[\\s\\S]*?\\n});`);
  const m = src.match(re);
  if (!m) throw new Error(`Could not find ${exportName} in ${filePath}`);
  // Use eval-like parsing (safe here — it's our own source)
  return (new Function(`return ${m[1]}`))();
}

function extractDefaultExportArray(filePath) {
  const src = fs.readFileSync(path.join(ROOT, filePath), 'utf-8');
  const re = /const\s+tools\s*=\s*(\[[\s\S]*?\n\]);/;
  const m = src.match(re);
  if (!m) throw new Error(`Could not find tools array in ${filePath}`);
  return (new Function(`return ${m[1]}`))();
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${bytes / (1024 * 1024 * 1024)}GB`;
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  if (bytes >= 1024) return `${bytes / 1024}KB`;
  return `${bytes}B`;
}

// ---------------------------------------------------------------------------
// Parse sources
// ---------------------------------------------------------------------------

const spec = extractNamedExport('app/api/docs/route.ts', 'spec');
const tiers = extractNamedExport('lib/pricing.ts', 'TIERS');
extractDefaultExportArray('app/page.tsx');

// ---------------------------------------------------------------------------
// Build llms.txt
// ---------------------------------------------------------------------------

const lines = [];

lines.push('# AgentUtils');
lines.push('');
lines.push('> One API key. Agent-native utilities. https://agentutils.dev');
lines.push('');

// Auth
lines.push('## Authentication');
lines.push('');
lines.push('All endpoints require `x-api-key` header with key starting with `au_`.');
lines.push('Create key at https://agentutils.dev/dashboard after signup.');
lines.push('');

// Quick start
lines.push('## Quick Start');
lines.push('');
lines.push('```');
lines.push('curl -H "x-api-key: au_YOUR_KEY" https://agentutils.dev/api/health');
lines.push('```');
lines.push('');

// Tools — iterate OpenAPI tags for order, then paths grouped by tag
lines.push('## Tools');
lines.push('');

// Build tag → paths map
const tagPaths = {};
for (const [pPath, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const tag = (op.tags || ['Other'])[0];
    if (!tagPaths[tag]) tagPaths[tag] = [];
    tagPaths[tag].push({ path: pPath, method: method.toUpperCase(), ...op });
  }
}

// Map tag name to slug for finding tier info
const tagSlugMap = {
  'File Host': 'fileHost',
'Dead Letter Queue': 'dlq',
  'Human-in-the-Loop': 'checkpoint',
  'Agent Shield': 'shield',
  'AgentVerify OTP': 'otp',
};

// Skip these tags (internal)
const skipTags = ['System', 'API Keys'];

for (const tag of spec.tags) {
  if (skipTags.includes(tag.name)) continue;

  const ops = tagPaths[tag.name] || [];
  const featureKey = tagSlugMap[tag.name];

  // Determine minimum tier
  let minTier = '';
  if (featureKey) {
    if (tiers.free.features[featureKey]) minTier = '';
    else if (tiers.pro.features[featureKey]) minTier = ' (Pro+)';
    else minTier = ' (Enterprise)';
  }

  lines.push(`### ${tag.name} — ${tag.description || ''}${minTier}`);
  lines.push(tag.description || '');

  for (const op of ops) {
    const reqBody = op.requestBody;
    let bodyHint = '';
    if (reqBody) {
      const schema = reqBody.content?.['application/json']?.schema;
      if (schema?.$ref) {
        // Use ref name
        const refName = schema.$ref.split('/').pop();
        bodyHint = formatSchemaRef(refName, spec);
      } else if (schema?.properties) {
        bodyHint = formatInlineSchema(schema);
      } else if (reqBody.content?.['multipart/form-data']?.schema?.properties?.file) {
        bodyHint = ' (multipart, field: "file")';
      }
    }

    const params = (op.parameters || []).map(p => {
      return p;
    });

    const paramStr = params
      .filter(p => p.in === 'query')
      .map(p => `${p.name}=${p.required ? 'VALUE' : 'VALUE'}`)
      .join('&');

    const pathStr = params.reduce((acc, p) => {
      if (p.in === 'path') return acc.replace(`{${p.name}}`, `{${p.name}}`);
      return acc;
    }, op.path);

    let line = `- ${op.method} ${pathStr}${paramStr ? '?' + paramStr : ''}`;
    if (op.summary) line += ` — ${op.summary}`;
    if (bodyHint) line += ` — body: ${bodyHint}`;
    lines.push(line);
  }

  lines.push('');
}

// Rate limits
lines.push('## Rate Limits');
lines.push('');
for (const [, tier] of Object.entries(tiers)) {
  const label = tier.name;
  const cpm = tier.callsPerMonth === -1 ? 'Unlimited' : `${tier.callsPerMonth.toLocaleString()} calls/mo`;
  const overage = tier.overageRate > 0 ? `, $${tier.overageRate}/call overage` : '';
  lines.push(`- ${label}: ${cpm}${overage}, ${formatBytes(tier.maxFileSize)} files, ${tier.fileRetentionHours}h retention — $${tier.price}/mo`);
}
lines.push('');

// OpenAPI spec link
lines.push('## OpenAPI Spec');
lines.push('Full machine-readable spec: https://agentutils.dev/api/docs');
lines.push('');

// Response format
lines.push('## Response Format');
lines.push('All endpoints return: `{ success: boolean, data?: any, error?: string, code?: string }`');
lines.push('');

// ---------------------------------------------------------------------------
// Helpers for schema formatting
// ---------------------------------------------------------------------------

function formatSchemaRef(refName, spec) {
  const schema = spec.components?.schemas?.[refName];
  if (!schema) return refName;
  if (schema.properties) return formatInlineSchema(schema);
  return refName;
}

function formatInlineSchema(schema) {
  const props = schema.properties || {};
  const required = schema.required || [];
  const parts = Object.entries(props).map(([name, def]) => {
    const rq = required.includes(name) ? name : `${name}?`;
    if (def.enum) return `${rq}: "${def.enum.join('|')}"`;
    if (def.type === 'string') return `${rq}: string`;
    if (def.type === 'boolean') return `${rq}: boolean`;
    if (def.type === 'integer') return `${rq}: number`;
    return `${rq}: ${def.type || 'any'}`;
  });
  return `{ ${parts.join(', ')} }`;
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outputPath = path.join(ROOT, 'public', 'llms.txt');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

console.log(`✅ Generated public/llms.txt (${lines.length} lines)`);
