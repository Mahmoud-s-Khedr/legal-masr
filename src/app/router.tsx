import { NewPowerOfAttorneyPage } from '../features/powersOfAttorney/pages/NewPowerOfAttorneyPage';
import { Route, Routes } from 'react-router-dom';
import { AgendaPage } from '../features/hearings/pages/AgendaPage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { AttachmentsPage } from '../features/documents/pages/DocumentsPage';
import { CaseDetailPage } from '../features/cases/pages/CaseDetailPage';
import { CaseListPage } from '../features/cases/pages/CaseListPage';
import { ClientDetailPage } from '../features/clients/pages/ClientDetailPage';
import { ClientListPage } from '../features/clients/pages/ClientListPage';
import { NewClientPage } from '../features/clients/pages/NewClientPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { NewCasePage } from '../features/cases/pages/NewCasePage';
import { FinancesPage } from '../features/finances/pages/FinancesPage';
import { BackupsPage } from '../features/backups/pages/BackupsPage';
import { PowersOfAttorneyPage } from '../features/powersOfAttorney/pages/PowersOfAttorneyPage';
import { PowerOfAttorneyDetailPage } from '../features/powersOfAttorney/pages/PowerOfAttorneyDetailPage';
import type { IconName } from '../components/layout/Icon';

export const NAV_GROUPS = [
  {
    key: 'nav.groups.daily',
    items: [
      { to: '/', key: 'nav.today', icon: 'home' },
      { to: '/calendar', key: 'nav.agenda', icon: 'calendar' },
      { to: '/tasks', key: 'nav.tasks', icon: 'tasks' },
    ],
  },
  {
    key: 'nav.groups.records',
    items: [
      { to: '/clients', key: 'nav.clients', icon: 'clients' },
      { to: '/cases', key: 'nav.cases', icon: 'cases' },
      { to: '/powers-of-attorney', key: 'nav.powersOfAttorney', icon: 'poa' },
      { to: '/attachments', key: 'nav.documents', icon: 'documents' },
    ],
  },
  {
    key: 'nav.groups.office',
    items: [
      { to: '/finances', key: 'nav.finances', icon: 'finances' },
      { to: '/backups', key: 'nav.backups', icon: 'backup' },
      { to: '/settings', key: 'nav.settings', icon: 'settings' },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  items: ReadonlyArray<{ to: string; key: string; icon: IconName }>;
}>;

export const NAV_ITEMS: ReadonlyArray<{ to: string; key: string; icon: IconName }> =
  NAV_GROUPS.flatMap((group) => [...group.items]);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/clients" element={<ClientListPage />} />
      <Route path="/clients/new" element={<NewClientPage />} />
      <Route path="/clients/:id" element={<ClientDetailPage />} />
      <Route path="/powers-of-attorney" element={<PowersOfAttorneyPage />} />
      <Route path="/powers-of-attorney/new" element={<NewPowerOfAttorneyPage />} />
      <Route path="/powers-of-attorney/:id" element={<PowerOfAttorneyDetailPage />} />
      <Route path="/cases" element={<CaseListPage />} />
      <Route path="/cases/new" element={<NewCasePage />} />
      <Route path="/cases/:id" element={<CaseDetailPage />} />
      <Route path="/calendar" element={<AgendaPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/attachments" element={<AttachmentsPage />} />
      <Route path="/finances" element={<FinancesPage />} />
      <Route path="/backups" element={<BackupsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
