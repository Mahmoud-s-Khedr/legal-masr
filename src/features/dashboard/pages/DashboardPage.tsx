import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bridge } from '../../../bridge/commands';
import type { CaseSummary, ClientSummary, HearingDto, TaskDto } from '../../../bridge/types';
import { Icon, type IconName } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { useFormat } from '../../../i18n/LocalePresentation';
import { localDateOnly } from '../../../lib/dateOnly';
import { daysBetween } from '../../../lib/format';
import { queryKeys } from '../../../lib/queryKeys';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useCompleteTask } from '../../tasks/api/tasksApi';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function DashboardPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const date = localDateOnly();
  const agenda = useQuery({
    queryKey: queryKeys.today.summary(date),
    queryFn: () => bridge.dashboardSummary(date),
  });
  const clients = useClientList({});
  const cases = useCaseList({});
  const complete = useCompleteTask();

  if (agenda.isLoading || clients.isLoading || cases.isLoading)
    return (
      <p className="page-status" role="status">
        {t('dashboard.loading')}
      </p>
    );
  if (agenda.isError || clients.isError || cases.isError || !agenda.data)
    return (
      <div className="page-status error" role="alert">
        <p>{t('dashboard.loadError')}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void agenda.refetch();
            void clients.refetch();
            void cases.refetch();
          }}
        >
          {t('app.retry')}
        </Button>
      </div>
    );

  const summary = agenda.data;
  const upcoming = summary.upcomingHearings.filter((hearing) => hearing.hearingDate > date);
  const weekAhead = upcoming.filter((hearing) => daysBetween(date, hearing.hearingDate) <= 7);
  const todayHearings = [...summary.todayHearings].sort((a, b) =>
    (a.hearingTime ?? '99').localeCompare(b.hearingTime ?? '99'),
  );
  const caseFor = (id: string | null) => cases.data?.find((item) => item.id === id);
  const clientFor = (id: string | null) => clients.data?.find((item) => item.id === id);

  return (
    <section className="dashboard-ledger">
      <PageHeader
        kicker={<time dateTime={date}>{format.dateLong(date)}</time>}
        title={t('dashboard.today')}
        description={t('dashboard.todayDescription')}
        actions={
          <>
            <Button
              nativeButton={false}
              role="link"
              render={<Link to={`/calendar?create=hearing&date=${date}`} />}
            >
              {t('dashboard.addHearing')}
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              role="link"
              render={<Link to={`/tasks?create=task&date=${date}`} />}
            >
              {t('dashboard.addTask')}
            </Button>
          </>
        }
      />

      <div className="today-stats" role="list" aria-label={t('dashboard.summary')}>
        <StatLink
          to={`/calendar?date=${date}`}
          icon="calendar"
          value={summary.todayHearings.length}
          label={t('dashboard.stats.hearingsToday')}
        />
        <StatLink
          to="/tasks"
          icon="tasks"
          value={summary.todayTasks.length}
          label={t('dashboard.stats.tasksToday')}
        />
        <StatLink
          to="/tasks?view=OVERDUE"
          icon="clock"
          value={summary.overdueTasks.length}
          label={t('dashboard.stats.overdue')}
          tone={summary.overdueTasks.length ? 'danger' : undefined}
        />
        <StatLink
          to="/calendar"
          icon="cases"
          value={weekAhead.length}
          label={t('dashboard.stats.weekAhead')}
        />
      </div>

      {summary.overdueTasks.length > 0 && (
        <section className="attention-panel" aria-labelledby="overdue-title">
          <div className="panel-heading">
            <h3 id="overdue-title">{t('dashboard.attentionTitle')}</h3>
            <Link className="text-link" to="/tasks?view=OVERDUE">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <ul className="work-rows">
            {summary.overdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                context={taskContext(task, caseFor, clientFor, t)}
                meta={t('dashboard.overdueDays', { count: daysBetween(task.dueDate, date) })}
                overdue
                pending={complete.isPending}
                onComplete={() => complete.mutate(task.id)}
                t={t}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="dashboard-day-grid">
        <section className="register-section" aria-labelledby="today-hearings-title">
          <div className="panel-heading">
            <h3 id="today-hearings-title">{t('dashboard.todayEvents')}</h3>
            <Link className="text-link" to={`/calendar?date=${date}`}>
              {t('dashboard.viewCalendar')}
            </Link>
          </div>
          {todayHearings.length ? (
            <ul className="agenda-timeline">
              {todayHearings.map((hearing) => (
                <HearingRow
                  key={hearing.id}
                  hearing={hearing}
                  caseItem={caseFor(hearing.caseId)}
                  time={hearing.hearingTime ? format.time(hearing.hearingTime) : null}
                  t={t}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote
              title={t('dashboard.noEvents')}
              hint={t('dashboard.noEventsHint')}
              icon="calendar"
            />
          )}
        </section>

        <section className="register-section" aria-labelledby="today-tasks-title">
          <div className="panel-heading">
            <h3 id="today-tasks-title">{t('dashboard.todayTasks')}</h3>
            <Link className="text-link" to="/tasks">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {summary.todayTasks.length ? (
            <ul className="work-rows">
              {summary.todayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  context={taskContext(task, caseFor, clientFor, t)}
                  pending={complete.isPending}
                  onComplete={() => complete.mutate(task.id)}
                  t={t}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote
              title={t('dashboard.noTasks')}
              hint={t('dashboard.noTasksHint')}
              icon="tasks"
            />
          )}
          {complete.isError && (
            <Alert variant="destructive">
              <AlertDescription>{t('tasks.statusError')}</AlertDescription>
            </Alert>
          )}
        </section>
      </div>

      <section className="register-section" aria-labelledby="upcoming-title">
        <div className="panel-heading">
          <h3 id="upcoming-title">{t('dashboard.upcomingHearings')}</h3>
          <Link className="text-link" to="/calendar">
            {t('dashboard.viewCalendar')}
          </Link>
        </div>
        {upcoming.length ? (
          <ul className="upcoming-list">
            {upcoming.slice(0, 8).map((hearing) => {
              const caseItem = caseFor(hearing.caseId);
              const days = daysBetween(date, hearing.hearingDate);
              return (
                <li key={hearing.id}>
                  <time className="upcoming-date" dateTime={hearing.hearingDate}>
                    <strong>{format.dateCompact(hearing.hearingDate)}</strong>
                    <span>
                      {days === 1
                        ? t('dashboard.tomorrow')
                        : t('dashboard.inDays', { count: days })}
                    </span>
                  </time>
                  <div className="upcoming-copy">
                    <Link to={`/calendar?hearing=${hearing.id}`}>
                      <bdi dir="auto">{hearing.hearingType ?? t('dashboard.legalEvent')}</bdi>
                      {hearing.hearingTime && (
                        <span className="muted">
                          {' · '}
                          <bdi>{format.time(hearing.hearingTime)}</bdi>
                        </span>
                      )}
                    </Link>
                    <span dir="auto">
                      {caseContext(caseItem, t, format.list)}
                      {hearing.location && ` · ${hearing.location}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyNote title={t('dashboard.noUpcomingHearings')} icon="calendar" />
        )}
      </section>

      <div className="dashboard-registers">
        <RecordList
          title={t('dashboard.casesTitle')}
          viewAll="/cases"
          empty={t('cases.empty')}
          items={(cases.data ?? []).slice(0, 5).map((item: CaseSummary) => ({
            id: item.id,
            to: `/cases/${item.id}`,
            primary: item.internalNumber,
            secondary: format.list(item.clientNames),
          }))}
          t={t}
        />
        <RecordList
          title={t('dashboard.clientsTitle')}
          viewAll="/clients"
          empty={t('clients.empty')}
          items={(clients.data ?? []).slice(0, 5).map((client: ClientSummary) => ({
            id: client.id,
            to: `/clients/${client.id}`,
            primary: client.fullName,
            secondary: client.internalNumber,
          }))}
          t={t}
        />
      </div>
    </section>
  );
}

function StatLink({
  to,
  icon,
  value,
  label,
  tone,
}: {
  to: string;
  icon: IconName;
  value: number;
  label: string;
  tone?: 'danger';
}) {
  return (
    <Link to={to} role="listitem" className={`today-stat${tone ? ` tone-${tone}` : ''}`}>
      <span className="today-stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="today-stat-copy">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
    </Link>
  );
}

function HearingRow({
  hearing,
  caseItem,
  time,
  t,
}: {
  hearing: HearingDto;
  caseItem?: CaseSummary;
  time: string | null;
  t: Translate;
}) {
  const format = useFormat();
  const place = [hearing.location, hearing.circuitName].filter(Boolean).join(' · ');
  return (
    <li>
      <time className={time ? undefined : 'all-day'}>{time ?? t('dashboard.allDay')}</time>
      <div>
        <Link to={`/calendar?hearing=${hearing.id}`}>
          <bdi dir="auto">{hearing.hearingType ?? t('dashboard.legalEvent')}</bdi>
        </Link>
        <span dir="auto">{caseContext(caseItem, t, format.list)}</span>
        {place && <span dir="auto">{place}</span>}
        {hearing.requiredDocuments && (
          <small className="preparation-context" dir="auto">
            {t('dashboard.preparation')}: {hearing.requiredDocuments}
          </small>
        )}
      </div>
    </li>
  );
}

function TaskRow({
  task,
  context,
  meta,
  overdue,
  pending,
  onComplete,
  t,
}: {
  task: TaskDto;
  context: string;
  meta?: string;
  overdue?: boolean;
  pending: boolean;
  onComplete: () => void;
  t: Translate;
}) {
  return (
    <li className={overdue ? 'is-overdue' : undefined}>
      <Checkbox
        checked={false}
        disabled={pending}
        onCheckedChange={(checked) => checked && onComplete()}
        aria-label={t('tasks.completeAria', { title: task.title })}
      />
      <div>
        <Link to={`/tasks?task=${task.id}`} dir="auto">
          <bdi>{task.title}</bdi>
        </Link>
        <span dir="auto">{context}</span>
      </div>
      {meta && <span className="row-meta">{meta}</span>}
    </li>
  );
}

function EmptyNote({ title, hint, icon }: { title: string; hint?: string; icon: IconName }) {
  return (
    <div className="empty-compact">
      <Icon name={icon} size={22} />
      <div>
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

function RecordList({
  title,
  viewAll,
  empty,
  items,
  t,
}: {
  title: string;
  viewAll: string;
  empty: string;
  items: { id: string; to: string; primary: string; secondary: string }[];
  t: Translate;
}) {
  return (
    <section className="register-section">
      <div className="panel-heading">
        <h3>{title}</h3>
        <Link className="text-link" to={viewAll}>
          {t('dashboard.viewAll')}
        </Link>
      </div>
      {items.length ? (
        <ul className="record-links">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.to} dir="auto">
                <bdi>{item.primary}</bdi>
              </Link>
              <span dir="auto">{item.secondary}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

function caseContext(
  item: CaseSummary | undefined,
  t: Translate,
  list: (items: readonly string[]) => string,
) {
  return item
    ? t('dashboard.caseContext', {
        caseNumber: item.internalNumber,
        clients: list(item.clientNames),
      })
    : t('dashboard.caseContextUnavailable');
}

function taskContext(
  task: TaskDto,
  caseFor: (id: string | null) => CaseSummary | undefined,
  clientFor: (id: string | null) => ClientSummary | undefined,
  t: Translate,
) {
  const caseItem = caseFor(task.caseId);
  const client = clientFor(task.clientId);
  if (caseItem) return t('dashboard.taskCaseContext', { caseNumber: caseItem.internalNumber });
  if (client) return t('dashboard.taskClientContext', { clientName: client.fullName });
  return t('dashboard.taskNoContext');
}
