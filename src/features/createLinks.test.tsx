import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Link, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: vi.fn() }));
import i18n from '@/i18n';
import { prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { AgendaPage } from './hearings/pages/AgendaPage';
import { TasksPage } from './tasks/pages/TasksPage';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

beforeEach(async () => {
  prepareWorkflowMocks();
  await i18n.changeLanguage('ar');
});

describe('top-bar «إضافة» links on their own page', () => {
  it.each([
    [
      '/calendar',
      '/calendar?create=hearing',
      <AgendaPage key="agenda" />,
      'إضافة جلسة',
      'حفظ الجلسة',
    ],
    ['/tasks', '/tasks?create=task', <TasksPage key="tasks" />, 'إضافة مهمة', 'حفظ المهمة'],
  ])('%s opens the form every time the link is used', async (path, link, page, title, save) => {
    renderWorkflow(
      <>
        <Link to={link}>رابط الإضافة</Link>
        {page}
        <Search />
      </>,
      path,
      path,
    );
    const linkElement = await screen.findByRole('link', { name: 'رابط الإضافة' });

    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(linkElement);
      const dialog = await screen.findByRole('dialog', { name: title });
      expect(within(dialog).getByRole('button', { name: save })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('search')).not.toHaveTextContent('create'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'إلغاء' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  });
});
