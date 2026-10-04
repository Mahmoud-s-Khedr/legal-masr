import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HearingDto, HearingInput } from '../../../bridge/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useCaseList } from '../../cases/api/casesApi';
import { useTaskList } from '../../tasks/api/tasksApi';
import {
  useDeleteHearing,
  useHearings,
  useRecordHearingDecision,
  useSaveHearing,
} from '../api/hearingsApi';

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const plusDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const formatDate = (date: Date) => localDate(date);

export function AgendaPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(params.get('date') ?? localDate());
  const [editing, setEditing] = useState<HearingDto | 'new' | null>(
    params.get('case') ? 'new' : null,
  );
  const [removing, setRemoving] = useState<HearingDto | null>(null);
  const remove = useDeleteHearing();
  const [deciding, setDeciding] = useState<HearingDto | null>(null);
  const hearings = useHearings({});
  const tasks = useTaskList({ view: 'ALL', referenceDate: '9999-12-31' });
  const save = useSaveHearing();
  const decide = useRecordHearingDecision();
  const items = useMemo(() => {
    const dates = new Map<string, { hearings: HearingDto[]; tasks: string[] }>();
    for (const hearing of hearings.data ?? []) {
      const row = dates.get(hearing.hearingDate) ?? { hearings: [], tasks: [] };
      row.hearings.push(hearing);
      dates.set(hearing.hearingDate, row);
    }
    for (const task of tasks.data ?? []) {
      const row = dates.get(task.dueDate) ?? { hearings: [], tasks: [] };
      row.tasks.push(task.title);
      dates.set(task.dueDate, row);
    }
    return dates;
  }, [hearings.data, tasks.data]);
  const selected = items.get(selectedDate) ?? { hearings: [], tasks: [] };
  const label = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(cursor);
  const shift = (direction: -1 | 1) =>
    setCursor((current) =>
      view === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
        : plusDays(current, direction * 7),
    );
  if (hearings.isLoading || tasks.isLoading) return <p role="status">جارٍ تحميل الأجندة…</p>;
  if (hearings.isError || tasks.isError) return <p role="alert">تعذر تحميل الأجندة.</p>;
  return (
    <section className="calendar-page">
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">الأجندة</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">الجلسات والمهام</h1>
          <p className="mt-1 text-muted-foreground">
            التواريخ القانونية تُعرض كيوم فقط ولا تتحول بين المناطق الزمنية.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing('new')}>
          إضافة جلسة
        </Button>
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-period">
          <Button
            type="button"
            className="secondary-button"
            aria-label="الفترة السابقة"
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
            aria-label="الفترة التالية"
            onClick={() => shift(1)}
          >
            ›
          </Button>
        </div>
        <Tabs
          label="طريقة عرض الأجندة"
          value={view}
          onChange={(value) => setView(value as typeof view)}
          tabs={[
            { id: 'month', label: 'شهر' },
            { id: 'week', label: 'أسبوع' },
            { id: 'list', label: 'قائمة' },
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
            />
          ) : view === 'week' ? (
            <WeekList
              cursor={cursor}
              selectedDate={selectedDate}
              items={items}
              onSelect={setSelectedDate}
            />
          ) : (
            <AgendaList items={items} onSelect={setSelectedDate} />
          )}
        </section>
        <aside className="calendar-detail">
          <p className="kicker">
            <bdi>{selectedDate}</bdi>
          </p>
          <h3>تفاصيل اليوم</h3>
          {!selected.hearings.length && !selected.tasks.length && (
            <p className="empty-compact">لا توجد جلسات أو مهام في هذا التاريخ.</p>
          )}
          {selected.hearings.map((hearing) => (
            <article className="agenda-item" key={hearing.id}>
              <strong>{hearing.hearingType ?? 'جلسة'}</strong>
              <span>
                {hearing.hearingTime ? <bdi>{hearing.hearingTime}</bdi> : 'طوال اليوم'} ·{' '}
                {hearing.location ?? 'دون مكان'}
              </span>
              <Button type="button" variant="ghost" onClick={() => setEditing(hearing)}>
                تعديل الجلسة
              </Button>
              <Button type="button" variant="destructive" onClick={() => setRemoving(hearing)}>
                حذف الجلسة
              </Button>
              {hearing.status === 'SCHEDULED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setDeciding(hearing)}
                >
                  تسجيل القرار
                </Button>
              ) : (
                <span>{hearing.decisionText ?? 'قرار مسجل'}</span>
              )}
            </article>
          ))}
          {selected.tasks.map((task) => (
            <article className="agenda-item" key={task}>
              <strong>مهمة</strong>
              <span>{task}</span>
            </article>
          ))}
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="حذف الجلسة"
        description="سيُحذف سجل هذه الجلسة. راجع التاريخ والقضية قبل التأكيد."
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        destructive
        pending={remove.isPending}
        error={remove.isError ? 'تعذر حذف الجلسة.' : undefined}
        onConfirm={() => {
          if (removing && !remove.isPending)
            remove.mutate(removing, { onSuccess: () => setRemoving(null) });
        }}
      />
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? 'إضافة جلسة' : 'تعديل الجلسة'}
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
            تعذر حفظ الجلسة.
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(deciding)}
        onOpenChange={(open) => !open && setDeciding(null)}
        title="تسجيل قرار الجلسة"
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
            تعذر تسجيل القرار أو الجلسة التالية.
          </p>
        )}
      </Dialog>
    </section>
  );
}

function MonthGrid({
  cursor,
  selectedDate,
  items,
  onSelect,
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, { hearings: HearingDto[]; tasks: string[] }>;
  onSelect: (date: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = plusDays(first, -((first.getDay() + 1) % 7));
  const days = Array.from({ length: 42 }, (_, index) => plusDays(start, index));
  return (
    <>
      <div className="calendar-grid">
        {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {days.map((day) => {
          const date = formatDate(day);
          const events = items.get(date);
          return (
            <Button
              variant="ghost"
              type="button"
              key={date}
              className={`calendar-day ${day.getMonth() !== cursor.getMonth() ? 'muted-day' : ''} ${date === selectedDate ? 'selected' : ''} ${date === localDate() ? 'today' : ''}`}
              onClick={() => onSelect(date)}
            >
              <span className="calendar-date">
                <bdi>{day.getDate()}</bdi>
              </span>
              <span className="calendar-events">
                {events?.hearings.slice(0, 2).map((hearing) => (
                  <span className="calendar-event" key={hearing.id}>
                    {hearing.hearingType ?? 'جلسة'}
                  </span>
                ))}
                {(events?.hearings.length ?? 0) + (events?.tasks.length ?? 0) > 2 && (
                  <span className="calendar-more">مواعيد أخرى</span>
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
}: {
  cursor: Date;
  selectedDate: string;
  items: Map<string, { hearings: HearingDto[]; tasks: string[] }>;
  onSelect: (date: string) => void;
}) {
  const start = plusDays(cursor, -((cursor.getDay() + 1) % 7));
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
              {entry ? `${entry.hearings.length} جلسة · ${entry.tasks.length} مهمة` : 'لا مواعيد'}
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
}: {
  items: Map<string, { hearings: HearingDto[]; tasks: string[] }>;
  onSelect: (date: string) => void;
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
              {entry.hearings.map((hearing) => hearing.hearingType ?? 'جلسة').join('، ') || 'مهام'}{' '}
              · {entry.tasks.length} مهمة
            </span>
          </Button>
        ))}
      {!items.size && <p className="empty-compact">لا توجد جلسات أو مهام بعد.</p>}
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
        القضية
        <Select
          required
          value={caseId}
          onValueChange={setCaseId}
          placeholder="اختر القضية"
          items={(cases.data ?? []).map((item) => ({ value: item.id, label: item.internalNumber }))}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          التاريخ
          <DatePicker required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          الوقت (اختياري)
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      </div>
      <div className="settings-two-columns">
        <label>
          نوع الجلسة
          <Input value={type} onChange={(event) => setType(event.target.value)} />
        </label>
        <label>
          المكان أو المحكمة
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
      </div>
      <label>
        الدائرة
        <Input value={circuit} onChange={(event) => setCircuit(event.target.value)} />
      </label>
      <label>
        المستندات المطلوبة
        <Textarea
          value={requiredDocuments}
          onChange={(event) => setRequiredDocuments(event.target.value)}
        />
      </label>
      <label>
        ملاحظات
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>حفظ الجلسة</Button>
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
        نص القرار
        <Textarea
          autoFocus
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
        />
      </label>
      <label>
        الجلسة التالية (اختيارية)
        <DatePicker value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
      </label>
      <p className="muted">تُنسخ بيانات الجلسة التالية ويمكن تعديلها لاحقًا بشكل مستقل.</p>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>تسجيل القرار</Button>
      </div>
    </form>
  );
}
