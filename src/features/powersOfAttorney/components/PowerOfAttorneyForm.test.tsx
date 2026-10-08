import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { PowerOfAttorneyForm } from './PowerOfAttorneyForm';

const createdClient = {
  ...fixtures.client,
  id: 'demo-client-new',
  internalNumber: 'CL-NEW-1',
  fullName: 'موكل جديد — DEMO',
};

beforeEach(async () => {
  prepareWorkflowMocks();
  vi.mocked(bridge.clientCreate).mockResolvedValue(createdClient);
  await i18n.changeLanguage('ar');
});

it('saving a client inline never submits the parent power-of-attorney draft, and links the new client', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWorkflow(<PowerOfAttorneyForm busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'POA-DRAFT-7' } });
  fireEvent.click(screen.getByRole('button', { name: 'إضافة موكل جديد' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('الاسم الكامل'), {
    target: { value: createdClient.fullName },
  });
  fireEvent.change(within(dialog).getByLabelText('الرقم الداخلي'), {
    target: { value: createdClient.internalNumber },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الموكل وربطه بالتوكيل' }));

  await waitFor(() => expect(bridge.clientCreate).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  // The parent draft was neither submitted nor overwritten by the inline save.
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('الرقم الداخلي')).toHaveValue('POA-DRAFT-7');

  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      internalSequence: 'POA-DRAFT-7',
      clientIds: [createdClient.id],
    }),
  );
});

it('cancelling the inline client dialog leaves the parent draft untouched and unsubmitted', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWorkflow(<PowerOfAttorneyForm busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'POA-DRAFT-8' } });
  fireEvent.click(screen.getByRole('button', { name: 'إضافة موكل جديد' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'إلغاء' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(bridge.clientCreate).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('الرقم الداخلي')).toHaveValue('POA-DRAFT-8');
});

it('says a power of attorney needs a client on that field instead of failing to save', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWorkflow(<PowerOfAttorneyForm busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'POA-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));
  expect(
    await screen.findByText('اختر موكلًا واحدًا على الأقل صدر منه التوكيل.'),
  ).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
