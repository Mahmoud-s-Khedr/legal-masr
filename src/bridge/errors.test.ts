import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { actionableErrorMessage, asAppError, errorMessage } from './errors';

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

  describe('actionableErrorMessage for save dialogs', () => {
    const typed = (code: string) => ({ code, message: 'backend text', details: null });

    it('explains a specific, fixable failure in the interface language', async () => {
      await i18n.changeLanguage('ar');
      expect(actionableErrorMessage(typed('CLIENT_NUMBER_TAKEN'), 'تعذر حفظ الموكل')).toBe(
        'رقم الموكل هذا مستخدم لموكل آخر. اكتب رقمًا مختلفًا ثم احفظ.',
      );
      await i18n.changeLanguage('en');
      expect(actionableErrorMessage(typed('CASE_NUMBER_TAKEN'), 'Could not save')).toBe(
        'This case number is already used by another case. Enter a different number and save again.',
      );
      await i18n.changeLanguage('ar');
    });

    it('keeps the dialog wording for the catch-all failure and for unrecognised payloads', () => {
      expect(actionableErrorMessage(typed('OPERATION_FAILED'), 'تعذر حفظ الجلسة')).toBe(
        'تعذر حفظ الجلسة',
      );
      expect(actionableErrorMessage(new Error('boom'), 'تعذر حفظ الجلسة')).toBe('تعذر حفظ الجلسة');
      // A raw runtime string must never be shown as if it were a message for the lawyer.
      expect(actionableErrorMessage('invalid args `input`', 'تعذر حفظ الجلسة')).toBe(
        'تعذر حفظ الجلسة',
      );
      expect(actionableErrorMessage(undefined, 'تعذر حفظ الجلسة')).toBe('تعذر حفظ الجلسة');
    });
  });
});
