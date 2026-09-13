import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateContracts } from '@/lib/contracts/generate';

const root = path.resolve(__dirname, '../..');

function committed(name: string): string {
  return readFileSync(path.join(root, 'public', name), 'utf8');
}

describe('generated contract artifacts', () => {
  it('openapi.json in the repo matches in-process generation (no drift)', () => {
    const { openapi } = generateContracts();
    expect(JSON.parse(committed('openapi.json'))).toEqual(openapi);
  });

  it('llms.txt in the repo matches in-process generation (no drift)', () => {
    const { llmsTxt } = generateContracts();
    expect(committed('llms.txt')).toBe(llmsTxt);
  });
});
