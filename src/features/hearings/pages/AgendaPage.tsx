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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { HearingDto, HearingInput, TaskDto } from '../../../bridge/types';
import { bridge } from '../../../bridge/commands';
import { useMutation } from '@tanstack/react-query';
import { byHearingTime, HearingRoll } from '../components/HearingRoll';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog, FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';

import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';

import { Textarea } from '../../../components/ui/textarea';
import { Icon } from '../../../components/layout/Icon';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat, useLocalePresentation } from '../../../i18n/LocalePresentation';
import { dateOnlyToLocalDate, localDateOnly } from '../../../lib/dateOnly';
import { useCase, useCaseList } from '../../cases/api/casesApi';
import { NoCasesYet } from '../../cases/components/NoCasesYet';
import { caseOption } from '../../cases/components/caseOptions';
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
  const [params, setParams] = useSearchParams();
  const requestedHearingId = params.get('hearing');
  const createIntent = params.get('create') === 'hearing';
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(params.get('date') ?? localDate());
  const [editing, setEditing] = useState<HearingDto | 'new' | null>(null);
  // «إضافة جلسة» links carry ?create=hearing. Treat it as a one-time request: open the
  // form, then drop it from the address so the same link works again from this page.
  const [createHandled, setCreateHandled] = useState(false);
  if (createIntent && !createHandled) {
    setCreateHandled(true);
    setEditing('new');
    const requestedDate = params.get('date');
    if (requestedDate) {
      setSelectedDate(requestedDate);
      setCursor(dateOnlyToLocalDate(requestedDate));
    }
  } else if (!createIntent && createHandled) {
    setCreateHandled(false);
  }
  useEffect(() => {
    if (!createIntent) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('create');
        return next;
      },
      { replace: true },
    );
  }, [createIntent, setParams]);
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
  const detailRef = useRef<HTMLElement>(null);
  const print = useMutation({ gcTime: 0, mutationFn: bridge.print });
  // The printed roll joins the page on the first request, then the print dialog opens.
  const [printRequests, setPrintRequests] = useState(0);
  const { mutate: printPage } = print;
  useEffect(() => {
    if (printRequests) printPage();
  }, [printRequests, printPage]);
  // On narrow windows the day's details sit below the calendar; bring them into view so
  // choosing a day visibly does something.
  const selectDay = (date: string) => {
    setSelectedDate(date);
    const detail = detailRef.current;
    if (!detail?.previousElementSibling) return;
    const stacked =
      detail.getBoundingClientRect().top >=
      detail.previousElementSibling.getBoundingClientRect().bottom;
    if (stacked) detail.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  };
  const label = format.monthYear(cursor);
  const caseLabel = (caseId: string) => {
    const item = cases.data?.find((candidate) => candidate.id === caseId);
    return item
      ? t('dashboard.caseContext', {
          caseNumber: item.internalNumber,
          clients: item.clientNames.join('، '),
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
              onSelect={selectDay}
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
              onSelect={selectDay}
              weekStartsOn={weekStartsOn}
              dayLabel={format.dateCompact}
              lines={(entry) => <DayLines entry={entry} caseLabel={caseLabel} />}
              t={t}
            />
          ) : (
            <AgendaList
              items={items}
              onSelect={selectDay}
              dayLabel={format.dateLong}
              selectedDate={selectedDate}
              lines={(entry) => <DayLines entry={entry} caseLabel={caseLabel} />}
              t={t}
            />
          )}
        </section>
        <aside className="calendar-detail" ref={detailRef}>
          <p className="kicker">{t('agenda.dayDetails')}</p>
          <h3>
            <time dateTime={selectedDate}>{format.dateLong(selectedDate)}</time>
          </h3>
          {selected.hearings.length > 0 && (
            <div className="calendar-detail-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={print.isPending}
                onClick={() => setPrintRequests((count) => count + 1)}
              >
                <Icon name="printer" size={16} />
                {t('agenda.printRoll')}
              </Button>
              {print.isError && (
                <Alert variant="destructive">
                  <AlertDescription>{t('agenda.printError')}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
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
          {[...selected.hearings].sort(byHearingTime).map((hearing) => (
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
      {printRequests > 0 && (
        <HearingRoll date={selectedDate} hearings={selected.hearings} cases={cases.data ?? []} />
      )}
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
/** A day in the week and list views holds several lines, not a one-line pill. */
const dayRowClasses =
  'grid h-auto justify-stretch justify-items-start gap-1 py-2 whitespace-normal';

/** What a day holds, line by line: each hearing with its time, case and court, then open tasks. */
function DayLines({
  entry,
  caseLabel,
}: {
  entry: CalendarDayItems | undefined;
  caseLabel: (caseId: string) => string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const openTasks = entry?.tasks.filter((task) => !task.completed) ?? [];
  const completed = (entry?.tasks.length ?? 0) - openTasks.length;
  if (!entry || (!entry.hearings.length && !openTasks.length && !completed))
    return <span className="day-line muted">{t('agenda.noEvents')}</span>;
  return (
    <>
      {[...entry.hearings].sort(byHearingTime).map((hearing) => (
        <span className="day-line" key={hearing.id} dir="auto">
          <span className="day-line-time">
            {hearing.hearingTime ? format.time(hearing.hearingTime) : t('agenda.allDay')}
          </span>
          {[caseLabel(hearing.caseId), hearing.location].filter(Boolean).join(' · ')}
          {hearing.status !== 'SCHEDULED' && (
            <span className="day-line-done"> · {t('agenda.decisionRecorded')}</span>
          )}
        </span>
      ))}
      {openTasks.map((task) => (
        <span className="day-line day-line-task" key={task.id} dir="auto">
          {t('agenda.task')}: <bdi>{task.title}</bdi>
        </span>
      ))}
      {completed > 0 && (
        <span className="day-line muted">
          {t('agenda.completedTaskCount', { count: completed })}
        </span>
      )}
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
  lines,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  weekStartsOn: number;
  dayLabel: (date: string) => string;
  lines: (entry: CalendarDayItems | undefined) => ReactNode;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const start = plusDays(cursor, -((cursor.getDay() - weekStartsOn + 7) % 7));
  return (
    <div className="calendar-agenda-list">
      {Array.from({ length: 7 }, (_, index) => plusDays(start, index)).map((day) => {
        const date = formatDate(day);
        return (
          <Button
            variant="ghost"
            className={`agenda-item ${dayRowClasses} ${selectedDate === date ? 'selected-record' : ''} ${date === localDate() ? 'is-today' : ''}`}
            type="button"
            key={date}
            onClick={() => onSelect(date)}
          >
            <strong>{dayLabel(date)}</strong>
            {lines(items.get(date))}
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
  lines,
  t,
}: {
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  dayLabel: (date: string) => string;
  selectedDate: string;
  lines: (entry: CalendarDayItems | undefined) => ReactNode;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  // The list starts today; earlier days are one click away.
  const [showPast, setShowPast] = useState(false);
  const today = localDate();
  const entries = [...items.entries()].sort(([a], [b]) => a.localeCompare(b));
  const past = entries.filter(([date]) => date < today);
  const shown = showPast ? entries : entries.filter(([date]) => date >= today);
  return (
    <div className="calendar-agenda-list">
      {past.length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowPast(!showPast)}>
          {showPast ? t('agenda.hidePast') : t('agenda.showPast', { count: past.length })}
        </Button>
      )}
      {shown.map(([date, entry]) => (
        <Button
          variant="ghost"
          className={`agenda-item ${dayRowClasses} ${selectedDate === date ? 'selected-record' : ''} ${date === today ? 'is-today' : ''}`}
          type="button"
          key={date}
          onClick={() => onSelect(date)}
        >
          <strong>{dayLabel(date)}</strong>
          {lines(entry)}
        </Button>
      ))}
      {!items.size ? (
        <p className="empty-compact">{t('agenda.empty')}</p>
      ) : (
        !shown.length && <p className="empty-compact">{t('agenda.noUpcoming')}</p>
      )}
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
  const errors = form.formState.errors;
  const draft = useWatch({ control: form.control });
  const bind = <K extends keyof z.infer<typeof hearingDraftSchema>>(name: K) => ({
    value: draft[name] ?? '',
    set: (value: string) =>
      form.setValue(name, value as never, {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      }),
  });
  const caseId = bind('caseId');
  const date = bind('date');
  const time = bind('time');
  const type = bind('type');
  const location = bind('location');
  const circuit = bind('circuit');
  const requiredDocuments = bind('requiredDocuments');
  const notes = bind('notes');
  // A new hearing usually sits where its case sits: offer the case's court and circuit.
  const chosenCase = useCase(initial ? '' : caseId.value);
  useEffect(() => {
    if (initial || !chosenCase.data) return;
    if (!form.getValues('location') && chosenCase.data.courtName)
      form.setValue('location', chosenCase.data.courtName);
    if (!form.getValues('circuit') && chosenCase.data.circuitName)
      form.setValue('circuit', chosenCase.data.circuitName);
  }, [chosenCase.data, form, initial]);

  if (cases.isSuccess && !cases.data.length && !initial) return <NoCasesYet onCancel={onCancel} />;

  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSave({
            id: initial?.id,
            caseId: values.caseId,
            hearingDate: values.date,
            hearingTime: values.time || undefined,
            hearingType: values.type || undefined,
            location: values.location || undefined,
            circuitName: values.circuit || undefined,
            requiredDocuments: values.requiredDocuments || undefined,
            notes: values.notes || undefined,
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
          error={errors.caseId ? t('forms.chooseCase') : undefined}
        >
          <EntityPicker
            emptyText={t('cases.noResults')}
            ref={(node) => form.register('caseId').ref(node)}
            required
            value={caseId.value}
            onValueChange={(value) => caseId.set(value ?? '')}
            items={(cases.data ?? []).map(caseOption)}
            placeholder={t('agenda.fields.casePlaceholder')}
            aria-invalid={!!errors.caseId}
          />
        </Field>
        <div className="settings-two-columns">
          <Field
            label={<>{t('agenda.fields.date')}</>}
            required
            error={errors.date ? t('forms.invalidDate') : undefined}
          >
            <DatePicker
              required
              value={date.value}
              onChange={(event) => date.set(event.target.value)}
              ref={(node) => form.register('date').ref(node)}
              aria-invalid={!!errors.date}
            />
          </Field>
          <Field
            label={<>{t('agenda.fields.time')}</>}
            error={errors.time ? t('forms.invalidTime') : undefined}
          >
            <TimeField
              value={time.value}
              onChange={(event) => time.set(event.target.value)}
              ref={(node) => form.register('time').ref(node)}
              aria-invalid={!!errors.time}
            />
          </Field>
        </div>
        <div className="settings-two-columns">
          <Field label={<>{t('agenda.fields.type')}</>}>
            <CreatableCombobox
              suggestion="hearingType"
              value={type.value}
              onChange={(event) => type.set(event.target.value)}
              ref={(node) => form.register('type').ref(node)}
            />
          </Field>
          <Field label={<>{t('agenda.fields.location')}</>}>
            <CreatableCombobox
              suggestion="courtName"
              value={location.value}
              onChange={(event) => location.set(event.target.value)}
              ref={(node) => form.register('location').ref(node)}
            />
          </Field>
        </div>
        <Field label={<>{t('agenda.fields.circuit')}</>}>
          <CreatableCombobox
            suggestion="circuitName"
            value={circuit.value}
            onChange={(event) => circuit.set(event.target.value)}
            ref={(node) => form.register('circuit').ref(node)}
          />
        </Field>
        <Field label={<>{t('agenda.fields.requiredDocuments')}</>}>
          <Textarea
            value={requiredDocuments.value}
            onChange={(event) => requiredDocuments.set(event.target.value)}
            ref={(node) => form.register('requiredDocuments').ref(node)}
          />
        </Field>
        <Field label={<>{t('common.notes')}</>}>
          <Textarea
            value={notes.value}
            onChange={(event) => notes.set(event.target.value)}
            ref={(node) => form.register('notes').ref(node)}
          />
        </Field>
        <FormDialogFooter>
          <Button type="submit" disabled={busy}>
            {t('agenda.save')}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
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
  const format = useFormat();
  const form = useForm<z.infer<typeof decisionDraftSchema>>({
    resolver: zodResolver(decisionDraftSchema),
    defaultValues: { decisionText: hearing.decisionText ?? '', nextDate: '' },
  });
  const decisionText = useWatch({ control: form.control, name: 'decisionText' });
  const nextDate = useWatch({ control: form.control, name: 'nextDate' });
  const set = (name: 'decisionText' | 'nextDate', value: string) =>
    form.setValue(name, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  const nextIsNotLater = Boolean(nextDate && nextDate <= hearing.hearingDate);
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSave({
            id: hearing.id,
            decisionText: values.decisionText?.trim() || undefined,
            nextHearing: values.nextDate
              ? {
                  caseId: hearing.caseId,
                  hearingDate: values.nextDate,
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
        <Field label={<>{t('agenda.fields.decisionText')}</>}>
          <Textarea
            autoFocus
            value={decisionText}
            onChange={(event) => set('decisionText', event.target.value)}
            ref={(node) => form.register('decisionText').ref(node)}
          />
        </Field>
        <Field
          label={<>{t('agenda.fields.nextHearing')}</>}
          hint={
            nextIsNotLater
              ? t('agenda.nextHearingNotLater', { date: format.date(hearing.hearingDate) })
              : undefined
          }
          error={form.formState.errors.nextDate ? t('forms.invalidDate') : undefined}
        >
          <DatePicker
            value={nextDate}
            onChange={(event) => set('nextDate', event.target.value)}
            ref={(node) => form.register('nextDate').ref(node)}
            aria-invalid={!!form.formState.errors.nextDate}
          />
        </Field>
        <p className="muted">{t('agenda.nextHearingHint')}</p>
        <FormDialogFooter>
          <Button type="submit" disabled={busy}>
            {t('agenda.recordDecision')}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
