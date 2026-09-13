import { Errors } from './errors';

export type Cursor = { sortKey: string; id: string };
export function encodeCursor(cursor: Cursor): string { return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url'); }
export function decodeCursor(cursor: string | null | undefined): Cursor | null {
  if (!cursor) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || typeof (value as Cursor).sortKey !== 'string' || typeof (value as Cursor).id !== 'string') throw new Error();
    return value as Cursor;
  } catch { throw Errors.validationFailed({ message: 'The pagination cursor is invalid.' }); }
}
export function clampLimit(raw: string | string[] | null | undefined, defaultLimit = 25, maxLimit = 100): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return defaultLimit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, parsed));
}
