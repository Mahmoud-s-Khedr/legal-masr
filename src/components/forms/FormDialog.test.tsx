import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormDialog } from './FormDialog';

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
      <FormDialog open={open} onOpenChange={change} title="تأكيد الإجراء">
        <button type="button">إلغاء</button>
        <button type="button">تأكيد</button>
      </FormDialog>
    </>
  );
}

describe('Dialog', () => {
  it('preserves focus in a draft when parent state or error content changes', () => {
    const change = vi.fn();
    const { rerender } = render(
      <FormDialog open onOpenChange={change} title="تعديل">
        <button>إلغاء</button>
        <input aria-label="مسودة" />
      </FormDialog>,
    );
    const draft = screen.getByRole('textbox', { name: 'مسودة' });
    draft.focus();
    rerender(
      <FormDialog open onOpenChange={change} title="تعديل">
        <button>إلغاء</button>
        <input aria-label="مسودة" />
        <p role="alert">تعذر الحفظ؛ أعد المحاولة</p>
      </FormDialog>,
    );
    expect(draft).toHaveFocus();
  });

  it('contains focus, closes with Escape, and returns focus to its trigger', async () => {
    const onChange = vi.fn();
    render(<DialogHarness onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'فتح' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'تأكيد الإجراء' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'إلغاء' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
