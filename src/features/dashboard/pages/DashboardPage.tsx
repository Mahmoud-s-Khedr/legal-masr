import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { bridge } from '../../../bridge/commands';
import { Icon } from '../../../components/layout/Icon';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';

const localDate = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { data: clients, isLoading: clientsLoading } = useClientList({});
  const { data: cases, isLoading: casesLoading } = useCaseList({});
  const today = localDate();
  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ['dashboard', today],
    queryFn: () => bridge.dashboardSummary(today),
    retry: false,
  });
  const displayDate = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const attentionCount =
    (agenda?.overdueTasks.length ?? 0) + (agenda?.missingOutcomeEvents.length ?? 0);

  return (
    <section className="dashboard-ledger">
      <header className="today-heading">
        <div>
          <p className="today-date">{displayDate}</p>
          <h2>{t('dashboard.today')}</h2>
          <p>{t('dashboard.todayDescription')}</p>
        </div>
        <div className="quick-actions">
          <Link className="button-link" to="/calendar">
            <Icon name="calendar" size={18} />
            {t('dashboard.addHearing')}
          </Link>
          <Link className="button-link secondary-link" to="/tasks">
            <Icon name="tasks" size={18} />
            {t('dashboard.addTask')}
          </Link>
        </div>
      </header>

      <section className="dashboard-stats" aria-label={t('dashboard.summary')}>
        <article>
          <span className="stat-icon">
            <Icon name="cases" />
          </span>
          <div>
            <strong>{cases?.length ?? '—'}</strong>
            <span>{t('dashboard.activeCases')}</span>
          </div>
        </article>
        <article>
          <span className="stat-icon">
            <Icon name="clients" />
          </span>
          <div>
            <strong>{clients?.length ?? '—'}</strong>
            <span>{t('dashboard.clientsCount')}</span>
          </div>
        </article>
        <article className={attentionCount ? 'attention-stat' : ''}>
          <span className="stat-icon">
            <Icon name="clock" />
          </span>
          <div>
            <strong>{attentionCount}</strong>
            <span>{t('dashboard.needsAttention')}</span>
          </div>
        </article>
      </section>

      <div className="dashboard-day-grid">
        <section className="register-section day-agenda" aria-labelledby="today-events-heading">
          <div className="register-heading">
            <div>
              <p className="kicker">{t('dashboard.agendaKicker')}</p>
              <h3 id="today-events-heading">{t('dashboard.todayEvents')}</h3>
            </div>
            <Link className="text-link" to="/calendar">
              {t('dashboard.viewCalendar')}
            </Link>
          </div>
          {agendaLoading ? (
            <p className="table-message">{t('dashboard.loadingAgenda')}</p>
          ) : !agenda?.todayEvents.length ? (
            <div className="empty-compact">
              <Icon name="calendar" size={24} />
              <div>
                <strong>{t('dashboard.noEvents')}</strong>
                <span>{t('dashboard.noEventsHint')}</span>
              </div>
            </div>
          ) : (
            <ol className="agenda-timeline">
              {agenda.todayEvents.map((event) => (
                <li key={event.id}>
                  <time>{event.startTime ?? t('dashboard.allDay')}</time>
                  <div>
                    <Link to={`/calendar?event=${event.id}`}>{event.title}</Link>
                    <span>
                      {[event.location, event.circuitName].filter(Boolean).join(' · ') ||
                        t('dashboard.legalEvent')}
                    </span>
                    {event.preparationNotes && <small>{event.preparationNotes}</small>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="register-section today-tasks" aria-labelledby="today-tasks-heading">
          <div className="register-heading">
            <div>
              <p className="kicker">{t('dashboard.followUpKicker')}</p>
              <h3 id="today-tasks-heading">{t('dashboard.todayTasks')}</h3>
            </div>
            <Link className="text-link" to="/tasks">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {!agenda?.todayTasks.length ? (
            <div className="empty-compact">
              <Icon name="tasks" size={24} />
              <div>
                <strong>{t('dashboard.noTasks')}</strong>
                <span>{t('dashboard.noTasksHint')}</span>
              </div>
            </div>
          ) : (
            <ul className="task-preview-list">
              {agenda.todayTasks.map((task) => (
                <li key={task.id}>
                  <Icon name="circle-plus" size={19} />
                  <Link to={`/tasks?task=${task.id}`}>{task.title}</Link>
                  <span className={`priority-label ${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {attentionCount > 0 && (
        <section className="attention-panel" aria-labelledby="attention-heading">
          <div className="register-heading">
            <div>
              <p className="kicker">{t('dashboard.attentionKicker')}</p>
              <h3 id="attention-heading">{t('dashboard.attentionTitle')}</h3>
            </div>
          </div>
          <div className="attention-groups">
            {agenda?.overdueTasks.map((task) => (
              <Link key={task.id} to={`/tasks?task=${task.id}`}>
                <Icon name="clock" size={18} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{t('dashboard.overdueSince', { date: task.dueDate })}</small>
                </span>
              </Link>
            ))}
            {agenda?.missingOutcomeEvents.map((event) => (
              <Link key={event.id} to={`/calendar?event=${event.id}`}>
                <Icon name="cases" size={18} />
                <span>
                  <strong>{event.title}</strong>
                  <small>{t('dashboard.missingOutcome', { date: event.eventDate })}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="dashboard-registers dashboard-records">
        <section className="register-section" aria-labelledby="recent-clients-heading">
          <div className="register-heading">
            <div>
              <p className="kicker">{t('dashboard.clientsKicker')}</p>
              <h3 id="recent-clients-heading">{t('dashboard.clientsTitle')}</h3>
            </div>
            <Link className="text-link" to="/clients">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {clientsLoading ? (
            <p className="table-message">{t('clients.loading')}</p>
          ) : !clients?.length ? (
            <p className="table-message">{t('clients.empty')}</p>
          ) : (
            <div className="data-table-scroll">
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th scope="col">{t('clients.columns.name')}</th>
                    <th scope="col">{t('clients.columns.phone')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 5).map((client) => (
                    <tr key={client.id}>
                      <th scope="row">
                        <Link to={`/clients/${client.id}`}>{client.displayName}</Link>
                      </th>
                      <td dir="ltr">{client.primaryPhone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="register-section" aria-labelledby="recent-cases-heading">
          <div className="register-heading">
            <div>
              <p className="kicker">{t('dashboard.casesKicker')}</p>
              <h3 id="recent-cases-heading">{t('dashboard.casesTitle')}</h3>
            </div>
            <Link className="text-link" to="/cases">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {casesLoading ? (
            <p className="table-message">{t('cases.loading')}</p>
          ) : !cases?.length ? (
            <p className="table-message">{t('cases.empty')}</p>
          ) : (
            <div className="data-table-scroll">
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th scope="col">{t('cases.columns.number')}</th>
                    <th scope="col">{t('cases.columns.client')}</th>
                    <th scope="col">{t('cases.columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        <Link to={`/cases/${item.id}`}>{item.caseNumber}</Link>
                      </th>
                      <td>{item.primaryClientName ?? '—'}</td>
                      <td>
                        <span className="badge">{t(`cases.status.${item.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
