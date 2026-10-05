import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { HearingDto, HearingInput, TaskDto } from '../../../bridge/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useLocalePresentation } from '../../../i18n/LocalePresentation';
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
  const { dateLocale, weekStartsOn } = useLocalePresentation();
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
  const label = new Intl.DateTimeFormat(dateLocale.code, { month: 'long', year: 'numeric' }).format(
    cursor,
  );

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
        setEditing(hearing);
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
  if (hearings.isError || tasks.isError) return <p role="alert">{t('agenda.loadError')}</p>;
  return (
    <section className="calendar-page">
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">{t('agenda.kicker')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{t('agenda.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('agenda.description')}</p>
        </div>
        <Button type="button" onClick={() => setEditing('new')}>
          {t('agenda.add')}
        </Button>
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-period">
          <Button
            type="button"
            className="secondary-button"
            aria-label={t('agenda.previousPeriod')}
            onClick={() => shift(-1)}
          >
            ‹
          </Button>
          <strong>
            <bdi>{label}</bdi>
          </strong>
          <Button
            type="button"
            className="secondary-button"
            aria-label={t('agenda.nextPeriod')}
            onClick={() => shift(1)}
          >
            ›
          </Button>
        </div>
        <Tabs
          label={t('agenda.viewLabel')}
          value={view}
          onChange={(value) => setView(value as typeof view)}
          tabs={[
            { id: 'month', label: t('agenda.views.month') },
            { id: 'week', label: t('agenda.views.week') },
            { id: 'list', label: t('agenda.views.list') },
          ]}
        />
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
              weekdayFormatter={(day) =>
                new Intl.DateTimeFormat(dateLocale.code, { weekday: 'short' }).format(day)
              }
              t={t}
            />
          ) : view === 'week' ? (
            <WeekList
              cursor={cursor}
              selectedDate={selectedDate}
              items={items}
              onSelect={setSelectedDate}
              weekStartsOn={weekStartsOn}
              t={t}
            />
          ) : (
            <AgendaList items={items} onSelect={setSelectedDate} t={t} />
          )}
        </section>
        <aside className="calendar-detail">
          <p className="kicker">
            <bdi>{selectedDate}</bdi>
          </p>
          <h3>{t('agenda.dayDetails')}</h3>
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
            <p className="empty-compact">{t('agenda.emptyDay')}</p>
          )}
          {selected.hearings.map((hearing) => (
            <article className="agenda-item" key={hearing.id}>
              <strong>{hearing.hearingType ?? t('agenda.hearing')}</strong>
              <span>
                {hearing.hearingTime ? <bdi>{hearing.hearingTime}</bdi> : t('agenda.allDay')} ·{' '}
                {hearing.location ?? t('agenda.noLocation')}
              </span>
              <Button type="button" variant="ghost" onClick={() => setEditing(hearing)}>
                {t('agenda.editHearing')}
              </Button>
              <Button type="button" variant="destructive" onClick={() => setRemoving(hearing)}>
                {t('agenda.deleteHearing')}
              </Button>
              {hearing.status === 'SCHEDULED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setDeciding(hearing)}
                >
                  {t('agenda.recordDecision')}
                </Button>
              ) : (
                <span>{hearing.decisionText ?? t('agenda.decisionRecorded')}</span>
              )}
            </article>
          ))}
          {selected.tasks.map((task) => (
            <article className="agenda-item" key={task.id}>
              <strong>{task.completed ? t('agenda.completedTask') : t('agenda.task')}</strong>
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
      <Dialog
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
          <p className="error" role="alert">
            {t('agenda.saveError')}
          </p>
        )}
      </Dialog>
      <Dialog
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
          <p className="error" role="alert">
            {t('agenda.decisionError')}
          </p>
        )}
      </Dialog>
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
  t,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  weekStartsOn: number;
  weekdayFormatter: (day: Date) => string;
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
                date,
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
  t,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  weekStartsOn: number;
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
            <strong>
              <bdi>{date}</bdi>
            </strong>
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
  t,
}: {
  items: Map<string, CalendarDayItems>;
  onSelect: (date: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="calendar-agenda-list">
      {[...items.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entry]) => (
          <Button
            variant="ghost"
            className="agenda-item"
            type="button"
            key={date}
            onClick={() => onSelect(date)}
          >
            <strong>
              <bdi>{date}</bdi>
            </strong>
            <span>
              {entry.hearings
                .map((hearing) => hearing.hearingType ?? t('agenda.hearing'))
                .join('، ') || t('agenda.tasksLabel')}{' '}
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
  const cases = useCaseList({});
  const [caseId, setCaseId] = useState(initial?.caseId ?? initialCaseId ?? '');
  const [date, setDate] = useState(initial?.hearingDate ?? initialDate);
  const [time, setTime] = useState(initial?.hearingTime ?? '');
  const [type, setType] = useState(initial?.hearingType ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [circuit, setCircuit] = useState(initial?.circuitName ?? '');
  const [requiredDocuments, setRequiredDocuments] = useState(initial?.requiredDocuments ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
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
      }}
    >
      <label>
        {t('agenda.fields.case')}
        <Select
          required
          value={caseId}
          onValueChange={setCaseId}
          placeholder={t('agenda.fields.casePlaceholder')}
          items={(cases.data ?? []).map((item) => ({ value: item.id, label: item.internalNumber }))}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          {t('agenda.fields.date')}
          <DatePicker required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          {t('agenda.fields.time')}
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      </div>
      <div className="settings-two-columns">
        <label>
          {t('agenda.fields.type')}
          <Input value={type} onChange={(event) => setType(event.target.value)} />
        </label>
        <label>
          {t('agenda.fields.location')}
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
      </div>
      <label>
        {t('agenda.fields.circuit')}
        <Input value={circuit} onChange={(event) => setCircuit(event.target.value)} />
      </label>
      <label>
        {t('agenda.fields.requiredDocuments')}
        <Textarea
          value={requiredDocuments}
          onChange={(event) => setRequiredDocuments(event.target.value)}
        />
      </label>
      <label>
        {t('common.notes')}
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy}>{t('agenda.save')}</Button>
      </div>
    </form>
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
  const [decisionText, setDecisionText] = useState(hearing.decisionText ?? '');
  const [nextDate, setNextDate] = useState('');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
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
      }}
    >
      <label>
        {t('agenda.fields.decisionText')}
        <Textarea
          autoFocus
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
        />
      </label>
      <label>
        {t('agenda.fields.nextHearing')}
        <DatePicker value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
      </label>
      <p className="muted">{t('agenda.nextHearingHint')}</p>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy}>{t('agenda.recordDecision')}</Button>
      </div>
    </form>
  );
}
