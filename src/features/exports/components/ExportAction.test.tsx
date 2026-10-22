import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ExportAction } from './ExportAction';

vi.mock('@/bridge/commands', () => ({
  bridge: { createExport: vi.fn(), revealExport: vi.fn() },
}));
import { bridge } from '@/bridge/commands';

const result = { token: 'native-export-token', folderName: 'LegalMasr-export-2026-10-21-1234' };
const failed = { code: 'OPERATION_FAILED', message: 'private backend error', details: null };
function setup(caseId?: string) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <ExportAction caseId={caseId} />
    </QueryClientProvider>,
  );
}
function open(caseId?: string) {
  fireEvent.click(
    screen.getByRole('button', {
      name: i18n.t(caseId ? 'exports.caseAction' : 'exports.allAction'),
    }),
  );
  return screen.getByRole('alertdialog');
}
function confirm(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('exports.confirm') }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('ar');
  vi.mocked(bridge.createExport).mockResolvedValue(result);
  vi.mocked(bridge.revealExport).mockResolvedValue(undefined);
});
afterEach(async () => {
  await i18n.changeLanguage('ar');
});

describe.each(['ar', 'en'])('export warning in %s', (language) => {
  it.each([undefined, 'case-id'])(
    'requires confirmation before the picker for scope %s',
    async (caseId) => {
      await i18n.changeLanguage(language);
      setup(caseId);
      const dialog = open(caseId);
      expect(
        within(dialog).getByText(i18n.t(caseId ? 'exports.caseWarning' : 'exports.allWarning')),
      ).toBeVisible();
      expect(bridge.createExport).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.cancel') }));
      expect(bridge.createExport).not.toHaveBeenCalled();
      confirm(open(caseId));
      await screen.findByRole('status');
      expect(bridge.createExport).toHaveBeenCalledWith(
        caseId,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}-\d{4}$/),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByText(result.folderName)).toHaveAttribute('dir', 'auto');
      fireEvent.click(screen.getByRole('button', { name: i18n.t('exports.reveal') }));
      await waitFor(() => expect(bridge.revealExport).toHaveBeenCalledWith(result.token));
    },
  );
});

it('keeps a failed export in the warning dialog and allows a confirmed retry', async () => {
  vi.mocked(bridge.createExport).mockRejectedValueOnce(failed);
  setup();
  confirm(open());
  expect(await screen.findByText(i18n.t('exports.failed'))).toBeVisible();
  expect(screen.queryByText('private backend error')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  confirm(screen.getByRole('alertdialog'));
  await screen.findByRole('status');
  expect(bridge.createExport).toHaveBeenCalledTimes(2);
});

it('treats native picker cancellation as harmless and requires a new confirmation', async () => {
  vi.mocked(bridge.createExport).mockRejectedValueOnce({
    code: 'OPERATION_CANCELLED',
    message: 'cancelled',
    details: null,
  });
  setup('case-id');
  confirm(open('case-id'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  open('case-id');
  expect(bridge.createExport).toHaveBeenCalledTimes(1);
});

it('reports reveal failure while preserving the successful export name', async () => {
  vi.mocked(bridge.revealExport).mockRejectedValueOnce(failed);
  setup();
  confirm(open());
  await screen.findByRole('status');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('exports.reveal') }));
  expect(await screen.findByText(i18n.t('exports.revealFailed'))).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(result.folderName);
});

it('admits only one export while the async picker or writer is pending', async () => {
  let finish!: (value: typeof result) => void;
  vi.mocked(bridge.createExport).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  setup();
  const dialog = open();
  confirm(dialog);
  await waitFor(() => expect(bridge.createExport).toHaveBeenCalledTimes(1));
  expect(within(dialog).getByRole('button', { name: i18n.t('exports.creating') })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: i18n.t('common.cancel') })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('exports.creating') }));
  expect(bridge.createExport).toHaveBeenCalledTimes(1);
  finish(result);
  await screen.findByRole('status');
});
