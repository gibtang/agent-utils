import { describe, expect, it } from 'vitest';
import { DomainError, Errors, ERROR_CATALOGUE } from '@/lib/core/errors';

describe('core errors', () => {
  it.each(Object.entries(ERROR_CATALOGUE))('%s has its stable public contract', (code, spec) => {
    const error = Errors[spec.factory]();
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.http).toBe(spec.http);
    expect(error.message).toBe(spec.message);
    expect(error.message).not.toMatch(/stack|exception|mongoose|internal/i);
    expect(error.dataPreserved).toBe(spec.dataPreserved);
    expect(error.retrySafe).toBe(spec.retrySafe);
    expect(error.nextAction).toBe(spec.nextAction);
    expect(error.nextAction.length).toBeGreaterThan(5);
    expect(error.toBody('req_123')).toEqual({ error: { code, message: spec.message, data_preserved: spec.dataPreserved, retry_safe: spec.retrySafe, next_action: spec.nextAction, request_id: 'req_123' } });
  });

  it('supports message and details overrides without changing its stable code', () => {
    const error = Errors.validationFailed({ message: 'Email is required', details: { field: 'email' } });
    expect(error.code).toBe('validation_failed');
    expect(error.message).toBe('Email is required');
    expect(error.details).toEqual({ field: 'email' });
  });
});
