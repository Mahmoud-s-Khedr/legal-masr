import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Placeholder } from '../components/layout/Placeholder';
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

export const NAV_ITEMS = [
  { to: '/', key: 'nav.home' },
  { to: '/clients', key: 'nav.clients' },
  { to: '/cases', key: 'nav.cases' },
  { to: '/calendar', key: 'nav.calendar' },
  { to: '/tasks', key: 'nav.tasks' },
  { to: '/documents', key: 'nav.documents' },
  { to: '/finances', key: 'nav.finances' },
  { to: '/settings', key: 'nav.settings' },
] as const;

const PLACEHOLDER_NAV_KEYS = new Set<string>();

export function AppRoutes() {
  const { t } = useTranslation();
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
      {NAV_ITEMS.filter(({ to }) => PLACEHOLDER_NAV_KEYS.has(to)).map(({ to, key }) => (
        <Route key={to} path={to} element={<Placeholder label={t(key)} />} />
      ))}
      <Route path="/backups" element={<Navigate to="/settings?tab=backups" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
