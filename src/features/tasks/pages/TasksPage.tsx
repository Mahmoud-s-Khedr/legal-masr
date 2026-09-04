import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskDto, TaskInput } from '../../../bridge/types';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import {
  useCompleteTask,
  useDeleteTask,
  useReopenTask,
  useSaveTask,
  useTaskList,
} from '../api/tasksApi';
import { localDateOnly } from '../../../lib/dateOnly';

const localDate = () => localDateOnly();
const labels = {
  TODAY: 'اليوم',
  OVERDUE: 'متأخرة',
  UPCOMING: 'قادمة',
  COMPLETED: 'مكتملة',
  ALL: 'الكل',
} as const;

export function TasksPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState<keyof typeof labels>('TODAY');
  const [editing, setEditing] = useState<TaskDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<TaskDto | null>(null);
  const [caseId, setCaseId] = useState(params.get('case') ?? '');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const tasks = useTaskList({
    view,
    referenceDate: localDate(),
    caseId: caseId || undefined,
    clientId: clientId || undefined,
  });
  const cases = useCaseList({});
  const clients = useClientList({});
  const save = useSaveTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const remove = useDeleteTask();
  return (
    <section className="work-page">
      <PageHeader
        kicker="المهام"
        title="المهام القانونية"
        description="تُشتق الحالة من تاريخ الاستحقاق والإتمام؛ لا توجد أولوية أو وقت أو مسؤول في هذا الإصدار."
        actions={
          <button type="button" onClick={() => setEditing('new')}>
            إضافة مهمة
          </button>
        }
      />
      <Tabs
        label="تصفية المهام"
        value={view}
        onChange={(value) => setView(value as keyof typeof labels)}
        tabs={Object.entries(labels).map(([id, label]) => ({ id, label }))}
      />
      <div className="finance-filters">
        <label>
          القضية
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">كل القضايا</option>
            {cases.data?.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">كل الموكلين</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setCaseId('');
            setClientId('');
          }}
        >
          مسح التصفية
        </button>
      </div>
      <section className="work-register">
        <div className="card-title">
          <div>
            <h3>{labels[view]}</h3>
            <p className="muted">{tasks.data?.length ?? 0} مهمة</p>
          </div>
        </div>
        {!tasks.data?.length ? (
          <p className="empty-compact">لا توجد مهام في هذا العرض.</p>
        ) : (
          <ul className="record-list task-records">
            {tasks.data.map((task) => (
              <li key={task.id}>
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => (task.completed ? reopen : complete).mutate(task.id)}
                    aria-label={`${task.completed ? 'إعادة فتح' : 'إتمام'} ${task.title}`}
                  />
                  <span
                    className={task.completed ? 'task-status done' : 'task-status'}
                    aria-hidden="true"
                  />
                </label>
                <div className="record-copy">
                  <strong>{task.title}</strong>
                  <span>
                    <bdi>{task.dueDate}</bdi>
                    {task.details && ` · ${task.details}`}
                    {task.notes && ` · ${task.notes}`}
                  </span>
                </div>
                <span className={`status-chip ${task.completed ? 'completed' : ''}`}>
                  {task.completed
                    ? 'مكتملة'
                    : task.dueDate < localDate()
                      ? 'متأخرة'
                      : task.dueDate === localDate()
                        ? 'اليوم'
                        : 'قادمة'}
                </span>
                <button type="button" className="text-button" onClick={() => setEditing(task)}>
                  تفاصيل
                </button>
                <button
                  type="button"
                  className="text-button danger-button"
                  onClick={() => setRemoving(task)}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? 'إضافة مهمة' : 'تفاصيل المهمة'}
      >
        {editing && (
          <TaskForm
            initial={editing === 'new' ? undefined : editing}
            initialCaseId={editing === 'new' ? caseId : undefined}
            initialClientId={editing === 'new' ? clientId : undefined}
            cases={cases.data ?? []}
            clients={clients.data ?? []}
            busy={save.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await save.mutateAsync(input);
              setEditing(null);
            }}
          />
        )}
        {save.isError && (
          <p className="error" role="alert">
            تعذر حفظ المهمة. بقيت البيانات المدخلة للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="حذف المهمة"
        description="سيُحذف سجل المهمة نهائيًا. لا يؤثر ذلك في القضية أو الموكل المرتبط."
        confirmLabel="حذف المهمة"
        cancelLabel="إلغاء"
        destructive
        onConfirm={() => {
          if (removing) remove.mutate(removing, { onSuccess: () => setRemoving(null) });
        }}
      />
    </section>
  );
}

function TaskForm({
  initial,
  initialCaseId,
  initialClientId,
  cases,
  clients,
  busy,
  onSave,
  onCancel,
}: {
  initial?: TaskDto;
  initialCaseId?: string;
  initialClientId?: string;
  cases: ReturnType<typeof useCaseList>['data'];
  clients: ReturnType<typeof useClientList>['data'];
  busy: boolean;
  onSave: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? localDate());
  const [caseId, setCaseId] = useState(initial?.caseId ?? initialCaseId ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? initialClientId ?? '');
  const [details, setDetails] = useState(initial?.details ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave({
          id: initial?.id,
          title: title.trim(),
          dueDate,
          caseId: caseId || undefined,
          clientId: clientId || undefined,
          details: details || undefined,
          notes: notes || undefined,
        });
      }}
    >
      <label>
        المهمة{' '}
        <input
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          تاريخ الاستحقاق{' '}
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
            <option value="">غير مرتبطة بقضية</option>
            {cases?.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.internalNumber}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        الموكل
        <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">غير مرتبط بموكل</option>
          {clients?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        التفاصيل <textarea value={details} onChange={(event) => setDetails(event.target.value)} />
      </label>
      <label>
        ملاحظات <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
        <button disabled={busy}>حفظ المهمة</button>
      </div>
    </form>
  );
}
