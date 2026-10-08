import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', () => ({
  bridge: { caseList: vi.fn(), caseGet: vi.fn(), hearingList: vi.fn() },
}));
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { CreatableCombobox } from './CreatableCombobox';

beforeEach(async () => {
  vi.mocked(bridge.caseList).mockResolvedValue([]);
  await i18n.changeLanguage('ar');
});

function renderField(onChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreatableCombobox
        suggestion="legalCapacity"
        aria-label="الصفة"
        value=""
        onChange={onChange}
      />
    </QueryClientProvider>,
  );
  return onChange;
}

it('offers the usual legal capacities before the office has typed any', async () => {
  const onChange = renderField();
  const input = screen.getByLabelText('الصفة');
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'مدعى عليه' }));
  expect(onChange.mock.lastCall?.[0].target.value).toBe('مدعى عليه');
});

it('still accepts a capacity that is not on the list', () => {
  const onChange = renderField();
  fireEvent.change(screen.getByLabelText('الصفة'), { target: { value: 'ضامن متضامن' } });
  expect(onChange.mock.lastCall?.[0].target.value).toBe('ضامن متضامن');
});
