import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { poaLabel, poaOption, poaTitle } from './poaOptions';

const plain = (value: string) => value.replace(/[⁦-⁩]/g, '');

afterEach(() => i18n.changeLanguage('ar'));

describe('power-of-attorney labels', () => {
  it('prefixes the plain internal number with what it is, in Arabic', async () => {
    await i18n.changeLanguage('ar');
    expect(plain(poaTitle({ internalSequence: '1' }))).toBe('توكيل 1');
    expect(
      plain(poaLabel({ internalSequence: '1', officialNumber: '12134', issueYear: 2026 })),
    ).toBe('توكيل 1 · رقم 12134 لسنة 2026');
  });

  it('works in English and tolerates a missing official number or year', async () => {
    await i18n.changeLanguage('en');
    expect(plain(poaLabel({ internalSequence: 'TA-9' }))).toBe('POA TA-9');
    expect(plain(poaLabel({ internalSequence: '1', officialNumber: '55' }))).toBe('POA 1 · No. 55');
    expect(plain(poaLabel({ internalSequence: '1', officialNumber: '55', issueYear: 2026 }))).toBe(
      'POA 1 · No. 55 of 2026',
    );
  });

  it('keeps the stored number untouched and searchable in a picker option', async () => {
    await i18n.changeLanguage('ar');
    const option = poaOption({
      id: 'p',
      internalSequence: 'TA-١',
      officialNumber: '12134',
      issueYear: 2026,
      archivedAt: null,
      clientNames: ['موكل فيك'],
      clientIds: ['c'],
    });
    expect(option.searchText).toBe('TA-١ 12134');
    expect(plain(String(option.label))).toBe('توكيل TA-١ · رقم 12134 لسنة 2026 · موكل فيك');
    expect(option.disabled).toBe(false);
  });
});
