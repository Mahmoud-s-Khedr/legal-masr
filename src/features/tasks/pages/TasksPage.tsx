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
import { useTranslation } from 'react-i18next';

const localDate = () => localDateOnly();
const views = ['TODAY', 'OVERDUE', 'UPCOMING', 'COMPLETED', 'ALL'] as const;

export function TasksPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [view, setView] = useState<(typeof views)[number]>('TODAY');
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
          <p className="kicker">{t('tasks.kicker')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{t('tasks.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('tasks.description')}</p>
        </div>
        <Button type="button" onClick={() => setEditing('new')}>
          {t('tasks.add')}
        </Button>
      </header>
      <Tabs
        label={t('tasks.filter')}
        value={view}
        onChange={(value) => setView(value as (typeof views)[number])}
        tabs={views.map((id) => ({ id, label: t(`tasks.views.${id}`) }))}
      />
      <div className="finance-filters">
        <label>
          {t('tasks.case')}
          <Select
            value={caseId}
            onValueChange={setCaseId}
            items={[
              { value: '', label: t('tasks.allCases') },
              ...(cases.data ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
            ]}
          />
        </label>
        <label>
          {t('tasks.client')}
          <Select
            value={clientId}
            onValueChange={setClientId}
            items={[
              { value: '', label: t('tasks.allClients') },
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
          {t('tasks.clearFilters')}
        </Button>
      </div>
      <section className="work-register">
        <div className="card-title">
          <div>
            <h3>{t(`tasks.views.${view}`)}</h3>
            <p className="muted">{t('tasks.count', { count: tasks.data?.length ?? 0 })}</p>
          </div>
        </div>
        {!tasks.data?.length ? (
          <p className="empty-compact">{t('tasks.empty')}</p>
        ) : (
          <ul className="record-list task-records">
            {tasks.data.map((task) => (
              <li key={task.id}>
                <label className="task-check">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => (task.completed ? reopen : complete).mutate(task.id)}
                    aria-label={t(task.completed ? 'tasks.reopenAria' : 'tasks.completeAria', { title: task.title })}
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
                  <bdi dir="auto">{task.title}</bdi>
                  </Button>
                  <span>
                    <bdi>{task.dueDate}</bdi>
                    {task.details && <> · <bdi dir="auto">{task.details}</bdi></>}
                    {task.notes && <> · <bdi dir="auto">{task.notes}</bdi></>}
                  </span>
                </div>
                <span className={`status-chip ${task.completed ? 'completed' : ''}`}>
                  {task.completed
                    ? t('tasks.completed')
                    : task.dueDate < localDate()
                      ? t('tasks.overdue')
                      : task.dueDate === localDate()
                        ? t('tasks.today')
                        : t('tasks.upcoming')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setEditing(task)}
                >
                  {t('tasks.details')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button danger-button"
                  onClick={() => setRemoving(task)}
                >
                  {t('tasks.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? t('tasks.add') : t('tasks.details')}
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
            {t('tasks.saveError')}
          </p>
        )}
        {(complete.isError || reopen.isError) && (
          <p className="error" role="alert">
            {t('tasks.statusError')}
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('tasks.deleteTitle')}
        description={t('tasks.deleteDescription')}
        confirmLabel={t('tasks.deleteTitle')}
        cancelLabel={t('common.cancel')}
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
  const { t } = useTranslation();
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
        {t('tasks.task')} {' '}
        <Input
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          {t('tasks.dueDate')} {' '}
          <DatePicker
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label>
          {t('tasks.case')}
          <Select
            value={caseId}
            onValueChange={setCaseId}
            items={[
              { value: '', label: t('tasks.noCase') },
              ...(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
            ]}
          />
        </label>
      </div>
      <label>
        {t('tasks.client')}
        <Select
          value={clientId}
          onValueChange={setClientId}
          items={[
            { value: '', label: t('tasks.noClient') },
            ...(clients ?? []).map((item) => ({ value: item.id, label: item.fullName })),
          ]}
        />
      </label>
      <label>
        {t('tasks.fieldDetails')} <Textarea value={details} onChange={(event) => setDetails(event.target.value)} />
      </label>
      <label>
        {t('common.notes')} <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {initial && onToggleCompletion && (
        <div className="dialog-inline-action">
          <span>{t('tasks.status')}: {initial.completed ? t('tasks.completed') : t('tasks.open')}</span>
          <Button
            type="button"
            className="secondary-button"
            disabled={toggling}
            onClick={onToggleCompletion}
          >
            {initial.completed ? t('tasks.reopen') : t('tasks.complete')}
          </Button>
        </div>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy}>{t('tasks.save')}</Button>
      </div>
    </form>
  );
}
