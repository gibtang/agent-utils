import { describe, it, expect } from 'vitest';
import {
  validateImage,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '@/lib/image-upload';

describe('validateImage', () => {
  describe('allowed formats', () => {
    it.each(ALLOWED_IMAGE_TYPES)('accepts %s under the size limit', (type) => {
      expect(validateImage(type, 1024)).toEqual({ valid: true });
    });

    it('accepts a content-type with params (e.g. "; charset=binary")', () => {
      expect(validateImage('image/png; charset=binary', 1024)).toEqual({ valid: true });
    });

    it('is case-insensitive on the content type', () => {
      expect(validateImage('IMAGE/AVIF', 1024)).toEqual({ valid: true });
    });
  });

  describe('newly added formats', () => {
    it('accepts AVIF', () => {
      expect(validateImage('image/avif', 2048)).toEqual({ valid: true });
    });

    it('accepts SVG', () => {
      expect(validateImage('image/svg+xml', 512)).toEqual({ valid: true });
    });
  });

  describe('rejected formats', () => {
    it.each([
      'application/pdf',
      'image/heic',
      'image/tiff',
      'image/bmp',
      'video/mp4',
      'text/html',
    ])('rejects %s with 415', (type) => {
      const result = validateImage(type, 1024);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(415);
    });
  });

  describe('size limits', () => {
    it('rejects an empty payload with 400', () => {
      const result = validateImage('image/png', 0);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });

    it('rejects a negative size with 400', () => {
      const result = validateImage('image/png', -1);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(400);
    });

    it(`rejects payloads over ${MAX_IMAGE_BYTES} bytes with 413`, () => {
      const result = validateImage('image/png', MAX_IMAGE_BYTES + 1);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.statusCode).toBe(413);
    });

    it('accepts a payload exactly at the size limit', () => {
      expect(validateImage('image/png', MAX_IMAGE_BYTES)).toEqual({ valid: true });
    });
  });
});
