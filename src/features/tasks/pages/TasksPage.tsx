import { fieldError } from '@/lib/fieldError';
import { DraftForm } from '@/components/forms/DraftForm';
import { actionableErrorMessage } from '@/bridge/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { taskDraftSchema } from '@/lib/formSchemas';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskDto, TaskInput } from '../../../bridge/types';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { ConfirmDialog, FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';

import { Textarea } from '../../../components/ui/textarea';
import { useCaseList } from '../../cases/api/casesApi';
import { caseOption, clientOption } from '../../cases/components/caseOptions';
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
// Overdue must stand out from upcoming at a glance, as it does on the Today page.
const taskBadgeVariant = {
  overdue: 'destructive',
  today: 'default',
  upcoming: 'secondary',
  completed: 'outline',
} as const;

export function TasksPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedTaskId = params.get('task');
  const createIntent = params.get('create') === 'task';
  const [newTaskDate, setNewTaskDate] = useState<string | undefined>(undefined);
  const requestedView = views.find((candidate) => candidate === params.get('view'));
  const [view, setView] = useState<(typeof views)[number]>(
    requestedTaskId ? 'ALL' : (requestedView ?? 'TODAY'),
  );
  const format = useFormat();
  const [editing, setEditing] = useState<TaskDto | 'new' | null>(null);
  // «إضافة مهمة» links carry ?create=task (and maybe ?date=). Treat them as a one-time
  // request: open the form, then drop them so the same link works again from this page.
  const [createHandled, setCreateHandled] = useState(false);
  if (createIntent && !createHandled) {
    setCreateHandled(true);
    setNewTaskDate(params.get('date') ?? undefined);
    setEditing('new');
  } else if (!createIntent && createHandled) {
    setCreateHandled(false);
  }
  useEffect(() => {
    if (!createIntent) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('create');
        next.delete('date');
        return next;
      },
      { replace: true },
    );
  }, [createIntent, setParams]);
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
  const cases = useCaseList({ includeArchived: true });
  const clients = useClientList({});
  const save = useSaveTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const remove = useDeleteTask();

  useEffect(() => {
    if (!requestedTaskId || !tasks.data || handledTaskId.current === requestedTaskId) return;
    const task = tasks.data.find((item) => item.id === requestedTaskId);
    if (
      task &&
      (!task.caseId || cases.data?.some((item) => item.id === task.caseId && !item.archivedAt))
    ) {
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
  }, [requestedTaskId, tasks.data, cases.data]);

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
          <Button
            type="button"
            onClick={() => {
              setNewTaskDate(undefined);
              setEditing('new');
            }}
          >
            {t('tasks.add')}
          </Button>
        }
      />
      <Tabs
        value={view}
        onValueChange={(value) =>
          ((value) => setView(value as (typeof views)[number]))(String(value))
        }
      >
        <TabsList activateOnFocus aria-label={t('tasks.filter')} variant={'default'}>
          {views
            .map((id) => ({ id, label: t(`tasks.views.${id}`) }))
            .map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>
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
          <EntityPicker
            emptyText={t('cases.noResults')}
            value={caseId}
            onValueChange={(value) => setCaseId(value ?? '')}
            items={[
              { value: '', label: t('tasks.allCases') },
              ...(cases.data ?? []).map(caseOption),
            ]}
            placeholder={t('tasks.allCases')}
          />
        </label>
        <label>
          {t('tasks.client')}
          <EntityPicker
            value={clientId}
            onValueChange={(value) => setClientId(value ?? '')}
            items={[
              { value: '', label: t('tasks.allClients') },
              ...(clients.data ?? []).map(clientOption),
            ]}
            placeholder={t('tasks.allClients')}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
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
          <Alert variant="destructive">
            <AlertDescription>{t('app.loadError')}</AlertDescription>
          </Alert>
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
                    disabled={
                      complete.isPending ||
                      reopen.isPending ||
                      Boolean(task.caseId && (!linkedCase || linkedCase.archivedAt))
                    }
                    onCheckedChange={() => (task.completed ? reopen : complete).mutate(task.id)}
                    aria-label={t(task.completed ? 'tasks.reopenAria' : 'tasks.completeAria', {
                      title: task.title,
                    })}
                  />
                  <div>
                    <button
                      type="button"
                      className="link-button task-title"
                      disabled={Boolean(task.caseId && (!linkedCase || linkedCase.archivedAt))}
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
                  <Badge variant={taskBadgeVariant[state]}>{t(`tasks.${state}`)}</Badge>
                  <Button
                    type="button"
                    variant="ghost"

                    disabled={Boolean(task.caseId && (!linkedCase || linkedCase.archivedAt))}
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
          <Alert variant="destructive">
            <AlertDescription>{t('tasks.statusError')}</AlertDescription>
          </Alert>
        )}
      </section>
      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? t('tasks.add') : t('tasks.details')}
      >
        {editing && (
          <TaskForm
            initial={editing === 'new' ? undefined : editing}
            initialCaseId={editing === 'new' ? caseId : undefined}
            initialClientId={editing === 'new' ? clientId : undefined}
            initialDate={editing === 'new' ? newTaskDate : undefined}
            cases={cases.data?.filter((item) => !item.archivedAt) ?? []}
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
          <Alert variant="destructive">
            <AlertDescription>
              {actionableErrorMessage(save.error, t('tasks.saveError'))}
            </AlertDescription>
          </Alert>
        )}
        {(complete.isError || reopen.isError) && (
          <Alert variant="destructive">
            <AlertDescription>{t('tasks.statusError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('tasks.deleteTitle')}
        description={t('tasks.deleteDescription')}
        confirmLabel={t('tasks.deleteTitle')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        error={remove.isError ? t('tasks.deleteError') : undefined}
        onConfirm={() => {
          if (removing && !remove.isPending)
            remove.mutate(removing, { onSuccess: () => setRemoving(null) });
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
  const form = useForm<z.infer<typeof taskDraftSchema>>({
    resolver: zodResolver(taskDraftSchema),
    defaultValues: {
      title: initial?.title ?? '',
      dueDate: initial?.dueDate ?? initialDate ?? localDate(),
      caseId: initial?.caseId ?? initialCaseId ?? '',
      clientId: initial?.clientId ?? initialClientId ?? '',
      details: initial?.details ?? '',
      notes: initial?.notes ?? '',
    },
  });

  const title = useWatch({ control: form.control, name: 'title' });
  const setTitle = (value: string) =>
    form.setValue('title', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const dueDate = useWatch({ control: form.control, name: 'dueDate' });
  const setDueDate = (value: string) =>
    form.setValue('dueDate', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const caseId = useWatch({ control: form.control, name: 'caseId' });
  const setCaseId = (value: string) =>
    form.setValue('caseId', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const clientId = useWatch({ control: form.control, name: 'clientId' });
  const setClientId = (value: string) =>
    form.setValue('clientId', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const details = useWatch({ control: form.control, name: 'details' });
  const setDetails = (value: string) =>
    form.setValue('details', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  const notes = useWatch({ control: form.control, name: 'notes' });
  const setNotes = (value: string) =>
    form.setValue('notes', value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  return (
    <DraftForm
      control={form.control}
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSave({
            id: initial?.id,
            title: values.title.trim(),
            dueDate: values.dueDate,
            caseId: values.caseId || undefined,
            clientId: values.clientId || undefined,
            details: values.details || undefined,
            notes: values.notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      })}
    >
      <FieldGroup>
        <Field
          label={<>{t('tasks.task')}</>}
          required
          error={fieldError(form.formState.errors.title, t)}
        >
          <Input
            required
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            ref={(node) => form.register('title').ref(node)}
            aria-invalid={!!form.formState.errors.title}
          />
        </Field>
        <div className="settings-two-columns">
          <Field
            label={<>{t('tasks.dueDate')}</>}
            required
            error={fieldError(form.formState.errors.dueDate, t)}
          >
            <DatePicker
              required
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              ref={(node) => form.register('dueDate').ref(node)}
              aria-invalid={!!form.formState.errors.dueDate}
            />
          </Field>
          <Field
            label={<>{t('tasks.case')}</>}
            error={form.formState.errors.caseId ? t('forms.invalid') : undefined}
          >
            <EntityPicker
              emptyText={t('cases.noResults')}
              value={caseId}
              onValueChange={(value) => setCaseId(value ?? '')}
              items={[{ value: '', label: t('tasks.noCase') }, ...(cases ?? []).map(caseOption)]}
              placeholder={undefined}
            />
          </Field>
        </div>
        <Field
          label={<>{t('tasks.client')}</>}
          error={form.formState.errors.clientId ? t('forms.invalid') : undefined}
        >
          <EntityPicker
            value={clientId}
            onValueChange={(value) => setClientId(value ?? '')}
            items={[
              { value: '', label: t('tasks.noClient') },
              ...(clients ?? []).map(clientOption),
            ]}
            placeholder={undefined}
          />
        </Field>
        <Field
          label={<>{t('tasks.fieldDetails')}</>}
          error={form.formState.errors.details ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            ref={(node) => form.register('details').ref(node)}
            aria-invalid={!!form.formState.errors.details}
          />
        </Field>
        <Field
          label={<>{t('common.notes')}</>}
          error={form.formState.errors.notes ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            ref={(node) => form.register('notes').ref(node)}
            aria-invalid={!!form.formState.errors.notes}
          />
        </Field>
        {initial && onToggleCompletion && (
          <div className="dialog-inline-action">
            <span>
              {t('tasks.status')}: {initial.completed ? t('tasks.completed') : t('tasks.open')}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={toggling}
              onClick={onToggleCompletion}
            >
              {initial.completed ? t('tasks.reopen') : t('tasks.complete')}
            </Button>
          </div>
        )}
        <FormDialogFooter>
          <Button type="button" variant="secondary" data-draft-cancel onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('tasks.save')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
