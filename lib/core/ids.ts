/** URL-safe, time-sortable resource identifiers. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(milliseconds: number): string {
  let value = milliseconds;
  let encoded = '';
  for (let index = TIME_LENGTH - 1; index >= 0; index -= 1) {
    encoded = ALPHABET[value % ALPHABET.length] + encoded;
    value = Math.floor(value / ALPHABET.length);
  }
  return encoded;
}

function randomSuffix(): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

/** A ULID-shaped value that sorts chronologically before its random suffix. */
export function sortableId(now = Date.now()): string {
  return `${encodeTime(now)}${randomSuffix()}`;
}

/** Generate a prefixed, URL-safe identifier such as `acct_01...`. */
export function resourceId(prefix: string): string {
  return `${prefix}${sortableId()}`;
}
