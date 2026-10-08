import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DraftForm } from './DraftForm';
import { FormDialog } from './FormDialog';
describe('draft submission', () => {
  it('isolates a portal child and prevents duplicate saves until failure settles', async () => {
    let reject!: () => void;
    const parent = vi.fn();
    const child = vi.fn(() =>
      new Promise<void>((_, no) => {
        reject = () => no(new Error('synthetic'));
      }).catch(() => undefined),
    );
    render(
      <DraftForm onSubmit={parent}>
        <input aria-label="Parent draft" defaultValue="retained" />
        <FormDialog open onOpenChange={() => {}} title="Child">
          <DraftForm onSubmit={child}>
            <button type="submit">Save child</button>
          </DraftForm>
        </FormDialog>
      </DraftForm>,
    );
    const save = screen.getByRole('button', { name: 'Save child' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
    reject();
    await waitFor(() => expect(save).toBeInTheDocument());
    await Promise.resolve();
    fireEvent.click(save);
    expect(child).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Parent draft')).toHaveValue('retained');
    reject();
  });
});
