import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { AttachmentsPage } from './DocumentsPage';

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

it('chooses an owner from the global page and opens its document form once', async () => {
  renderWorkflow(
    <>
      <AttachmentsPage />
      <Location />
    </>,
    '/attachments',
  );
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة مستند' }));
  const dialog = await screen.findByRole('dialog', { name: 'إضافة مستند' });
  expect(within(dialog).getByRole('button', { name: 'متابعة' })).toBeDisabled();
  const picker = within(dialog).getByRole('combobox');
  act(() => picker.focus());
  fireEvent.keyDown(picker, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'متابعة' }));
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(`case=${fixtures.caseItem.id}`),
  );
  await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('add='));
  expect(await screen.findByRole('button', { name: 'اختيار ملف' })).toBeInTheDocument();
});

it('protects custom owner choices and resets discarded choices before reopening', async () => {
  renderWorkflow(<AttachmentsPage />, '/attachments');
  fireEvent.click(await screen.findByRole('button', { name: 'إضافة مستند' }));
  const dialog = await screen.findByRole('dialog', { name: 'إضافة مستند' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'موكل' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'إلغاء' }));
  const confirmation = await screen.findByRole('alertdialog');
  fireEvent.click(within(confirmation).getByRole('button', { name: i18n.t('forms.discard') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مستند' }));
  const reopened = await screen.findByRole('dialog');
  expect(within(reopened).getByRole('button', { name: 'قضية' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(within(reopened).getByRole('button', { name: 'إلغاء' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
