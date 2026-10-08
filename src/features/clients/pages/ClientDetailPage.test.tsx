import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { ClientDetailPage } from './ClientDetailPage';

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

it('tells the lawyer a client number is already used, in words that fix it, and keeps the draft', async () => {
  vi.mocked(bridge.clientUpdate).mockRejectedValue({
    code: 'CLIENT_NUMBER_TAKEN',
    message: 'safe',
    details: null,
  });
  renderWorkflow(<ClientDetailPage />, `/clients/${fixtures.client.id}`, '/clients/:id');

  fireEvent.click((await screen.findAllByRole('button', { name: 'تعديل' }))[0]);
  const dialog = await screen.findByRole('dialog');
  const number = within(dialog).getByLabelText('الرقم الداخلي');
  fireEvent.change(number, { target: { value: 'DEMO-DUPLICATE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('رقم الموكل هذا مستخدم لموكل آخر');
  expect(alert).not.toHaveTextContent('أعد المحاولة');
  expect(number).toHaveValue('DEMO-DUPLICATE');
});
