import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HearingDto, HearingInput } from '../../../bridge/types';
import { Dialog } from '../../../components/ui/Dialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { useCaseList } from '../../cases/api/casesApi';
import { useTaskList } from '../../tasks/api/tasksApi';
import { useHearings, useRecordHearingDecision, useSaveHearing } from '../api/hearingsApi';

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
  return (
    <section className="calendar-page">
      <PageHeader
        kicker="الأجندة"
        title="الجلسات والمهام"
        description="التواريخ القانونية تُعرض كيوم فقط ولا تتحول بين المناطق الزمنية."
        actions={
          <button type="button" onClick={() => setEditing('new')}>
            إضافة جلسة
          </button>
        }
      />
      <div className="calendar-toolbar">
        <div className="calendar-period">
          <button
            type="button"
            className="secondary-button"
            aria-label="الفترة السابقة"
            onClick={() => shift(-1)}
          >
            ‹
          </button>
          <strong>
            <bdi>{label}</bdi>
          </strong>
          <button
            type="button"
            className="secondary-button"
            aria-label="الفترة التالية"
            onClick={() => shift(1)}
          >
            ›
          </button>
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
              {hearing.status === 'SCHEDULED' ? (
                <button type="button" className="text-button" onClick={() => setDeciding(hearing)}>
                  تسجيل القرار
                </button>
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
        {save.isError && <p className="error">تعذر حفظ الجلسة.</p>}
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
        {decide.isError && <p className="error">تعذر تسجيل القرار أو الجلسة التالية.</p>}
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
            <button
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
            </button>
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
          <button
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
          </button>
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
          <button className="agenda-item" type="button" key={date} onClick={() => onSelect(date)}>
            <strong>
              <bdi>{date}</bdi>
            </strong>
            <span>
              {entry.hearings.map((hearing) => hearing.hearingType ?? 'جلسة').join('، ') || 'مهام'}{' '}
              · {entry.tasks.length} مهمة
            </span>
          </button>
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
        <select required value={caseId} onChange={(event) => setCaseId(event.target.value)}>
          <option value="">اختر القضية</option>
          {cases.data?.map((caseItem) => (
            <option key={caseItem.id} value={caseItem.id}>
              {caseItem.internalNumber}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-two-columns">
        <label>
          التاريخ
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          الوقت (اختياري)
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      </div>
      <div className="settings-two-columns">
        <label>
          نوع الجلسة
          <input value={type} onChange={(event) => setType(event.target.value)} />
        </label>
        <label>
          المكان أو المحكمة
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
      </div>
      <label>
        الدائرة
        <input value={circuit} onChange={(event) => setCircuit(event.target.value)} />
      </label>
      <label>
        المستندات المطلوبة
        <textarea
          value={requiredDocuments}
          onChange={(event) => setRequiredDocuments(event.target.value)}
        />
      </label>
      <label>
        ملاحظات
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
        <button disabled={busy}>حفظ الجلسة</button>
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
        <textarea
          autoFocus
          value={decisionText}
          onChange={(event) => setDecisionText(event.target.value)}
        />
      </label>
      <label>
        الجلسة التالية (اختيارية)
        <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
      </label>
      <p className="muted">تُنسخ بيانات الجلسة التالية ويمكن تعديلها لاحقًا بشكل مستقل.</p>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
        <button disabled={busy}>تسجيل القرار</button>
      </div>
    </form>
  );
}
