import { useEffect, useRef, useState } from 'react';
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
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';

const localDate = () => localDateOnly();
const views = ['TODAY', 'OVERDUE', 'UPCOMING', 'COMPLETED', 'ALL'] as const;
const TASK_TONE = {
  completed: 'tone-muted',
  overdue: 'tone-danger',
  today: 'tone-warning',
  upcoming: 'tone-active',
} as const;

export function TasksPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const requestedTaskId = params.get('task');
  const createIntent = params.get('create') === 'task';
  const requestedDate = params.get('date') ?? localDate();
  const requestedView = views.find((candidate) => candidate === params.get('view'));
  const [view, setView] = useState<(typeof views)[number]>(
    requestedTaskId ? 'ALL' : (requestedView ?? 'TODAY'),
  );
  const format = useFormat();
  const [editing, setEditing] = useState<TaskDto | 'new' | null>(createIntent ? 'new' : null);
  const [removing, setRemoving] = useState<TaskDto | null>(null);
  const [dismissedUnavailableId, setDismissedUnavailableId] = useState<string | null>(null);
  const handledTaskId = useRef<string | null>(null);
  const [caseId, setCaseId] = useState(params.get('case') ?? '');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const today = localDate();
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

  useEffect(() => {
    if (!requestedTaskId || !tasks.data || handledTaskId.current === requestedTaskId) return;
    const task = tasks.data.find((item) => item.id === requestedTaskId);
    if (task) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        handledTaskId.current = requestedTaskId;
        setEditing(task);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [requestedTaskId, tasks.data]);

  const unavailable = Boolean(
    requestedTaskId &&
    tasks.data &&
    !tasks.data.some((task) => task.id === requestedTaskId) &&
    dismissedUnavailableId !== requestedTaskId,
  );

  return (
    <section className="work-page">
      <PageHeader
        kicker={t('tasks.kicker')}
        title={t('tasks.title')}
        description={t('tasks.description')}
        actions={
          <Button type="button" onClick={() => setEditing('new')}>
            {t('tasks.add')}
          </Button>
        }
      />
      <Tabs
        label={t('tasks.filter')}
        value={view}
        onChange={(value) => setView(value as (typeof views)[number])}
        tabs={views.map((id) => ({ id, label: t(`tasks.views.${id}`) }))}
      />
      {unavailable && (
        <div className="record-unavailable" role="alert">
          <p>{t('tasks.recordUnavailable')}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDismissedUnavailableId(requestedTaskId)}
          >
            {t('tasks.dismissUnavailable')}
          </Button>
        </div>
      )}
      <div className="finance-filters">
        <label>
          {t('tasks.case')}
          <Select
            value={caseId}
            onValueChange={setCaseId}
            placeholder={t('tasks.allCases')}
            items={[
              { value: '', label: t('tasks.allCases') },
              ...(cases.data ?? []).map((item) => ({
                value: item.id,
                label: item.clientNames.length
                  ? `${item.internalNumber} — ${item.clientNames.join('، ')}`
                  : item.internalNumber,
              })),
            ]}
          />
        </label>
        <label>
          {t('tasks.client')}
          <Select
            value={clientId}
            onValueChange={setClientId}
            placeholder={t('tasks.allClients')}
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
        {tasks.isError ? (
          <p className="error" role="alert">
            {t('app.loadError')}
          </p>
        ) : !tasks.data?.length ? (
          <p className="empty-compact">{t(`tasks.emptyViews.${view}`)}</p>
        ) : (
          <ul className="work-rows task-records">
            {tasks.data.map((task) => {
              const state = task.completed
                ? 'completed'
                : task.dueDate < today
                  ? 'overdue'
                  : task.dueDate === today
                    ? 'today'
                    : 'upcoming';
              const linkedCase = task.caseId
                ? cases.data?.find((item) => item.id === task.caseId)
                : undefined;
              const linkedClient = task.clientId
                ? clients.data?.find((item) => item.id === task.clientId)
                : undefined;
              return (
                <li key={task.id} className={task.completed ? 'is-done' : undefined}>
                  <Checkbox
                    checked={task.completed}
                    disabled={complete.isPending || reopen.isPending}
                    onCheckedChange={() => (task.completed ? reopen : complete).mutate(task.id)}
                    aria-label={t(task.completed ? 'tasks.reopenAria' : 'tasks.completeAria', {
                      title: task.title,
                    })}
                  />
                  <div>
                    <button
                      type="button"
                      className="link-button task-title"
                      onClick={() => setEditing(task)}
                    >
                      <bdi dir="auto">{task.title}</bdi>
                    </button>
                    <span>
                      <time dateTime={task.dueDate}>{format.date(task.dueDate)}</time>
                      {linkedCase && (
                        <>
                          {' · '}
                          <bdi>{linkedCase.internalNumber}</bdi>
                        </>
                      )}
                      {!linkedCase && linkedClient && (
                        <>
                          {' · '}
                          <bdi>{linkedClient.fullName}</bdi>
                        </>
                      )}
                      {task.details && (
                        <>
                          {' · '}
                          <bdi dir="auto">{task.details}</bdi>
                        </>
                      )}
                    </span>
                  </div>
                  <span className={`status-badge ${TASK_TONE[state]}`}>{t(`tasks.${state}`)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-button quiet-button"
                    aria-label={t('tasks.deleteAria', { title: task.title })}
                    onClick={() => setRemoving(task)}
                  >
                    {t('tasks.delete')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {(complete.isError || reopen.isError) && !editing && (
          <p className="error" role="alert">
            {t('tasks.statusError')}
          </p>
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
            initialDate={editing === 'new' ? requestedDate : undefined}
            cases={cases.data ?? []}
            clients={clients.data ?? []}
            busy={save.isPending}
            onToggleCompletion={
              editing === 'new'
                ? undefined
                : () =>
                    (editing.completed ? reopen : complete).mutate(editing.id, {
                      onSuccess: (updated) => setEditing(updated),
                    })
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
  initialDate,
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
  initialDate?: string;
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
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? initialDate ?? localDate());
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
        {t('tasks.task')}{' '}
        <Input
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          {t('tasks.dueDate')}{' '}
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
        {t('tasks.fieldDetails')}{' '}
        <Textarea value={details} onChange={(event) => setDetails(event.target.value)} />
      </label>
      <label>
        {t('common.notes')}{' '}
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {initial && onToggleCompletion && (
        <div className="dialog-inline-action">
          <span>
            {t('tasks.status')}: {initial.completed ? t('tasks.completed') : t('tasks.open')}
          </span>
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
