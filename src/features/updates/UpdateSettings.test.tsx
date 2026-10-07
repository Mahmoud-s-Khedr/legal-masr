import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { UpdateSnapshot } from './updateController';
import i18n from '../../i18n';

const mocks = vi.hoisted(() => ({
  pendingSaves: vi.fn(() => 0),
  initialize: vi.fn().mockResolvedValue(undefined),
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  setMode: vi.fn(),
  getSnapshot: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));
vi.mock('./updateController', () => ({ updateController: mocks }));
vi.mock('@tanstack/react-query', () => ({ useIsMutating: mocks.pendingSaves }));
import { UpdateInstallDialog, UpdateNotice, UpdateSettings, UpdateSync } from './UpdateSettings';
let snapshot: UpdateSnapshot;
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.pendingSaves.mockReturnValue(0);
  await i18n.changeLanguage('en');
  snapshot = {
    mode: 'manual',
    status: { currentVersion: '0.1.0', available: true, reason: null },
    phase: 'idle',
    update: null,
    message: null,
  };
  mocks.getSnapshot.mockImplementation(() => snapshot);
});

it('offers a manual check and shows release notes as plain text', () => {
  snapshot.update = { version: '0.2.0', downloaded: false, notes: '<script>unsafe()</script>' };
  render(<UpdateSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
  expect(mocks.check).toHaveBeenCalledOnce();
  expect(screen.getByText('<script>unsafe()</script>')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Download update' }));
  expect(mocks.download).toHaveBeenCalledOnce();
});
it('requires saved-work acknowledgment before backup/install/restart', () => {
  snapshot.update = { version: '0.2.0', downloaded: true, notes: '' };
  render(<UpdateSettings />);
  const install = screen.getByRole('button', { name: 'Back up, install and restart' });
  expect(install).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(install).toBeEnabled();
  fireEvent.click(install);
  expect(mocks.install).toHaveBeenCalledOnce();
  expect(install).toBeDisabled();
});
it.each(['not-configured', 'manual-install'] as const)(
  'disables updater actions for %s builds',
  (reason) => {
    snapshot.status = { ...snapshot.status, available: false, reason };
    render(<UpdateSettings />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      reason === 'manual-install' ? 'requires a manual update' : 'not enabled',
    );
  },
);
it('shows a safe backup failure message and offers download retry', () => {
  snapshot.message = 'backupFailed';
  snapshot.update = { version: '0.2.0', downloaded: false, notes: '' };
  render(<UpdateSettings />);
  expect(screen.getByRole('alert')).toHaveTextContent('No update was installed');
  expect(screen.getByRole('button', { name: 'Download update' })).toBeEnabled();
});
it('announces ready updates with a link to Settings', () => {
  snapshot.update = { version: '0.2.0', downloaded: true, notes: '' };
  render(
    <MemoryRouter>
      <UpdateNotice />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link')).toHaveAttribute('href', '/settings?tab=about');
  expect(screen.getByRole('status')).toHaveTextContent('ready to install');
});
it('uses the existing modal to block editing during backup and installation', () => {
  snapshot.phase = 'installing';
  render(<UpdateInstallDialog />);
  expect(screen.getByRole('dialog')).toHaveTextContent('Creating a validated backup');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('schedules automatic checks and cleans up when the vault workspace unmounts', () => {
  vi.useFakeTimers();
  const result = render(<UpdateSync />);
  expect(mocks.check).toHaveBeenCalledWith(true);
  vi.advanceTimersByTime(6 * 60 * 60 * 1000);
  expect(mocks.check).toHaveBeenCalledTimes(2);
  fireEvent(window, new Event('online'));
  expect(mocks.check).toHaveBeenCalledTimes(3);
  result.unmount();
  vi.advanceTimersByTime(6 * 60 * 60 * 1000);
  fireEvent(window, new Event('online'));
  expect(mocks.check).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});

it('announces a completed upgrade in the workspace without opening Settings', () => {
  snapshot.message = 'updated';
  render(
    <MemoryRouter>
      <UpdateNotice />
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'The application update completed successfully',
  );
});

it('waits for pending saves before allowing installation', () => {
  mocks.pendingSaves.mockReturnValue(1);
  snapshot.update = { version: '0.2.0', downloaded: true, notes: '' };
  const result = render(<UpdateSettings />);
  fireEvent.click(screen.getByRole('checkbox'));
  const button = screen.getByRole('button', { name: 'Back up, install and restart' });
  expect(button).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for your pending saves');
  fireEvent.click(button);
  expect(mocks.install).not.toHaveBeenCalled();
  mocks.pendingSaves.mockReturnValue(0);
  result.rerender(<UpdateSettings />);
  expect(button).toBeEnabled();
});
