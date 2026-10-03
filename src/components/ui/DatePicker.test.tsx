import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('selects a calendar date as a timezone-free ISO value without a native date input', () => {
    const onChange = vi.fn();
    render(<DatePicker aria-label="التاريخ" value="2026-10-22" onChange={onChange} />);

    const input = screen.getByLabelText('التاريخ');
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'فتح التقويم' }));
    expect(screen.getByRole('dialog', { name: 'اختيار التاريخ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '23' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2026-10-23' }) }),
    );
  });

  it('leaves an invalid manually entered value for the existing form validation to reject', () => {
    const onChange = vi.fn();
    render(<DatePicker aria-label="التاريخ" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('التاريخ'), { target: { value: '2026-22-10' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2026-22-10' }) }),
    );
  });
});
