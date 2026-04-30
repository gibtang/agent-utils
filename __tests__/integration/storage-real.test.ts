/**
 * Real B2 integration tests — hits the actual Backblaze B2 API.
 * Requires B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME in .env.local
 * Uses the 'agent-utils' bucket.
 *
 * Run: npx vitest run __tests__/integration/storage-real.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { uploadFile, getFile, deleteFile } from '@/lib/storage';

// Ensure we're hitting real B2
const B2_KEY = process.env.B2_KEY_ID;
const B2_SECRET = process.env.B2_APPLICATION_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME;

describe.skipIf(!B2_KEY || !B2_SECRET || !B2_BUCKET)('B2 Real Integration', () => {
  const uploadedIds: string[] = [];

  afterAll(async () => {
    // Cleanup: delete all files uploaded during tests
    for (const id of uploadedIds) {
      await deleteFile(id).catch(() => {});
    }
  });

  describe('uploadFile', () => {
    it('uploads a small text file to B2', async () => {
      const content = Buffer.from('Hello B2 integration test');
      const result = await uploadFile(content, 'test-upload.txt', 'text/plain', 1);

      expect(result.id).toBeDefined();
      expect(result.filename).toBe('test-upload.txt');
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(content.length);
      expect(result.url).toContain('/api/file-host/');
      expect(result.expiresAt).toBeDefined();

      uploadedIds.push(result.id);
    });

    it('uploads a JSON file', async () => {
      const payload = JSON.stringify({ test: true, nested: { value: 42 } });
      const content = Buffer.from(payload);
      const result = await uploadFile(content, 'data.json', 'application/json', 1);

      expect(result.id).toBeDefined();
      expect(result.contentType).toBe('application/json');
      expect(result.size).toBe(content.length);

      uploadedIds.push(result.id);
    });

    it('uploads a binary file (PNG header bytes)', async () => {
      // Minimal valid PNG header
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]);
      const result = await uploadFile(pngHeader, 'test.png', 'image/png', 1);

      expect(result.id).toBeDefined();
      expect(result.contentType).toBe('image/png');
      expect(result.size).toBe(16);

      uploadedIds.push(result.id);
    });

    it('respects retention hours in expiresAt', async () => {
      const before = Date.now();
      const result = await uploadFile(Buffer.from('ttl-test'), 'ttl.txt', 'text/plain', 3);

      const diff = new Date(result.expiresAt).getTime() - before;
      // ~3 hours (allow 2 min tolerance)
      expect(diff).toBeGreaterThan(10_700_000);
      expect(diff).toBeLessThan(11_000_000);

      uploadedIds.push(result.id);
    });
  });

  describe('getFile', () => {
    let fileId: string;
    const originalContent = 'Content for retrieval test';

    beforeAll(async () => {
      const result = await uploadFile(Buffer.from(originalContent), 'retrieve.txt', 'text/plain', 1);
      fileId = result.id;
      uploadedIds.push(fileId);
    });

    it('retrieves an uploaded file with correct content', async () => {
      const file = await getFile(fileId);

      expect(file).not.toBeNull();
      expect(file!.data.toString()).toBe(originalContent);
      expect(file!.contentType).toBe('text/plain');
      expect(file!.metadata.originalname).toBe('retrieve.txt');
    });

    it('returns null for a non-existent file', async () => {
      const file = await getFile('nonexistent-id-12345');
      expect(file).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('deletes an uploaded file', async () => {
      const result = await uploadFile(Buffer.from('to-delete'), 'delete-me.txt', 'text/plain', 1);
      uploadedIds.push(result.id); // fallback cleanup

      const deleted = await deleteFile(result.id);
      expect(deleted).toBe(true);

      // Verify file is gone
      const file = await getFile(result.id);
      expect(file).toBeNull();
    });

    it('handles non-existent key gracefully (B2 delete is idempotent)', async () => {
      // B2 S3 returns success for non-existent keys (idempotent delete)
      const deleted = await deleteFile('nonexistent-id-99999');
      expect(typeof deleted).toBe('boolean');
    });
  });

  describe('round-trip: upload → get → delete', () => {
    it('completes full lifecycle for a larger payload', async () => {
      // ~100KB of data
      const content = Buffer.alloc(100 * 1024, 'A');
      const uploaded = await uploadFile(content, 'large.bin', 'application/octet-stream', 1);
      expect(uploaded.size).toBe(100 * 1024);

      const retrieved = await getFile(uploaded.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.data.length).toBe(100 * 1024);
      expect(retrieved!.data.equals(content)).toBe(true);

      const deleted = await deleteFile(uploaded.id);
      expect(deleted).toBe(true);

      const gone = await getFile(uploaded.id);
      expect(gone).toBeNull();
    });
  });
});
