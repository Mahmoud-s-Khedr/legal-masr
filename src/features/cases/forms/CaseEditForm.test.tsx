import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { CaseEditForm } from './CaseEditForm';

const stored = { ...fixtures.caseItem, filedOn: '2026-03-04', closedOn: '2026-09-15' };

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  renderWorkflow(<CaseEditForm caseDto={stored} busy={false} onSubmit={onSubmit} />);
  return onSubmit;
}

it('shows the stored filing and closing dates when the case is opened for editing', () => {
  renderForm();
  expect(screen.getByLabelText('تاريخ القيد')).toHaveValue('04/03/2026');
  expect(screen.getByLabelText('تاريخ الانتهاء')).toHaveValue('15/09/2026');
});

it('keeps both stored dates, unchanged, when saved untouched', async () => {
  const onSubmit = renderForm();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ filedOn: '2026-03-04', closedOn: '2026-09-15' }),
  );
});

it('clears a date only when the user empties it, and leaves the other intact', async () => {
  const onSubmit = renderForm();
  fireEvent.change(screen.getByLabelText('تاريخ الانتهاء'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const values = onSubmit.mock.calls[0][0];
  expect(values.filedOn).toBe('2026-03-04');
  expect(values.closedOn).toBeUndefined();
});

it('stores a typed day-first date as a timezone-free ISO date', async () => {
  const onSubmit = renderForm();
  fireEvent.change(screen.getByLabelText('تاريخ القيد'), { target: { value: '٢٥/١٢/٢٠٢٥' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0].filedOn).toBe('2025-12-25');
});

it('accepts a short judicial year such as 89 and saves it separately from the case year', async () => {
  const onSubmit = renderForm();
  fireEvent.change(screen.getByLabelText('السنة القضائية'), { target: { value: '89' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const values = onSubmit.mock.calls[0][0];
  expect(values.judicialYear).toBe(89);
  expect(values.officialYear).toBe(stored.officialYear ?? undefined);
});

it('shows the stored judicial year when a case is opened for editing', () => {
  renderWorkflow(
    <CaseEditForm caseDto={{ ...stored, judicialYear: 89 }} busy={false} onSubmit={vi.fn()} />,
  );
  expect(screen.getByLabelText('السنة القضائية')).toHaveValue(89);
});

it.each(['0', '10000', '-3'])(
  'rejects the judicial year %s without submitting and keeps the draft',
  async (bad) => {
    const onSubmit = renderForm();
    const field = screen.getByLabelText('السنة القضائية');
    fireEvent.change(field, { target: { value: bad } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
    expect(await screen.findByText('تحقق من القيمة المدخلة.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field).toHaveValue(Number(bad));
  },
);

it('still rejects a two-digit value in the Gregorian case year', async () => {
  const onSubmit = renderForm();
  fireEvent.change(screen.getByLabelText('سنة الدعوى'), { target: { value: '89' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  expect(await screen.findByText('تحقق من القيمة المدخلة.')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
