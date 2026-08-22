import { Route, Routes } from 'react-router-dom';
import { CalendarPage } from '../features/events/pages/CalendarPage';
import { TasksPage } from '../features/tasks/pages/TasksPage';
import { DocumentsPage } from '../features/documents/pages/DocumentsPage';
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
import type { IconName } from '../components/layout/Icon';

export const NAV_ITEMS = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/clients', key: 'nav.clients', icon: 'clients' },
  { to: '/cases', key: 'nav.cases', icon: 'cases' },
  { to: '/calendar', key: 'nav.calendar', icon: 'calendar' },
  { to: '/tasks', key: 'nav.tasks', icon: 'tasks' },
  { to: '/documents', key: 'nav.documents', icon: 'documents' },
  { to: '/finances', key: 'nav.finances', icon: 'finances' },
  { to: '/backups', key: 'nav.backups', icon: 'backup' },
  { to: '/settings', key: 'nav.settings', icon: 'settings' },
] as const satisfies ReadonlyArray<{ to: string; key: string; icon: IconName }>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/clients" element={<ClientListPage />} />
      <Route path="/clients/new" element={<NewClientPage />} />
      <Route path="/clients/:id" element={<ClientDetailPage />} />
      <Route path="/cases" element={<CaseListPage />} />
      <Route path="/cases/new" element={<NewCasePage />} />
      <Route path="/cases/:id" element={<CaseDetailPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/finances" element={<FinancesPage />} />
      <Route path="/backups" element={<BackupsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
