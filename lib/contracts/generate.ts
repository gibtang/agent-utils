/**
 * Shared contract generation. Both the CLI script (scripts/generate-contracts.ts)
 * and the drift test use this so the committed artifacts are compared against
 * exactly the code path that produces them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toOpenAPISpec } from '@/lib/contracts/openapi';
import { toLlmsTxt } from '@/lib/contracts/docs';
// Importing the operations module registers every operation as a side effect.
import '@/lib/connections/operations';

export function generateContracts(): { openapi: Record<string, unknown>; llmsTxt: string } {
  const openapi = toOpenAPISpec();
  const llmsTxt = toLlmsTxt();
  return { openapi, llmsTxt };
}

/** Write public/openapi.json and public/llms.txt from the live registry. */
export function writeContracts(rootDir: string): { openapiPath: string; llmsTxtPath: string } {
  const { openapi, llmsTxt } = generateContracts();
  const publicDir = path.join(rootDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  const openapiPath = path.join(publicDir, 'openapi.json');
  const llmsTxtPath = path.join(publicDir, 'llms.txt');
  writeFileSync(openapiPath, `${JSON.stringify(openapi, null, 2)}\n`, 'utf8');
  writeFileSync(llmsTxtPath, llmsTxt, 'utf8');
  return { openapiPath, llmsTxtPath };
}
