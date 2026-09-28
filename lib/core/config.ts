/**
 * AgentUtils core configuration (foundation Task 1).
 *
 * Lazy, server-only Zod parser. Never parse at import time — static page
 * builds must not require production secrets. Error messages name MISSING
 * KEYS, never secret VALUES.
 *
 * SECURITY: this module is server-only. getPublicConfig() exposes only the
 * Firebase web SDK surface, which is public by design.
 *
 * Secret key shape notes:
 * - SECRET_ENCRYPTION_KEY: AES-256 key material for encryptSecret() (Task 2).
 *   Nonempty at parse time; strength enforced at use site.
 * - CREDENTIAL_HASH_PEPPER: HMAC-SHA-256 pepper for credential lookup hashes.
 */

import { z } from 'zod';

// Avoid importing 'server-only' package (not installed); enforce by convention:
// this file must only be imported from server code (route handlers, services).

const firebasePrivateKey = z
  .string()
  .min(1)
  .refine((v) => !v.includes('\\n') || v.includes('PRIVATE KEY'), {
    message: 'FIREBASE_PRIVATE_KEY must be the PEM private key (literal newlines or \\n escapes)',
  });

const ServerConfigSchema = z.object({
  appUrl: z.string().url().meta({ env: 'APP_URL' }),
  mongoUri: z.string().min(1).meta({ env: 'MONGODB_URI' }),
  firebaseProjectId: z.string().min(1).meta({ env: 'FIREBASE_PROJECT_ID' }),
  firebaseClientEmail: z.string().email().meta({ env: 'FIREBASE_CLIENT_EMAIL' }),
  firebasePrivateKey: firebasePrivateKey.meta({ env: 'FIREBASE_PRIVATE_KEY' }),
  credentialHashPepper: z.string().min(16).meta({ env: 'CREDENTIAL_HASH_PEPPER' }),
  secretEncryptionKey: z.string().min(16).meta({ env: 'SECRET_ENCRYPTION_KEY' }),
  b2KeyId: z.string().min(1).meta({ env: 'B2_KEY_ID' }),
  b2ApplicationKey: z.string().min(1).meta({ env: 'B2_APPLICATION_KEY' }),
  b2BucketName: z.string().min(1).meta({ env: 'B2_BUCKET_NAME' }),
  b2Endpoint: z.string().url().optional().meta({ env: 'B2_ENDPOINT' }),
});

const PublicConfigSchema = z.object({
  firebaseApiKey: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_API_KEY' }),
  firebaseAuthDomain: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN' }),
  firebaseProjectId: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' }),
  firebaseStorageBucket: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET' }),
  firebaseMessagingSenderId: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID' }),
  firebaseAppId: z.string().min(1).meta({ env: 'NEXT_PUBLIC_FIREBASE_APP_ID' }),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

const DEV_SERVER_DEFAULTS: Partial<Record<keyof ServerConfig, string>> = {
  appUrl: 'http://localhost:3000',
  mongoUri: 'mongodb://127.0.0.1:27017/agentutils_dev',
  firebaseProjectId: 'demo-agentutils',
  firebaseClientEmail: 'demo@demo-agentutils.iam.gserviceaccount.com',
  firebasePrivateKey: '-----BEGIN PRIVATE KEY-----\nDEMO\n-----END PRIVATE KEY-----\n',
  credentialHashPepper: 'dev-only-pepper-change-me-0001',
  secretEncryptionKey: 'dev-only-encryption-key-change-me-01',
  b2KeyId: 'dev-b2-key-id',
  b2ApplicationKey: 'dev-b2-application-key',
  b2BucketName: 'dev-b2-bucket',
};

const PUBLIC_CONFIG_ENV: Record<string, string> = {
  firebaseApiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  firebaseAuthDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  firebaseProjectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  firebaseStorageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  firebaseMessagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  firebaseAppId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

const SERVER_ENV: Record<keyof ServerConfig, string> = {
  appUrl: 'APP_URL',
  mongoUri: 'MONGODB_URI',
  firebaseProjectId: 'FIREBASE_PROJECT_ID',
  firebaseClientEmail: 'FIREBASE_CLIENT_EMAIL',
  firebasePrivateKey: 'FIREBASE_PRIVATE_KEY',
  credentialHashPepper: 'CREDENTIAL_HASH_PEPPER',
  secretEncryptionKey: 'SECRET_ENCRYPTION_KEY',
  b2KeyId: 'B2_KEY_ID',
  b2ApplicationKey: 'B2_APPLICATION_KEY',
  b2BucketName: 'B2_BUCKET_NAME',
  b2Endpoint: 'B2_ENDPOINT',
};

const REQUIRED_SERVER_FIELDS = [
  'appUrl',
  'mongoUri',
  'firebaseProjectId',
  'firebaseClientEmail',
  'firebasePrivateKey',
  'credentialHashPepper',
  'secretEncryptionKey',
  'b2KeyId',
  'b2ApplicationKey',
  'b2BucketName',
] as const;

function formatMissing(envNames: string[]): string {
  return `Server configuration invalid — missing or invalid required environment variables: ${[...new Set(envNames)].join(', ')}. Set these before running in production.`;
}

function parseServerConfig(): ServerConfig {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const raw: Record<string, unknown> = {};

  for (const field of REQUIRED_SERVER_FIELDS) {
    const envName = SERVER_ENV[field];
    const value = process.env[envName] ?? (isProd ? undefined : DEV_SERVER_DEFAULTS[field]);
    if (value === undefined) {
      missing.push(envName);
      continue;
    }
    raw[field] = value;
  }
  if (SERVER_ENV.b2Endpoint && process.env[SERVER_ENV.b2Endpoint]) {
    raw.b2Endpoint = process.env[SERVER_ENV.b2Endpoint];
  }

  if (missing.length > 0) throw new Error(formatMissing(missing));

  const result = ServerConfigSchema.safeParse(raw);
  if (!result.success) {
    const envNames = result.error.issues.map((i) => {
      const field = String(i.path?.[0] ?? '');
      return SERVER_ENV[field as keyof typeof SERVER_ENV] ?? field;
    });
    throw new Error(formatMissing(envNames));
  }
  return result.data;
}

let serverCache: ServerConfig | null = null;
let publicCache: PublicConfig | null = null;

/** Server configuration; lazy + memoized. Throws on incomplete production env. */
export function getServerConfig(): ServerConfig {
  if (serverCache) return serverCache;
  serverCache = parseServerConfig();
  return serverCache;
}

/** Firebase public (web SDK) configuration; lazy + memoized. */
export function getPublicConfig(): PublicConfig {
  if (publicCache) return publicCache;
  const result = PublicConfigSchema.safeParse({
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => PUBLIC_CONFIG_ENV[String(i.path?.[0])] ?? String(i.path?.[0] ?? '')))].filter(Boolean);
    throw new Error(`Public configuration invalid — missing required NEXT_PUBLIC_* variables: ${names.join(', ')}.`);
  }
  publicCache = result.data;
  return publicCache;
}

/** Test hook: clear memoized config so env changes are picked up. */
export function resetConfigCacheForTests(): void {
  serverCache = null;
  publicCache = null;
}
