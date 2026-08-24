import { describe, expect, it } from 'vitest';
import { asAppError, errorMessage } from './errors';

describe('bridge error mapping', () => {
  it('accepts finalized attachment and finance error codes', () => {
    const error = {
      code: 'ATTACHMENT_NOT_FOUND',
      message: 'لم يتم العثور على المرفق.',
      details: null,
    };
    expect(asAppError(error)).toEqual(error);
    expect(errorMessage(error, 'fallback')).toBe('لم يتم العثور على المرفق.');
  });

  it('does not trust unknown failure payloads as application errors', () => {
    expect(asAppError({ code: 'DOCUMENT_NOT_FOUND', message: 'stale' })).toBeNull();
    expect(errorMessage({ message: 'untyped failure' }, 'fallback')).toBe('fallback');
  });
});
