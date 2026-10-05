import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { bridge } from '../../../bridge/commands';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { queryKeys } from '../../../lib/queryKeys';
import { localDateOnly } from '../../../lib/dateOnly';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useTranslation } from 'react-i18next';

const today = () => localDateOnly();
export function DashboardPage() {
  const { t } = useTranslation();
  const date = today();
  const agenda = useQuery({
    queryKey: queryKeys.today.summary(date),
    queryFn: () => bridge.dashboardSummary(date),
  });
  const clients = useClientList({});
  const cases = useCaseList({});
  const upcomingHearings =
    agenda.data?.upcomingHearings.filter((hearing) => hearing.hearingDate > date) ?? [];
  if (agenda.isLoading || clients.isLoading || cases.isLoading)
    return <p role="status">جارٍ تحميل لوحة اليوم…</p>;
  if (agenda.isError || clients.isError || cases.isError)
    return <p role="alert">تعذر تحميل لوحة اليوم. حاول مرة أخرى.</p>;
  return (
    <section className="dashboard-ledger">
      <header className="today-heading">
        <div>
          <p className="today-date">{date}</p>
          <h2>{t('dashboard.today')}</h2>
          <p>{t('dashboard.todayDescription')}</p>
        </div>
        <div className="quick-actions">
          <Button asChild className="button-link">
            <Link to={`/calendar?create=hearing&date=${date}`}>{t('dashboard.addHearing')}</Link>
          </Button>
          <Button variant="secondary" asChild className="button-link secondary-link">
            <Link to={`/tasks?create=task&date=${date}`}>{t('dashboard.addTask')}</Link>
          </Button>
        </div>
      </header>
      <div className="dashboard-day-grid">
        <Card className="register-section">
          <h3>{t('dashboard.todayEvents')}</h3>
          {agenda.data?.todayHearings.length ? (
            <ul className="agenda-timeline">
              {agenda.data.todayHearings.map((hearing) => (
                <li key={hearing.id}>
                  <time dir="ltr">
                    <bdi>{hearing.hearingTime ?? t('dashboard.allDay')}</bdi>
                  </time>
                  <div>
                    <Link to={`/calendar?hearing=${hearing.id}`}>
                      <bdi dir="auto">{hearing.hearingType ?? t('dashboard.legalEvent')}</bdi>
                    </Link>
                    <span dir="auto">
                      {caseContext(hearing.caseId, cases.data, t)}
                      {hearing.circuitName && ` · ${hearing.circuitName}`}
                      {hearing.location && ` · ${hearing.location}`}
                    </span>
                    {hearing.requiredDocuments && (
                      <span className="preparation-context" dir="auto">
                        {t('dashboard.preparation')}: {hearing.requiredDocuments}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('dashboard.noEvents')}</p>
          )}
        </Card>
        <Card className="register-section">
          <h3>{t('dashboard.todayTasks')}</h3>
          {agenda.data?.todayTasks.length ? (
            <ul className="task-preview-list">
              {agenda.data.todayTasks.map((task) => (
                <li key={task.id}>
                  <Link to={`/tasks?task=${task.id}`} dir="auto">
                    <bdi>{task.title}</bdi>
                  </Link>
                  <span dir="ltr">
                    <bdi>{task.dueDate}</bdi>
                  </span>
                  <span dir="auto">
                    {taskContext(task.caseId, task.clientId, cases.data, clients.data, t)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('dashboard.noTasks')}</p>
          )}
        </Card>
      </div>
      <Card className="attention-panel">
        <h3>{t('dashboard.attentionTitle')}</h3>
        {agenda.data?.overdueTasks.length ? (
          <ul>
            {agenda.data.overdueTasks.map((task) => (
              <li key={task.id}>
                <Link to={`/tasks?task=${task.id}`} dir="auto">
                  <bdi>{task.title}</bdi>
                </Link>{' '}
                · <bdi dir="ltr">{task.dueDate}</bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('dashboard.noOverdue')}</p>
        )}
      </Card>
      <Card className="register-section">
        <h3>{t('dashboard.upcomingHearings')}</h3>
        {upcomingHearings.length ? (
          <ul>
            {upcomingHearings.map((hearing) => (
              <li key={hearing.id}>
                <Link to={`/calendar?hearing=${hearing.id}`}>
                  <bdi>{hearing.hearingDate}</bdi> ·{' '}
                  {hearing.hearingType ?? t('dashboard.legalEvent')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('dashboard.noUpcomingHearings')}</p>
        )}
      </Card>
      <div className="dashboard-registers">
        <Card className="register-section">
          <h3>{t('dashboard.clientsKicker')}</h3>
          <ul>
            {clients.data?.slice(0, 5).map((client) => (
              <li key={client.id}>
                <Link to={`/clients/${client.id}`} dir="auto">
                  <bdi>{client.fullName}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="register-section">
          <h3>{t('dashboard.casesKicker')}</h3>
          <ul>
            {cases.data?.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link to={`/cases/${item.id}`} dir="ltr">
                  <bdi>{item.internalNumber}</bdi>
                </Link>{' '}
                · <bdi dir="auto">{item.clientNames.join(', ')}</bdi>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

function caseContext(
  caseId: string,
  cases: ReturnType<typeof useCaseList>['data'],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const item = cases?.find((candidate) => candidate.id === caseId);
  return item
    ? t('dashboard.caseContext', {
        caseNumber: item.internalNumber,
        clients: item.clientNames.join(', '),
      })
    : t('dashboard.caseContextUnavailable');
}

function taskContext(
  caseId: string | null,
  clientId: string | null,
  cases: ReturnType<typeof useCaseList>['data'],
  clients: ReturnType<typeof useClientList>['data'],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const caseItem = caseId ? cases?.find((candidate) => candidate.id === caseId) : undefined;
  const client = clientId ? clients?.find((candidate) => candidate.id === clientId) : undefined;
  if (caseItem) return t('dashboard.taskCaseContext', { caseNumber: caseItem.internalNumber });
  if (client) return t('dashboard.taskClientContext', { clientName: client.fullName });
  return t('dashboard.taskNoContext');
}
