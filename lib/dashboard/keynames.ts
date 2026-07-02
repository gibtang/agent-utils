/**
 * AgentUtils — Reddit-style memorable key-name generator.
 *
 * Produces lowercase, hyphenated names like "formal-bat-432" for the dashboard
 * "new key" field. Every output satisfies the agent-name rules enforced by
 * lib/dashboard/keys.ts (NAME_RE): 3–32 chars, starts with a lowercase letter,
 * only [a-z0-9-].
 *
 * Pure + synchronous — safe to call from client or server. No randomness is
 * cryptographically meaningful; it exists only to pick a memorable label.
 */

// Curated, inoffensive, ≤9-char words. Keeping them short guarantees every
// combination stays well under the 32-char ceiling.
const ADJECTIVES = [
  'amber', 'azure', 'bold', 'brave', 'calm', 'copper', 'coral', 'cosmic',
  'crisp', 'dapper', 'eager', 'formal', 'frosty', 'fuzzy', 'gentle',
  'glossy', 'golden', 'happy', 'jade', 'jolly', 'keen', 'lazy', 'loyal',
  'lucky', 'mighty', 'minty', 'merry', 'nimble', 'noble', 'peachy', 'plucky',
  'proud', 'quiet', 'quirky', 'rapid', 'sleek', 'sharp', 'silver', 'snappy',
  'snazzy', 'spiffy', 'stellar', 'sunny', 'suave',
  'swift', 'tidy', 'ultra', 'vivid', 'wacky', 'witty', 'zesty',
];

const NOUNS = [
  'aspen', 'badger', 'bat', 'beacon', 'bear', 'beaver', 'birch', 'bison',
  'camel', 'candle', 'cedar', 'comet', 'cougar', 'dolphin', 'donkey',
  'dune', 'eagle', 'ember', 'ferret', 'finch', 'fox', 'galaxy', 'gecko',
  'glacier', 'harbor', 'hare', 'hawk', 'heron', 'ibis', 'island',
  'jaguar', 'koala', 'lagoon', 'lemur', 'llama', 'lynx', 'manta', 'maple',
  'meadow', 'meteor', 'moose', 'nebula', 'ocean', 'okapi', 'orbit', 'otter',
  'owl', 'panda', 'planet', 'prism', 'puffin', 'quail', 'raccoon', 'raven',
  'river', 'robin', 'rocket', 'salmon', 'shark', 'summit', 'swan', 'tapir',
  'tiger', 'toad', 'viper', 'walrus', 'willow', 'wolf', 'yak', 'zebra',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate one memorable key name. Shapes vary for interest:
 *  - ~65% adjective-noun-number   (e.g. "formal-bat-432")
 *  - ~20% adjective-noun          (e.g. "brave-otter")
 *  - ~15% noun-noun-number        (e.g. "fox-comet-71")
 */
export function generateKeyName(): string {
  const roll = Math.random();
  let name: string;
  if (roll < 0.65) {
    name = `${pick(ADJECTIVES)}-${pick(NOUNS)}-${randomInt(1, 9999)}`;
  } else if (roll < 0.85) {
    name = `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
  } else {
    name = `${pick(NOUNS)}-${pick(NOUNS)}-${randomInt(1, 9999)}`;
  }
  // Safety net for the (impossible-with-these-lists) over-long combo.
  if (name.length > 32) name = name.slice(0, 32).replace(/-+$/, '');
  return name;
}
