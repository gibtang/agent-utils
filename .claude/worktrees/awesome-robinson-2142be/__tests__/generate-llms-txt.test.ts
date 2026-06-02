import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('generate-llms-txt script', () => {
  const scriptPath = path.resolve(__dirname, '../scripts/generate-llms-txt.mjs');
  const outputPath = path.resolve(__dirname, '../public/llms.txt');

  it('runs without errors', () => {
    expect(() => execSync(`node ${scriptPath}`, { cwd: path.resolve(__dirname, '..') })).not.toThrow();
  });

  it('produces a non-empty file', () => {
    execSync(`node ${scriptPath}`, { cwd: path.resolve(__dirname, '..') });
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
  });

  it('output is idempotent (running twice produces same output)', () => {
    execSync(`node ${scriptPath}`, { cwd: path.resolve(__dirname, '..') });
    const first = fs.readFileSync(outputPath, 'utf-8');
    execSync(`node ${scriptPath}`, { cwd: path.resolve(__dirname, '..') });
    const second = fs.readFileSync(outputPath, 'utf-8');
    expect(first).toBe(second);
  });
});
