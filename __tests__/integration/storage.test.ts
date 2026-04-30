import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../helpers/mongodb';
import { NextRequest } from 'next/server';

// ── S3 Mock ───────────────────────────────────────────────────────────────

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function(this: { send: (...a: unknown[]) => unknown }) {
    this.send = (...args: unknown[]) => mockSend(...args);
  }),
  PutObjectCommand: vi.fn().mockImplementation(function(this: unknown, input: unknown) { Object.assign(this, input); }),
  GetObjectCommand: vi.fn().mockImplementation(function(this: unknown, input: unknown) { Object.assign(this, input); }),
  DeleteObjectCommand: vi.fn().mockImplementation(function(this: unknown, input: unknown) { Object.assign(this, input); }),
}));

// Set required env vars
process.env.B2_KEY_ID = 'test-key-id';
process.env.B2_APPLICATION_KEY = 'test-app-key';
process.env.B2_BUCKET_NAME = 'test-bucket';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Storage Integration (S3 SDK-verified mocks)', () => {
  let uploadFile: typeof import('@/lib/storage').uploadFile;
  let getFile: typeof import('@/lib/storage').getFile;
  let deleteFile: typeof import('@/lib/storage').deleteFile;

  beforeAll(async () => {
    const storage = await import('@/lib/storage');
    uploadFile = storage.uploadFile;
    getFile = storage.getFile;
    deleteFile = storage.deleteFile;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('sends PutObjectCommand with correct parameters', async () => {
      mockSend.mockResolvedValue({});

      const result = await uploadFile(
        Buffer.from('hello world'),
        'test.txt',
        'text/plain',
        2,
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe('test-bucket');
      expect(command.Body).toBeInstanceOf(Buffer);
      expect(command.ContentType).toBe('text/plain');
      expect(command.Metadata.originalname).toBe('test.txt');

      expect(result.id).toBeDefined();
      expect(result.filename).toBe('test.txt');
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(11);
      expect(result.url).toContain('/api/file-host/');
    });

    it('calculates expiresAt from retentionHours', async () => {
      mockSend.mockResolvedValue({});
      const before = Date.now();

      const result = await uploadFile(Buffer.from('x'), 'f.txt', 'text/plain', 2);

      const diff = new Date(result.expiresAt).getTime() - before;
      expect(diff).toBeGreaterThan(7100_000); // ~2 hours
      expect(diff).toBeLessThan(7300_000);
    });

    it('defaults retentionHours to 1', async () => {
      mockSend.mockResolvedValue({});
      const before = Date.now();

      const result = await uploadFile(Buffer.from('x'), 'f.txt', 'text/plain');

      const diff = new Date(result.expiresAt).getTime() - before;
      expect(diff).toBeGreaterThan(3500_000); // ~1 hour
      expect(diff).toBeLessThan(3700_000);
    });

    // NOTE: env vars are captured at module load time, so runtime deletion
    // has no effect. The getS3Client() guard is tested implicitly — if the
    // env vars were missing at import, the mock S3Client would never be called.
  });

  describe('getFile', () => {
    it('sends GetObjectCommand and returns parsed response', async () => {
      const chunks = [Buffer.from('hel'), Buffer.from('lo')];
      const asyncIterable = (async function* () { yield* chunks; })();

      mockSend.mockResolvedValue({
        Body: asyncIterable,
        ContentType: 'text/plain',
        Metadata: { originalname: 'test.txt', uploadedat: new Date().toISOString(), expiresat: new Date(Date.now() + 3600000).toISOString() },
      });

      const result = await getFile('some-id');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe('test-bucket');
      expect(command.Key).toBe('some-id');

      expect(result).toBeDefined();
      expect(result!.data.toString()).toBe('hello');
      expect(result!.contentType).toBe('text/plain');
    });

    it('returns null when Body is missing', async () => {
      mockSend.mockResolvedValue({ Body: null });
      const result = await getFile('missing');
      expect(result).toBeNull();
    });

    it('returns null for expired files', async () => {
      const asyncIterable = (async function* () { yield Buffer.from('old'); })();
      mockSend.mockResolvedValue({
        Body: asyncIterable,
        ContentType: 'text/plain',
        Metadata: { expiresat: new Date(Date.now() - 1000).toISOString() },
      });

      const result = await getFile('expired-id');
      expect(result).toBeNull();
    });

    it('returns null on S3 error', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchKey'));
      const result = await getFile('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('sends DeleteObjectCommand and returns true on success', async () => {
      mockSend.mockResolvedValue({});

      const result = await deleteFile('some-id');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe('test-bucket');
      expect(command.Key).toBe('some-id');
      expect(result).toBe(true);
    });

    it('returns false on S3 error', async () => {
      mockSend.mockRejectedValue(new Error('AccessDenied'));
      const result = await deleteFile('protected');
      expect(result).toBe(false);
    });
  });
});
