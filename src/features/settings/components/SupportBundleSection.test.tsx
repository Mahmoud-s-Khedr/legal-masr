import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { bridge } from '../../../bridge/commands';
import { SupportBundleSection } from './SupportBundleSection';

vi.mock('../../../bridge/commands', () => ({ bridge: { saveSupportBundle: vi.fn() } }));
function renderSection() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <SupportBundleSection />
    </QueryClientProvider>,
  );
}
const t = (key: string) => i18n.t(`settings.supportBundle.${key}`);
async function open() {
  fireEvent.click(screen.getByRole('button', { name: t('create') }));
  return screen.findByRole('alertdialog');
}
describe('SupportBundleSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await i18n.changeLanguage('ar');
  });
  it.each(['ar', 'en'])(
    'lists the exact contents and exclusions in %s and cancels without opening a picker',
    async (language) => {
      await i18n.changeLanguage(language);
      renderSection();
      const dialog = await open();
      expect(dialog).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(6);
      for (const key of ['system', 'settings', 'schema', 'codes', 'logs', 'readme'])
        expect(within(dialog).getByText(t(`includes.${key}`))).toBeVisible();
      expect(within(dialog).getByText(t('excludes'))).toBeVisible();
      expect(within(dialog).getByText(t('localOnly'))).toBeVisible();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.cancel') }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(bridge.saveSupportBundle).not.toHaveBeenCalled();
    },
  );
  it('saves only after confirmation, disables actions while pending and shows success', async () => {
    let finish!: () => void;
    vi.mocked(bridge.saveSupportBundle).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderSection();
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: t('chooseDestination') }));
    expect(await within(dialog).findByRole('button', { name: t('saving') })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: i18n.t('common.cancel') })).toBeDisabled();
    finish();
    expect(await screen.findByRole('status')).toHaveTextContent(t('success'));
    expect(bridge.saveSupportBundle).toHaveBeenCalledExactlyOnceWith(t('pickerFilter'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
  it('keeps native picker cancellation quiet and lets the user retry', async () => {
    vi.mocked(bridge.saveSupportBundle)
      .mockRejectedValueOnce({ code: 'OPERATION_CANCELLED', message: 'cancelled' })
      .mockResolvedValueOnce(undefined);
    renderSection();
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: t('chooseDestination') }));
    await waitFor(() => expect(bridge.saveSupportBundle).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: t('chooseDestination') })).toBeEnabled(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: t('chooseDestination') }));
    expect(await screen.findByRole('status')).toHaveTextContent(t('success'));
  });
  it('reports a write error without displaying raw paths and retries successfully', async () => {
    vi.mocked(bridge.saveSupportBundle)
      .mockRejectedValueOnce({ code: 'OPERATION_FAILED', message: '/home/private/client' })
      .mockResolvedValueOnce(undefined);
    renderSection();
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: t('chooseDestination') }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t('error'));
    expect(screen.queryByText('/home/private/client')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: t('chooseDestination') }));
    expect(await screen.findByRole('status')).toHaveTextContent(t('success'));
  });
});
