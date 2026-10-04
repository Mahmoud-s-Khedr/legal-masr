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
            <Link to="/calendar">{t('dashboard.addHearing')}</Link>
          </Button>
          <Button variant="secondary" asChild className="button-link secondary-link">
            <Link to="/tasks">{t('dashboard.addTask')}</Link>
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
                    <span dir="auto">{hearing.location ?? '—'}</span>
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
                <bdi dir="auto">{task.title}</bdi> · <bdi dir="ltr">{task.dueDate}</bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('dashboard.noOverdue')}</p>
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
