import { describe, expect, it } from 'vitest';
import { failure, success } from '@/lib/core/envelope';
import { Errors } from '@/lib/core/errors';

describe('core response envelopes', () => {
  it('wraps successful data with the supplied request ID', () => {
    expect(success({ id: 'acct_1' }, 'req_1', { status: 201 })).toEqual({ status: 201, body: { data: { id: 'acct_1' }, request_id: 'req_1' } });
  });

  it('serializes domain errors at their public HTTP status', () => {
    expect(failure(Errors.notFound(), 'req_2')).toEqual({ status: 404, body: { error: { code: 'not_found', message: 'The requested resource was not found.', data_preserved: true, retry_safe: false, next_action: 'Check the resource identifier and try again.', request_id: 'req_2' } } });
  });
});
