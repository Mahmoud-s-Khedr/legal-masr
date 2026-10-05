import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { asAppError, errorMessage } from './errors';

describe('bridge error mapping', () => {
  it('accepts finalized attachment and finance error codes', () => {
    const error = {
      code: 'ATTACHMENT_NOT_FOUND',
      message: 'لم يتم العثور على المرفق.',
      details: null,
    };
    expect(asAppError(error)).toEqual(error);
    expect(errorMessage(error, 'fallback')).toBe('تعذر العثور على المستند. ربما أُزيل.');
  });

  it('shows known error codes in the interface language instead of the backend text', async () => {
    const error = { code: 'INVALID_PASSWORD', message: 'كلمة المرور غير صحيحة.', details: null };
    await i18n.changeLanguage('en');
    expect(errorMessage(error, 'fallback')).toBe(
      'The password is incorrect. Check it and try again.',
    );
    await i18n.changeLanguage('ar');
    expect(errorMessage(error, 'fallback')).toBe(
      'كلمة المرور غير صحيحة. تحقق منها وحاول مرة أخرى.',
    );
  });

  it('does not trust unknown failure payloads as application errors', () => {
    expect(asAppError({ code: 'DOCUMENT_NOT_FOUND', message: 'stale' })).toBeNull();
    expect(errorMessage({ message: 'untyped failure' }, 'fallback')).toBe('fallback');
  });
});
