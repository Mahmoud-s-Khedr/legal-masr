import { describe, expect, it } from 'vitest';
import ar from './ar/common.json';
import en from './en/common.json';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n catalogs', () => {
  it('exposes the same translated keys in Arabic and English', () => {
    expect(leafKeys(ar).sort()).toEqual(leafKeys(en).sort());
  });
});
