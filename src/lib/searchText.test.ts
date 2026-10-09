import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearchText, phoneDigits } from './searchText';

describe('normalizeSearchText', () => {
  it('folds the spelling variants lawyers type without noticing', () => {
    expect(normalizeSearchText('أحمد')).toBe(normalizeSearchText('احمد'));
    expect(normalizeSearchText('إبراهيم')).toBe(normalizeSearchText('ابراهيم'));
    expect(normalizeSearchText('مصطفى')).toBe(normalizeSearchText('مصطفي'));
    expect(normalizeSearchText('فاطمة')).toBe(normalizeSearchText('فاطمه'));
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد');
    expect(normalizeSearchText('محـــمد')).toBe('محمد');
    expect(normalizeSearchText('  Ahmed   ALI ')).toBe('ahmed ali');
    expect(normalizeSearchText('٢٠٢٦/١٥')).toBe('2026/15');
  });

  it('keeps different names different', () => {
    expect(normalizeSearchText('أحمد')).not.toBe(normalizeSearchText('حمد'));
  });
});

describe('matchesSearch', () => {
  it('matches names, numbers and phones however they were typed', () => {
    expect(matchesSearch('أحمد محمود علي 1', 'احمد')).toBe(true);
    expect(matchesSearch('2026/15 — مصطفى', '٢٠٢٦/١٥')).toBe(true);
    expect(matchesSearch('سارة 0122 333 4444', '0122333')).toBe(true);
    expect(matchesSearch('anything', '')).toBe(true);
  });

  it('does not match unrelated text or too-short digit runs', () => {
    expect(matchesSearch('أحمد محمود علي', 'سامي')).toBe(false);
    expect(matchesSearch('سارة 0122 333 4444', '9 9')).toBe(false);
  });

  it('reads phone digits from any script', () => {
    expect(phoneDigits('٠١٢٢-٣٣٣ 4444')).toBe('01223334444');
  });
});
