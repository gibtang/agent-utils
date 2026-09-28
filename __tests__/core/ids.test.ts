import { describe, expect, it } from 'vitest';
import { resourceId } from '@/lib/core/ids';

const prefixes = ['acct_', 'agt_', 'conn_', 'pair_', 'inbox_', 'evt_', 'claim_', 'state_', 'file_', 'link_', 'usage_', 'activity_'] as const;

describe('core ids', () => {
  it.each(prefixes)('generates a URL-safe %s resource ID', (prefix) => {
    const id = resourceId(prefix);
    expect(id.startsWith(prefix)).toBe(true);
    expect(id).toMatch(new RegExp(`^${prefix}[0-9A-HJKMNP-TV-Z]{26}$`));
  });

  it('sorts IDs by generation time', async () => {
    const first = resourceId('evt_');
    await new Promise((resolve) => setTimeout(resolve, 2));
    const later = resourceId('evt_');
    expect(later > first).toBe(true);
  });

  it('is unique during rapid generation', () => {
    const ids = Array.from({ length: 1_000 }, () => resourceId('claim_'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
