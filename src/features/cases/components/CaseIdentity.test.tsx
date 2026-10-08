import { render } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { OfficialReference } from './CaseIdentity';

// The component wraps the number in bidi isolates; compare the visible text.
const visible = (container: HTMLElement) => (container.textContent ?? '').replace(/[⁦-⁩]/g, '');

beforeEach(async () => {
  await i18n.changeLanguage('ar');
});

it.each([
  [{ number: '447' }, 'رقم 447'],
  [{ number: '447', year: 2026 }, 'رقم 447 لسنة 2026'],
  [{ number: '1234', judicialYear: 89 }, 'رقم 1234 لسنة 89 قضائية'],
  [{ number: '1234', year: 2026, judicialYear: 89 }, 'رقم 1234 لسنة 2026 (89 قضائية)'],
])('writes the court reference the way Egyptian filings do (%j)', (props, expected) => {
  const { container } = render(<OfficialReference {...props} />);
  expect(visible(container)).toBe(expected);
});

it('writes the judicial reference in English without implying a calendar year', async () => {
  await i18n.changeLanguage('en');
  const { container } = render(<OfficialReference number="1234" judicialYear={89} />);
  expect(visible(container)).toBe('No. 1234 of judicial year 89');
  await i18n.changeLanguage('ar');
});

it('treats a missing or null year as no year', () => {
  const { container } = render(<OfficialReference number="9" year={null} judicialYear={null} />);
  expect(visible(container)).toBe('رقم 9');
});
