import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityMultiPicker } from './EntityPicker';
import '../../i18n';
describe('entity picks', () => {
  it('searches and selects IDs with the keyboard', async () => {
    const change = vi.fn();
    render(
      <EntityMultiPicker
        items={[{ value: 'a', label: 'أحمد', searchText: 'CL-1 0100000' }]}
        value={[]}
        onValueChange={change}
        aria-label="Clients"
      />,
    );
    const input = screen.getByRole('combobox');
    act(() => input.focus());
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '0100000' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await screen.findByRole('option', { name: 'أحمد' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith(['a']);
  });
});
it('shows failure feedback without duplicate announcements and does not present loading as empty', async () => {
  const { rerender } = render(
    <EntityMultiPicker
      items={[]}
      value={[]}
      onValueChange={vi.fn()}
      loading
      aria-label="Clients"
    />,
  );
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(await screen.findByRole('status')).toBeVisible();
  expect(screen.queryByText('لا توجد نتائج.')).not.toBeInTheDocument();
  rerender(
    <EntityMultiPicker
      items={[]}
      value={[]}
      onValueChange={vi.fn()}
      error="DEMO failed read"
      aria-label="Clients"
    />,
  );
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('alert')).toHaveTextContent('DEMO failed read');
});
