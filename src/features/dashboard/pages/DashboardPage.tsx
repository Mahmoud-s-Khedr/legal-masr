import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { bridge } from '../../../bridge/commands';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { queryKeys } from '../../../lib/queryKeys';
import { localDateOnly } from '../../../lib/dateOnly';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

const today = () => localDateOnly();
export function DashboardPage() {
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
          <h2>اليوم</h2>
          <p>جلساتك ومهامك القانونية لهذا اليوم.</p>
        </div>
        <div className="quick-actions">
          <Button asChild className="button-link">
            <Link to="/calendar">
            إضافة جلسة
            </Link>
          </Button>
          <Button variant="secondary" asChild className="button-link secondary-link">
            <Link to="/tasks">
            إضافة مهمة
            </Link>
          </Button>
        </div>
      </header>
      <div className="dashboard-day-grid">
        <Card className="register-section">
          <h3>جلسات اليوم</h3>
          {agenda.data?.todayHearings.length ? (
            <ul className="agenda-timeline">
              {agenda.data.todayHearings.map((hearing) => (
                <li key={hearing.id}>
                  <time>{hearing.hearingTime ?? 'طوال اليوم'}</time>
                  <div>
                    <Link to={`/calendar?hearing=${hearing.id}`}>
                      {hearing.hearingType ?? 'جلسة'}
                    </Link>
                    <span>{hearing.location ?? '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد جلسات اليوم.</p>
          )}
        </Card>
        <Card className="register-section">
          <h3>مهام اليوم</h3>
          {agenda.data?.todayTasks.length ? (
            <ul className="task-preview-list">
              {agenda.data.todayTasks.map((task) => (
                <li key={task.id}>
                  <Link to={`/tasks?task=${task.id}`}>{task.title}</Link>
                  <span>{task.dueDate}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد مهام اليوم.</p>
          )}
        </Card>
      </div>
      <Card className="attention-panel">
        <h3>تحتاج إلى متابعة</h3>
        {agenda.data?.overdueTasks.length ? (
          <ul>
            {agenda.data.overdueTasks.map((task) => (
              <li key={task.id}>
                {task.title} · {task.dueDate}
              </li>
            ))}
          </ul>
        ) : (
          <p>لا توجد مهام متأخرة.</p>
        )}
      </Card>
      <div className="dashboard-registers">
        <Card className="register-section">
          <h3>الموكلون</h3>
          <ul>
            {clients.data?.slice(0, 5).map((client) => (
              <li key={client.id}>
                <Link to={`/clients/${client.id}`}>{client.fullName}</Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="register-section">
          <h3>القضايا</h3>
          <ul>
            {cases.data?.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link to={`/cases/${item.id}`}>{item.internalNumber}</Link> ·{' '}
                {item.clientNames.join('، ')}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
