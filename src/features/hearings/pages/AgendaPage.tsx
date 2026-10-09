import { fieldError } from '@/lib/fieldError';
import { DraftForm } from '@/components/forms/DraftForm';
import { actionableErrorMessage } from '@/bridge/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreatableCombobox } from '@/components/forms/CreatableCombobox';
import { TimeField } from '@/components/forms/TimeField';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { hearingDraftSchema, decisionDraftSchema } from '@/lib/formSchemas';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { HearingDto, HearingInput, TaskDto } from '../../../bridge/types';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog, FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';

import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';

import { Textarea } from '../../../components/ui/textarea';
import { Icon } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat, useLocalePresentation } from '../../../i18n/LocalePresentation';
import { dateOnlyToLocalDate, localDateOnly } from '../../../lib/dateOnly';
import { useCaseList } from '../../cases/api/casesApi';
import { useTaskList } from '../../tasks/api/tasksApi';
import {
  useDeleteHearing,
  useHearings,
  useRecordHearingDecision,
  useSaveHearing,
} from '../api/hearingsApi';
import { useTranslation } from 'react-i18next';

const localDate = (date = new Date()) => localDateOnly(date);
const plusDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const formatDate = (date: Date) => localDate(date);

export function AgendaPage() {
  const { t } = useTranslation();
  const { weekStartsOn, direction } = useLocalePresentation();
  const format = useFormat();
  const cases = useCaseList({ includeArchived: true });
  const [params] = useSearchParams();
  const requestedHearingId = params.get('hearing');
  const createIntent = params.get('create') === 'hearing';
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(params.get('date') ?? localDate());
  const [editing, setEditing] = useState<HearingDto | 'new' | null>(createIntent ? 'new' : null);
  const [removing, setRemoving] = useState<HearingDto | null>(null);
  const [dismissedUnavailableId, setDismissedUnavailableId] = useState<string | null>(null);
  const handledHearingId = useRef<string | null>(null);
  const remove = useDeleteHearing();
  const [deciding, setDeciding] = useState<HearingDto | null>(null);
  const hearings = useHearings({});
  const tasks = useTaskList({ view: 'ALL', referenceDate: '9999-12-31' });
  const save = useSaveHearing();
  const decide = useRecordHearingDecision();
  const items = useMemo(() => {
    const dates = new Map<string, CalendarDayItems>();
    for (const hearing of hearings.data ?? []) {
      const row = dates.get(hearing.hearingDate) ?? { hearings: [], tasks: [] };
      row.hearings.push(hearing);
      dates.set(hearing.hearingDate, row);
    }
    for (const task of tasks.data ?? []) {
      const row = dates.get(task.dueDate) ?? { hearings: [], tasks: [] };
      row.tasks.push(task);
      dates.set(task.dueDate, row);
    }
    return dates;
  }, [hearings.data, tasks.data]);
  const selected = items.get(selectedDate) ?? { hearings: [], tasks: [] };
  const label = format.monthYear(cursor);
  const caseLabel = (caseId: string) => {
    const item = cases.data?.find((candidate) => candidate.id === caseId);
    return item
      ? t('dashboard.caseContext', {
          caseNumber: item.internalNumber,
          clients: format.list(item.clientNames),
        })
      : t('dashboard.caseContextUnavailable');
  };

  useEffect(() => {
    if (!requestedHearingId || !hearings.data || handledHearingId.current === requestedHearingId)
      return;
    const hearing = hearings.data.find((item) => item.id === requestedHearingId);
    if (hearing) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        handledHearingId.current = requestedHearingId;
        setSelectedDate(hearing.hearingDate);
        setCursor(dateOnlyToLocalDate(hearing.hearingDate));
        // Only scheduled hearings can be edited; a completed one is shown, not opened.
        if (hearing.status === 'SCHEDULED') setEditing(hearing);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [hearings.data, requestedHearingId]);
  const unavailable = Boolean(
    requestedHearingId &&
    hearings.data &&
    !hearings.data.some((hearing) => hearing.id === requestedHearingId) &&
    dismissedUnavailableId !== requestedHearingId,
  );
  const shift = (direction: -1 | 1) =>
    setCursor((current) =>
      view === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
        : plusDays(current, direction * 7),
    );
  if (hearings.isLoading || tasks.isLoading) return <p role="status">{t('agenda.loading')}</p>;
  if (hearings.isError || tasks.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('agenda.loadError')}</AlertDescription>
      </Alert>
    );
  return (
    <section className="calendar-page">
      <PageHeader
        kicker={t('agenda.kicker')}
        title={t('agenda.title')}
        description={t('agenda.description')}
        actions={
          <Button type="button" onClick={() => setEditing('new')}>
            {t('agenda.add')}
          </Button>
        }
      />
      <div className="calendar-toolbar">
        <div className="calendar-period">
          <Button
            type="button"
            variant="secondary"
            className="icon-only"
            aria-label={t('agenda.previousPeriod')}
            onClick={() => shift(-1)}
          >
            <Icon name={direction === 'rtl' ? 'chevron-right' : 'chevron-left'} size={18} />
          </Button>
          <strong aria-live="polite">
            <bdi>{label}</bdi>
          </strong>
          <Button
            type="button"
            variant="secondary"
            className="icon-only"
            aria-label={t('agenda.nextPeriod')}
            onClick={() => shift(1)}
          >
            <Icon name={direction === 'rtl' ? 'chevron-left' : 'chevron-right'} size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"

            onClick={() => {
              setCursor(new Date());
              setSelectedDate(localDate());
            }}
          >
            {t('agenda.goToday')}
          </Button>
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => ((value) => setView(value as typeof view))(String(value))}
        >
          <TabsList activateOnFocus aria-label={t('agenda.viewLabel')} variant={'default'}>
            {[
              { id: 'month', label: t('agenda.views.month') },
              { id: 'week', label: t('agenda.views.week') },
              { id: 'list', label: t('agenda.views.list') },
            ].map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="calendar-layout">
        <section className="calendar-surface">
          {view === 'month' ? (
            <MonthGrid
              cursor={cursor}
              selectedDate={selectedDate}
              items={items}
              onSelect={setSelectedDate}
              weekStartsOn={weekStartsOn}
              weekdayFormatter={(day) => format.weekday(day, 'short')}
              dayLabel={format.dateLong}
              t={t}
            />
          ) : view === 'week' ? (
            <WeekList
              cursor={cursor}
              selectedDate={selectedDate}
              items={items}
              onSelect={setSelectedDate}
              weekStartsOn={weekStartsOn}
              dayLabel={format.dateCompact}
              t={t}
            />
          ) : (
            <AgendaList
              items={items}
              onSelect={setSelectedDate}
              dayLabel={format.dateLong}
              selectedDate={selectedDate}
              t={t}
            />
          )}
        </section>
        <aside className="calendar-detail">
          <p className="kicker">{t('agenda.dayDetails')}</p>
          <h3>
            <time dateTime={selectedDate}>{format.dateLong(selectedDate)}</time>
          </h3>
          {unavailable && (
            <div className="record-unavailable" role="alert">
              <p>{t('agenda.recordUnavailable')}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDismissedUnavailableId(requestedHearingId)}
              >
                {t('agenda.dismissUnavailable')}
              </Button>
            </div>
          )}
          {!selected.hearings.length && !selected.tasks.length && (
            <div className="empty-compact">
              <div>
                <strong>{t('agenda.emptyDay')}</strong>
                <Button
                  type="button"
                  variant="ghost"

                  onClick={() => setEditing('new')}
                >
                  {t('agenda.addOnDay')}
                </Button>
              </div>
            </div>
          )}
          {selected.hearings.map((hearing) => (
            <article className="agenda-item" key={hearing.id}>
              <div className="agenda-item-head">
                <strong dir="auto">{hearing.hearingType ?? t('agenda.hearing')}</strong>
                <span className="agenda-time">
                  {hearing.hearingTime ? format.time(hearing.hearingTime) : t('agenda.allDay')}
                </span>
              </div>
              <span dir="auto">{caseLabel(hearing.caseId)}</span>
              <span dir="auto">
                {[hearing.location, hearing.circuitName].filter(Boolean).join(' · ') ||
                  t('agenda.noLocation')}
              </span>
              {hearing.requiredDocuments && (
                <small className="preparation-context" dir="auto">
                  {t('dashboard.preparation')}: {hearing.requiredDocuments}
                </small>
              )}
              {hearing.status !== 'SCHEDULED' && (
                <p className="agenda-decision" dir="auto">
                  {hearing.decisionText ?? t('agenda.decisionRecorded')}
                </p>
              )}
              <div className="row-actions">
                {hearing.status === 'SCHEDULED' && (
                  <Button
                    type="button"
                    size="sm"

                    onClick={() => setDeciding(hearing)}
                  >
                    {t('agenda.recordDecision')}
                  </Button>
                )}
                {hearing.status === 'SCHEDULED' && (
                  <Button type="button" variant="ghost" onClick={() => setEditing(hearing)}>
                    {t('agenda.editHearing')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"

                  onClick={() => setRemoving(hearing)}
                >
                  {t('agenda.deleteHearing')}
                </Button>
              </div>
            </article>
          ))}
          {selected.tasks.map((task) => (
            <article
              className={`agenda-item agenda-task${task.completed ? ' is-done' : ''}`}
              key={task.id}
            >
              <span className="agenda-item-kind">
                {task.completed ? t('agenda.completedTask') : t('agenda.task')}
              </span>
              <Link to={`/tasks?task=${task.id}`} dir="auto">
                <bdi>{task.title}</bdi>
              </Link>
            </article>
          ))}
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('agenda.deleteHearing')}
        description={t('agenda.deleteDescription')}
        confirmLabel={t('agenda.confirmDelete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        error={remove.isError ? t('agenda.deleteError') : undefined}
        onConfirm={() => {
          if (removing && !remove.isPending)
            remove.mutate(removing, { onSuccess: () => setRemoving(null) });
        }}
      />
      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? t('agenda.add') : t('agenda.editHearing')}
      >
        {editing && (
          <HearingForm
            initial={editing === 'new' ? undefined : editing}
            initialCaseId={params.get('case') ?? undefined}
            initialDate={selectedDate}
            busy={save.isPending}
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
              {actionableErrorMessage(save.error, t('agenda.saveError'))}
            </AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(deciding)}
        onOpenChange={(open) => !open && setDeciding(null)}
        title={t('agenda.recordDecision')}
      >
        {deciding && (
          <DecisionForm
            hearing={deciding}
            busy={decide.isPending}
            onCancel={() => setDeciding(null)}
            onSave={async (input) => {
              try {
                await decide.mutateAsync(input);
                setDeciding(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        )}
        {decide.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t('agenda.decisionError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
    </section>
  );
}

type CalendarDayItems = { hearings: HearingDto[]; tasks: TaskDto[] };

function MonthGrid({
  cursor,
  selectedDate,
  items,
  onSelect,
  weekStartsOn,
  weekdayFormatter,
  dayLabel,
  t,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  weekStartsOn: number;
  weekdayFormatter: (day: Date) => string;
  dayLabel: (date: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = plusDays(first, -((first.getDay() - weekStartsOn + 7) % 7));
  const days = Array.from({ length: 42 }, (_, index) => plusDays(start, index));
  return (
    <>
      <div className="calendar-grid">
        {Array.from({ length: 7 }, (_, index) => plusDays(start, index)).map((day) => (
          <span className="calendar-weekday" key={day.getDay()}>
            {weekdayFormatter(day)}
          </span>
        ))}
        {days.map((day) => {
          const date = formatDate(day);
          const events = items.get(date);
          const openTaskCount = events?.tasks.filter((task) => !task.completed).length ?? 0;
          const completedTaskCount = events?.tasks.length ? events.tasks.length - openTaskCount : 0;
          return (
            <Button
              variant="ghost"
              type="button"
              key={date}
              className={`calendar-day ${day.getMonth() !== cursor.getMonth() ? 'muted-day' : ''} ${date === selectedDate ? 'selected' : ''} ${date === localDate() ? 'today' : ''}`}
              onClick={() => onSelect(date)}
              aria-label={t('agenda.dayAria', {
                date: dayLabel(date),
                hearings: events?.hearings.length ?? 0,
                tasks: openTaskCount,
                completed: completedTaskCount,
              })}
            >
              <span className="calendar-date">
                <bdi>{day.getDate()}</bdi>
              </span>
              <span className="calendar-events">
                {events?.hearings.slice(0, 2).map((hearing) => (
                  <span className="calendar-event" key={hearing.id}>
                    {hearing.hearingType ?? t('agenda.hearing')}
                  </span>
                ))}
                {openTaskCount > 0 && (
                  <span className="calendar-task-indicator">
                    {t('agenda.openTaskCount', { count: openTaskCount })}
                  </span>
                )}
                {completedTaskCount > 0 && (
                  <span className="calendar-completed-task-indicator">
                    {t('agenda.completedTaskCount', { count: completedTaskCount })}
                  </span>
                )}
                {(events?.hearings.length ?? 0) + openTaskCount > 2 && (
                  <span className="calendar-more">{t('agenda.moreEvents')}</span>
                )}
              </span>
            </Button>
          );
        })}
      </div>
    </>
  );
}
function WeekList({
  cursor,
  selectedDate,
  items,
  onSelect,
  weekStartsOn,
  dayLabel,
  t,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  weekStartsOn: number;
  dayLabel: (date: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const start = plusDays(cursor, -((cursor.getDay() - weekStartsOn + 7) % 7));
  return (
    <div className="calendar-agenda-list">
      {Array.from({ length: 7 }, (_, index) => plusDays(start, index)).map((day) => {
        const date = formatDate(day);
        const entry = items.get(date);
        return (
          <Button
            variant="ghost"
            className={`agenda-item ${selectedDate === date ? 'selected-record' : ''}`}
            type="button"
            key={date}
            onClick={() => onSelect(date)}
          >
            <strong>{dayLabel(date)}</strong>
            <span>
              {entry
                ? t('agenda.dayCounts', {
                    hearings: entry.hearings.length,
                    tasks: entry.tasks.filter((task) => !task.completed).length,
                    completed: entry.tasks.filter((task) => task.completed).length,
                  })
                : t('agenda.noEvents')}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
function AgendaList({
  items,
  onSelect,
  dayLabel,
  selectedDate,
  t,
}: {
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  dayLabel: (date: string) => string;
  selectedDate: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const format = useFormat();
  return (
    <div className="calendar-agenda-list">
      {[...items.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entry]) => (
          <Button
            variant="ghost"
            className={`agenda-item ${selectedDate === date ? 'selected-record' : ''}`}
            type="button"
            key={date}
            onClick={() => onSelect(date)}
          >
            <strong>{dayLabel(date)}</strong>
            <span>
              {format.list(
                entry.hearings.map((hearing) => hearing.hearingType ?? t('agenda.hearing')),
              ) || t('agenda.tasksLabel')}{' '}
              ·{' '}
              {t('agenda.dayCounts', {
                hearings: entry.hearings.length,
                tasks: entry.tasks.filter((task) => !task.completed).length,
                completed: entry.tasks.filter((task) => task.completed).length,
              })}
            </span>
          </Button>
        ))}
      {!items.size && <p className="empty-compact">{t('agenda.empty')}</p>}
    </div>
  );
}
export function HearingForm({
  initial,
  initialCaseId,
  initialDate,
  busy,
  onSave,
  onCancel,
}: {
  initial?: HearingDto;
  initialCaseId?: string;
  initialDate: string;
  busy: boolean;
  onSave: (input: HearingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const form = useForm<z.infer<typeof hearingDraftSchema>>({
    resolver: zodResolver(hearingDraftSchema),
    defaultValues: {
      caseId: initial?.caseId ?? initialCaseId ?? '',
      date: initial?.hearingDate ?? initialDate,
      time: initial?.hearingTime ?? '',
      type: initial?.hearingType ?? '',
      location: initial?.location ?? '',
      circuit: initial?.circuitName ?? '',
      requiredDocuments: initial?.requiredDocuments ?? '',
      notes: initial?.notes ?? '',
    },
  });

  const cases = useCaseList({});
  const caseId = useWatch({ control: form.control, name: 'caseId' });
  const setCaseId = (value: string) =>
    form.setValue('caseId', value, { shouldValidate: form.formState.isSubmitted });
  const date = useWatch({ control: form.control, name: 'date' });
  const setDate = (value: string) =>
    form.setValue('date', value, { shouldValidate: form.formState.isSubmitted });
  const time = useWatch({ control: form.control, name: 'time' });
  const setTime = (value: string) =>
    form.setValue('time', value, { shouldValidate: form.formState.isSubmitted });
  const type = useWatch({ control: form.control, name: 'type' });
  const setType = (value: string) =>
    form.setValue('type', value, { shouldValidate: form.formState.isSubmitted });
  const location = useWatch({ control: form.control, name: 'location' });
  const setLocation = (value: string) =>
    form.setValue('location', value, { shouldValidate: form.formState.isSubmitted });
  const circuit = useWatch({ control: form.control, name: 'circuit' });
  const setCircuit = (value: string) =>
    form.setValue('circuit', value, { shouldValidate: form.formState.isSubmitted });
  const requiredDocuments = useWatch({ control: form.control, name: 'requiredDocuments' });
  const setRequiredDocuments = (value: string) =>
    form.setValue('requiredDocuments', value, { shouldValidate: form.formState.isSubmitted });
  const notes = useWatch({ control: form.control, name: 'notes' });
  const setNotes = (value: string) =>
    form.setValue('notes', value, { shouldValidate: form.formState.isSubmitted });
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async () => {
        try {
          await onSave({
            id: initial?.id,
            caseId,
            hearingDate: date,
            hearingTime: time || undefined,
            hearingType: type || undefined,
            location: location || undefined,
            circuitName: circuit || undefined,
            requiredDocuments: requiredDocuments || undefined,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      })}
    >
      <FieldGroup>
        <Field
          label={<>{t('agenda.fields.case')}</>}
          required
          error={fieldError(form.formState.errors.caseId, t)}
        >
          <EntityPicker
            ref={(node) => form.register('caseId').ref(node)}
            required
            value={caseId}
            onValueChange={(value) => setCaseId(value ?? '')}
            items={(cases.data ?? []).map((item) => ({
              value: item.id,
              label: item.clientNames.length
                ? `${item.internalNumber} — ${format.list(item.clientNames)}`
                : item.internalNumber,
            }))}
            placeholder={t('agenda.fields.casePlaceholder')}
            aria-invalid={!!form.formState.errors.caseId}
          />
        </Field>
        <div className="settings-two-columns">
          <Field
            label={<>{t('agenda.fields.date')}</>}
            required
            error={fieldError(form.formState.errors.date, t)}
          >
            <DatePicker
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              ref={(node) => form.register('date').ref(node)}
              aria-invalid={!!form.formState.errors.date}
            />
          </Field>
          <Field
            label={<>{t('agenda.fields.time')}</>}
            error={form.formState.errors.time ? t('forms.invalid') : undefined}
          >
            <TimeField
              value={time}
              onChange={(event) => setTime(event.target.value)}
              ref={(node) => form.register('time').ref(node)}
              aria-invalid={!!form.formState.errors.time}
            />
          </Field>
        </div>
        <div className="settings-two-columns">
          <Field
            label={<>{t('agenda.fields.type')}</>}
            error={form.formState.errors.type ? t('forms.invalid') : undefined}
          >
            <CreatableCombobox
              suggestion="hearingType"
              value={type}
              onChange={(event) => setType(event.target.value)}
              ref={(node) => form.register('type').ref(node)}
              aria-invalid={!!form.formState.errors.type}
            />
          </Field>
          <Field
            label={<>{t('agenda.fields.location')}</>}
            error={form.formState.errors.location ? t('forms.invalid') : undefined}
          >
            <CreatableCombobox
              suggestion="courtName"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              ref={(node) => form.register('location').ref(node)}
              aria-invalid={!!form.formState.errors.location}
            />
          </Field>
        </div>
        <Field
          label={<>{t('agenda.fields.circuit')}</>}
          error={form.formState.errors.circuit ? t('forms.invalid') : undefined}
        >
          <CreatableCombobox
            suggestion="circuitName"
            value={circuit}
            onChange={(event) => setCircuit(event.target.value)}
            ref={(node) => form.register('circuit').ref(node)}
            aria-invalid={!!form.formState.errors.circuit}
          />
        </Field>
        <Field
          label={<>{t('agenda.fields.requiredDocuments')}</>}
          error={form.formState.errors.requiredDocuments ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={requiredDocuments}
            onChange={(event) => setRequiredDocuments(event.target.value)}
            ref={(node) => form.register('requiredDocuments').ref(node)}
            aria-invalid={!!form.formState.errors.requiredDocuments}
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
        <FormDialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('agenda.save')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
export function DecisionForm({
  hearing,
  busy,
  onSave,
  onCancel,
}: {
  hearing: HearingDto;
  busy: boolean;
  onSave: (input: {
    id: string;
    decisionText?: string;
    nextHearing?: HearingInput;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof decisionDraftSchema>>({
    resolver: zodResolver(decisionDraftSchema),
    defaultValues: { decisionText: hearing.decisionText ?? '', nextDate: '' },
  });

  const decisionText = useWatch({ control: form.control, name: 'decisionText' });
  const setDecisionText = (value: string) =>
    form.setValue('decisionText', value, { shouldValidate: form.formState.isSubmitted });
  const nextDate = useWatch({ control: form.control, name: 'nextDate' });
  const setNextDate = (value: string) =>
    form.setValue('nextDate', value, { shouldValidate: form.formState.isSubmitted });
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async () => {
        try {
          await onSave({
            id: hearing.id,
            decisionText: decisionText || undefined,
            nextHearing: nextDate
              ? {
                  caseId: hearing.caseId,
                  hearingDate: nextDate,
                  hearingTime: hearing.hearingTime ?? undefined,
                  hearingType: hearing.hearingType ?? undefined,
                  location: hearing.location ?? undefined,
                  circuitName: hearing.circuitName ?? undefined,
                  requiredDocuments: hearing.requiredDocuments ?? undefined,
                  notes: undefined,
                  reminderMinutes: hearing.reminderMinutes ?? undefined,
                }
              : undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      })}
    >
      <FieldGroup>
        <Field
          label={<>{t('agenda.fields.decisionText')}</>}
          error={form.formState.errors.decisionText ? t('forms.invalid') : undefined}
        >
          <Textarea
            autoFocus
            value={decisionText}
            onChange={(event) => setDecisionText(event.target.value)}
            ref={(node) => form.register('decisionText').ref(node)}
            aria-invalid={!!form.formState.errors.decisionText}
          />
        </Field>
        <Field
          label={<>{t('agenda.fields.nextHearing')}</>}
          error={form.formState.errors.nextDate ? t('forms.invalid') : undefined}
        >
          <DatePicker
            value={nextDate}
            onChange={(event) => setNextDate(event.target.value)}
            ref={(node) => form.register('nextDate').ref(node)}
            aria-invalid={!!form.formState.errors.nextDate}
          />
        </Field>
        <p className="muted">{t('agenda.nextHearingHint')}</p>
        <FormDialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('agenda.recordDecision')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
