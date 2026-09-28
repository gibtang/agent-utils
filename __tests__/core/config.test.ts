/**
 * Core configuration — production safety contract.
 *
 * getServerConfig()/getPublicConfig() must be lazy (safe to import during
 * static builds), reject incomplete production configuration, and never
 * leak secret VALUES through error messages — missing key NAMES only.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getServerConfig, getPublicConfig, resetConfigCacheForTests } from '@/lib/core/config';

const PROD_REQUIRED = [
  'APP_URL',
  'MONGODB_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'CREDENTIAL_HASH_PEPPER',
  'SECRET_ENCRYPTION_KEY',
  'B2_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
];

const PUBLIC_REQUIRED = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

function clearAll(keys: string[]) {
  for (const k of keys) delete process.env[k];
}

function setNodeEnv(value: string) {
  (process.env as unknown as Record<string, string | undefined>).NODE_ENV = value;
}

describe('lib/core/config', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    resetConfigCacheForTests();
    saved = {};
    for (const k of [...PROD_REQUIRED, ...PUBLIC_REQUIRED]) {
      saved[k] = process.env[k];
    }
    clearAll([...PROD_REQUIRED, ...PUBLIC_REQUIRED]);
  });

  afterEach(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetConfigCacheForTests();
  });

  it('rejects production parse when a required server variable is missing, naming the key only', () => {
    setNodeEnv("production");
    for (const key of PROD_REQUIRED) {
      resetConfigCacheForTests();
      // set everything, then remove the one under test
      const probe: Record<string, string> = {
        APP_URL: 'https://agentutils.example.com',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/probe',
        FIREBASE_PROJECT_ID: 'proj',
        FIREBASE_CLIENT_EMAIL: 'svc@proj.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n',
        CREDENTIAL_HASH_PEPPER: 'pepper-value-for-probe',
        SECRET_ENCRYPTION_KEY: 'encryption-key-value-for-probe-0123456789',
        B2_KEY_ID: 'b2-key-id',
        B2_APPLICATION_KEY: 'b2-app-key-value',
        B2_BUCKET_NAME: 'b2-bucket',
      };
      for (const [k, v] of Object.entries(probe)) process.env[k] = v;
      delete process.env[key];

      let message = '';
      try {
        getServerConfig();
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
      expect(message).toContain(key);
    }
  });

  it('error messages never contain secret values', () => {
    setNodeEnv("production");
    process.env.APP_URL = 'https://agentutils.example.com';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/probe';
    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = 'BEGIN-PRIVATE-KEY-PROBE';
    process.env.B2_KEY_ID = 'probe-b2-key-id-123';
    process.env.B2_APPLICATION_KEY = 'supersecret-b2key-4e5f';
    process.env.B2_BUCKET_NAME = 'probe-b2-bucket';
    // deliberately missing CREDENTIAL_HASH_PEPPER + SECRET_ENCRYPTION_KEY

    let message = '';
    try {
      getServerConfig();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain('CREDENTIAL_HASH_PEPPER');
    expect(message).toContain('SECRET_ENCRYPTION_KEY');
    // set values must never appear — names only
    expect(message).not.toContain('supersecret-b2key-4e5f');
    expect(message).not.toContain('probe-b2-key-id-123');
    expect(message).not.toContain('BEGIN-PRIVATE-KEY-PROBE');
  });

  it('provides dev/test defaults so non-production never parses production-only values', () => {
    setNodeEnv("test");
    let cfg: { mongoUri: string } | undefined;
    expect(() => {
      cfg = getServerConfig();
    }).not.toThrow();
    expect(cfg).toBeTruthy();
    expect(typeof (cfg as { mongoUri: string }).mongoUri).toBe('string');
  });

  it('parses a complete production configuration and is memoized', () => {
    setNodeEnv("production");
    process.env.APP_URL = 'https://agentutils.example.com';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/probe';
    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n';
    process.env.CREDENTIAL_HASH_PEPPER = 'pepper-value-for-probe';
    process.env.SECRET_ENCRYPTION_KEY = 'encryption-key-value-for-probe-0123456789';
    process.env.B2_KEY_ID = 'b2-key-id';
    process.env.B2_APPLICATION_KEY = 'b2-app-key-value';
    process.env.B2_BUCKET_NAME = 'b2-bucket';

    const a = getServerConfig();
    const b = getServerConfig();
    expect(b).toBe(a); // memoized — same object identity
    expect(a.mongoUri).toBe('mongodb://127.0.0.1:27017/probe');
    expect(a.appUrl).toBe('https://agentutils.example.com');
  });

  it('getPublicConfig validates the Firebase public surface and is lazy', () => {
    setNodeEnv("production");
    let message = '';
    try {
      getPublicConfig();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    for (const key of PUBLIC_REQUIRED) expect(message).toContain(key);

    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'pub-api-key';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'proj.firebaseapp.com';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'proj';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'proj.appspot.com';
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '1234567890';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:1234567890:web:abcdef';
    const pub = getPublicConfig();
    expect(pub.firebaseProjectId).toBe('proj');
  });
});
