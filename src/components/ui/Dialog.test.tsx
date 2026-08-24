import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function DialogHarness({ onChange = vi.fn() }: { onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const change = (next: boolean) => {
    onChange(next);
    setOpen(next);
  };
  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => change(true)}>
        فتح
      </button>
      <Dialog open={open} onOpenChange={change} title="تأكيد الإجراء">
        <button type="button">إلغاء</button>
        <button type="button">تأكيد</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('contains focus, closes with Escape, and returns focus to its trigger', () => {
    const onChange = vi.fn();
    render(<DialogHarness onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'فتح' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'تأكيد الإجراء' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
