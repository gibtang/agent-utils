/**
 * Reddit-style memorable key-name generator for the dashboard "new key" field.
 *
 * Pure property tests — no DB. Asserts every generated name satisfies the
 * agent-name rules (NAME_RE in lib/dashboard/keys.ts) and that output is varied.
 */
import { describe, it, expect } from 'vitest';
import { generateKeyName } from '@/lib/dashboard/keynames';

const NAME_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;

describe('generateKeyName', () => {
  it('always matches the agent-name rules (3–32 chars, lowercase, valid charset)', () => {
    for (let i = 0; i < 5000; i++) {
      const name = generateKeyName();
      expect(name).toMatch(NAME_RE);
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(32);
      expect(name).toBe(name.toLowerCase());
    }
  });

  it('contains only lowercase letters, digits, and hyphens', () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateKeyName()).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('never starts or ends with a hyphen, and never has a double hyphen', () => {
    for (let i = 0; i < 2000; i++) {
      const name = generateKeyName();
      expect(name[0]).not.toBe('-');
      expect(name.at(-1)).not.toBe('-');
      expect(name).not.toContain('--');
    }
  });

  it('produces varied output (high cardinality over many calls)', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 300; i++) samples.add(generateKeyName());
    expect(samples.size).toBeGreaterThan(100);
  });
});
