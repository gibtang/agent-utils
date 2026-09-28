import { describe, expect, it } from 'vitest';
import { clampLimit, decodeCursor, encodeCursor } from '@/lib/core/pagination';

describe('core pagination', () => {
  it('round-trips an opaque sort tuple', () => {
    const cursor = encodeCursor({ sortKey: '2026-01-01T00:00:00.000Z', id: 'evt_01ABC' });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ sortKey: '2026-01-01T00:00:00.000Z', id: 'evt_01ABC' });
  });

  it('rejects malformed cursors as validation failures', () => {
    try {
      decodeCursor('not-a-cursor');
      throw new Error('expected malformed cursor to throw');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('validation_failed');
    }
    expect(decodeCursor(null)).toBeNull();
  });

  it('clamps limits to the configured bounds', () => {
    expect(clampLimit(undefined)).toBe(25);
    expect(clampLimit('0')).toBe(1);
    expect(clampLimit('-5')).toBe(1);
    expect(clampLimit('150')).toBe(100);
    expect(clampLimit('12')).toBe(12);
    expect(clampLimit(['12', '13'])).toBe(12);
    expect(clampLimit('nope')).toBe(25);
  });
});
