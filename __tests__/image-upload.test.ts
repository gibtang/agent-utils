import { describe, it, expect } from 'vitest';
import { validateImage, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/image-upload';

describe('validateImage', () => {
  describe('content-type', () => {
    it.each(ALLOWED_IMAGE_TYPES)('accepts %s', (type) => {
      expect(validateImage(type, 1024)).toEqual({ valid: true });
    });

    it('rejects non-image content types', () => {
      const r = validateImage('application/pdf', 1024);
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.statusCode).toBe(415);
    });

    it('rejects video content types', () => {
      const r = validateImage('video/mp4', 1024);
      expect(r.valid).toBe(false);
    });

    it('rejects empty content-type', () => {
      const r = validateImage('', 1024);
      expect(r.valid).toBe(false);
    });

    it('rejects malformed content-type with params only loosely (strips params)', () => {
      // image/png; charset=binary should be accepted after stripping params
      expect(validateImage('image/png; charset=binary', 1024)).toEqual({ valid: true });
    });
  });

  describe('size', () => {
    it('rejects zero-size files', () => {
      const r = validateImage('image/png', 0);
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.statusCode).toBe(400);
    });

    it('rejects negative size', () => {
      expect(validateImage('image/png', -1).valid).toBe(false);
    });

    it('accepts exactly the max size', () => {
      expect(validateImage('image/png', MAX_IMAGE_BYTES)).toEqual({ valid: true });
    });

    it('rejects one byte over the max size', () => {
      const r = validateImage('image/png', MAX_IMAGE_BYTES + 1);
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.statusCode).toBe(413);
    });
  });

  describe('error messages', () => {
    it('includes allowed types in the type error message', () => {
      const r = validateImage('application/pdf', 1024);
      if (!r.valid) {
        expect(r.error).toContain('image/jpeg');
        expect(r.error).toContain('image/png');
      }
    });

    it('includes max size in bytes in the size error message', () => {
      const r = validateImage('image/png', MAX_IMAGE_BYTES + 1);
      if (!r.valid) expect(r.error).toContain(String(MAX_IMAGE_BYTES));
    });
  });
});
