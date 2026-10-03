import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskDto, TaskInput } from '../../../bridge/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
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
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">المهام</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">المهام القانونية</h1>
          <p className="mt-1 text-muted-foreground">تُشتق الحالة من تاريخ الاستحقاق والإتمام؛ لا توجد أولوية أو وقت أو مسؤول في هذا الإصدار.</p>
        </div>
        <Button type="button" onClick={() => setEditing('new')}>
          إضافة مهمة
        </Button>
      </header>
      <Tabs
        label="تصفية المهام"
        value={view}
        onChange={(value) => setView(value as keyof typeof labels)}
        tabs={Object.entries(labels).map(([id, label]) => ({ id, label }))}
      />
      <div className="finance-filters">
        <label>
          القضية
          <Select
            value={caseId}
            onValueChange={setCaseId}
            items={[
              { value: '', label: 'كل القضايا' },
              ...(cases.data ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
            ]}
          />
        </label>
        <label>
          الموكل
          <Select
            value={clientId}
            onValueChange={setClientId}
            items={[
              { value: '', label: 'كل الموكلين' },
              ...(clients.data ?? []).map((item) => ({ value: item.id, label: item.fullName })),
            ]}
          />
        </label>
        <Button
          type="button"
          className="secondary-button"
          onClick={() => {
            setCaseId('');
            setClientId('');
          }}
        >
          مسح التصفية
        </Button>
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
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => (task.completed ? reopen : complete).mutate(task.id)}
                    aria-label={`${task.completed ? 'إعادة فتح' : 'إتمام'} ${task.title}`}
                  />
                  <span
                    className={task.completed ? 'task-status done' : 'task-status'}
                    aria-hidden="true"
                  />
                </label>
                <div className="record-copy">
                  <Button
                    type="button"
                    className="text-button task-title"
                    onClick={() => setEditing(task)}
                  >
                    {task.title}
                  </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setEditing(task)}
                >
                  تفاصيل
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button danger-button"
                  onClick={() => setRemoving(task)}
                >
                  حذف
                </Button>
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
            onToggleCompletion={
              editing === 'new'
                ? undefined
                : () => (editing.completed ? reopen : complete).mutate(editing.id)
            }
            toggling={complete.isPending || reopen.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              try {
                await save.mutateAsync(input);
                setEditing(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        )}
        {save.isError && (
          <p className="error" role="alert">
            تعذر حفظ المهمة. بقيت البيانات المدخلة للمحاولة مرة أخرى.
          </p>
        )}
        {(complete.isError || reopen.isError) && (
          <p className="error" role="alert">
            تعذر تغيير حالة المهمة. حاول مرة أخرى.
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

export function TaskForm({
  initial,
  initialCaseId,
  initialClientId,
  cases,
  clients,
  busy,
  onToggleCompletion,
  toggling = false,
  onSave,
  onCancel,
}: {
  initial?: TaskDto;
  initialCaseId?: string;
  initialClientId?: string;
  cases: ReturnType<typeof useCaseList>['data'];
  clients: ReturnType<typeof useClientList>['data'];
  busy: boolean;
  onToggleCompletion?: () => void;
  toggling?: boolean;
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
        try {
          await onSave({
            id: initial?.id,
            title: title.trim(),
            dueDate,
            caseId: caseId || undefined,
            clientId: clientId || undefined,
            details: details || undefined,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      }}
    >
      <label>
        المهمة{' '}
        <Input
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          تاريخ الاستحقاق{' '}
          <DatePicker
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label>
          القضية
          <Select
            value={caseId}
            onValueChange={setCaseId}
            items={[
              { value: '', label: 'غير مرتبطة بقضية' },
              ...(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
            ]}
          />
        </label>
      </div>
      <label>
        الموكل
        <Select
          value={clientId}
          onValueChange={setClientId}
          items={[
            { value: '', label: 'غير مرتبط بموكل' },
            ...(clients ?? []).map((item) => ({ value: item.id, label: item.fullName })),
          ]}
        />
      </label>
      <label>
        التفاصيل <Textarea value={details} onChange={(event) => setDetails(event.target.value)} />
      </label>
      <label>
        ملاحظات <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {initial && onToggleCompletion && (
        <div className="dialog-inline-action">
          <span>الحالة: {initial.completed ? 'مكتملة' : 'مفتوحة'}</span>
          <Button
            type="button"
            className="secondary-button"
            disabled={toggling}
            onClick={onToggleCompletion}
          >
            {initial.completed ? 'إعادة فتح المهمة' : 'إتمام المهمة'}
          </Button>
        </div>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>حفظ المهمة</Button>
      </div>
    </form>
  );
}
