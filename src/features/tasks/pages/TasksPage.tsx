import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useCompleteTask, useCreateTask, useReopenTask, useTaskList } from '../api/tasksApi';

const localDate = () => new Date().toISOString().slice(0, 10);
export function TasksPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState<'TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED' | 'ALL'>('TODAY');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(localDate());
  const [caseId, setCaseId] = useState(params.get('case') ?? '');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const [details, setDetails] = useState('');
  const tasks = useTaskList({
    view,
    referenceDate: localDate(),
    caseId: caseId || undefined,
    clientId: clientId || undefined,
  });
  const create = useCreateTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const cases = useCaseList({});
  const clients = useClientList({});
  return (
    <section className="work-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المهام</p>
          <h2>المهام القانونية</h2>
          <p>تُشتق حالة المهمة من تاريخها وإتمامها، من دون أولوية أو وقت.</p>
        </div>
      </header>
      <form
        className="quick-entry"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(
            {
              title,
              dueDate,
              caseId: caseId || undefined,
              clientId: clientId || undefined,
              details: details || undefined,
              notes: undefined,
              reminderMinutes: undefined,
            },
            {
              onSuccess: () => {
                setTitle('');
                setDetails('');
              },
            },
          );
        }}
      >
        <label>
          المهمة
          <input required value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          تاريخ الاستحقاق
          <input
            required
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label>
          القضية
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">—</option>
            {cases.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">—</option>
            {clients.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          التفاصيل
          <input value={details} onChange={(event) => setDetails(event.target.value)} />
        </label>
        <button disabled={create.isPending}>إضافة</button>
      </form>
      <div className="segmented">
        {(['TODAY', 'OVERDUE', 'UPCOMING', 'COMPLETED', 'ALL'] as const).map((item) => (
          <button
            key={item}
            className={view === item ? 'active' : ''}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="record-list">
        {tasks.data?.map((task) => (
          <li key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => (task.completed ? reopen : complete).mutate(task.id)}
              aria-label={`إتمام ${task.title}`}
            />
            <div>
              <strong>{task.title}</strong>
              <span>
                {task.dueDate}
                {task.details ? ` · ${task.details}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
