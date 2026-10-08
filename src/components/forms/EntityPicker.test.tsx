import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityMultiPicker, EntityPicker } from './EntityPicker';
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

it('keeps chosen clients when Escape is pressed with the list closed', () => {
  const change = vi.fn();
  render(
    <EntityMultiPicker
      items={[{ value: 'a', label: 'أحمد' }]}
      value={['a']}
      onValueChange={change}
      aria-label="Clients"
    />,
  );
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'Escape' });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText('أحمد')).toBeInTheDocument();
});

it('keeps the chosen case when Escape is pressed with the list closed', () => {
  const change = vi.fn();
  render(
    <EntityPicker
      items={[{ value: 'case-1', label: '2026/15 — أحمد' }]}
      value="case-1"
      onValueChange={change}
      aria-label="Case"
    />,
  );
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue('2026/15 — أحمد');
});

it('finds a client typed without hamza and says so in the picker language when nothing matches', async () => {
  render(
    <EntityPicker
      items={[{ value: 'a', label: 'أحمد محمود' }]}
      onValueChange={vi.fn()}
      emptyText="لا توجد قضايا مطابقة"
      aria-label="Client"
    />,
  );
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.click(input);
  fireEvent.change(input, { target: { value: 'احمد' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(await screen.findByRole('option', { name: 'أحمد محمود' })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'سامي' } });
  expect(await screen.findByText('لا توجد قضايا مطابقة')).toBeInTheDocument();
});
