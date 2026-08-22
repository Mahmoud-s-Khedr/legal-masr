import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EventDto } from '../../../bridge/types';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useCompleteEvent, useEventList, useSaveEvent } from '../api/eventsApi';

const VIEWS = ['MONTH', 'WEEK', 'DAY', 'AGENDA'] as const;
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localToday = () => formatDate(new Date());

function CalendarGrid({
  month,
  events,
  selectedDate,
  onSelect,
}: {
  month: Date;
  events: Record<string, EventDto[]>;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - monthStart.getDay());
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index),
  );
  const today = localToday();

  return (
    <div className="calendar-grid" role="grid" aria-label="تقويم الشهر">
      {WEEKDAYS.map((day) => (
        <div className="calendar-weekday" role="columnheader" key={day}>
          {day}
        </div>
      ))}
      {days.map((day) => {
        const key = formatDate(day);
        const dayEvents = events[key] ?? [];
        const isCurrentMonth = day.getMonth() === month.getMonth();
        return (
          <button
            className={`calendar-day${isCurrentMonth ? '' : ' muted-day'}${key === today ? ' today' : ''}${key === selectedDate ? ' selected' : ''}`}
            type="button"
            role="gridcell"
            key={key}
            onClick={() => onSelect(key)}
          >
            <span className="calendar-date">{day.getDate()}</span>
            <span className="calendar-events">
              {dayEvents.slice(0, 2).map((event) => (
                <span className="calendar-event" key={event.id} title={event.title}>
                  {event.title}
                </span>
              ))}
              {dayEvents.length > 2 && (
                <span className="calendar-more">+{dayEvents.length - 2}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarPage() {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<(typeof VIEWS)[number]>('MONTH');
  const [searchParams] = useSearchParams();
  const [caseId, setCaseId] = useState(searchParams.get('case') ?? '');
  const [clientId, setClientId] = useState(searchParams.get('client') ?? '');
  const [eventType, setEventType] = useState('HEARING');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [createTaskTitle, setCreateTaskTitle] = useState('');
  const clients = useClientList({});
  const cases = useCaseList({});
  const { data = [], isLoading } = useEventList({});
  const save = useSaveEvent();
  const complete = useCompleteEvent();
  const linkedEvent = data.find((item) => item.id === searchParams.get('event'));
  const activeDate = linkedEvent?.eventDate ?? selectedDate;
  const grouped = useMemo(
    () =>
      data.reduce<Record<string, EventDto[]>>((all, event) => {
        (all[event.eventDate] ??= []).push(event);
        return all;
      }, {}),
    [data],
  );
  const selectedEvents = grouped[activeDate] ?? [];
  const agendaEntries = useMemo(() => {
    const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    if (view === 'AGENDA') return entries;
    if (view === 'DAY') return entries.filter(([date]) => date === activeDate);
    if (view === 'WEEK') {
      const selected = new Date(`${activeDate}T12:00:00`);
      const start = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate() - selected.getDay(),
      );
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const from = formatDate(start);
      const to = formatDate(end);
      return entries.filter(([date]) => date >= from && date <= to);
    }
    return entries;
  }, [activeDate, grouped, view]);
  const label = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(month);
  const moveMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      save.mutate(
        {
          title,
          eventDate: selectedDate,
          eventType,
          isAllDay: !startTime,
          startTime: startTime || undefined,
          location: location || undefined,
          preparationNotes: preparationNotes || undefined,
          caseId: caseId || undefined,
          clientId: clientId || undefined,
        },
        {
          onSuccess: () => {
            setTitle('');
            setStartTime('');
            setLocation('');
            setPreparationNotes('');
          },
        },
      );
  };

  return (
    <section className="calendar-page">
      <header className="page-heading calendar-heading">
        <div>
          <p className="kicker">الجدول</p>
          <h2>تقويم القضايا والمواعيد</h2>
          <p>تظهر التواريخ القانونية كما أُدخلت، من دون تحويل منطقة زمنية.</p>
        </div>
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-period">
          <button
            className="secondary-button"
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="الشهر السابق"
          >
            ‹
          </button>
          <strong>{label}</strong>
          <button
            className="secondary-button"
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="الشهر التالي"
          >
            ›
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMonth(new Date());
              setSelectedDate(localToday());
            }}
          >
            اليوم
          </button>
        </div>
        <div className="segmented" aria-label="طريقة عرض التقويم">
          {VIEWS.map((item) => (
            <button
              className={view === item ? 'active' : ''}
              type="button"
              onClick={() => setView(item)}
              key={item}
            >
              {item === 'MONTH'
                ? 'شهر'
                : item === 'WEEK'
                  ? 'أسبوع'
                  : item === 'DAY'
                    ? 'يوم'
                    : 'أجندة'}
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-layout">
        <section className="calendar-surface">
          {isLoading ? (
            <p className="table-message">جارٍ تحميل المواعيد…</p>
          ) : view === 'MONTH' ? (
            <CalendarGrid
              month={month}
              events={grouped}
              selectedDate={activeDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <div className="calendar-agenda-list">
              {agendaEntries.map(([date, events]) => (
                <section key={date}>
                  <h3>{date}</h3>
                  {events.map((item) => (
                    <div className="agenda-item" key={item.id}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.eventType}
                        {item.startTime ? ` · ${item.startTime}` : ''}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
              {!agendaEntries.length && (
                <p className="table-message">لا توجد أحداث في نطاق العرض الحالي.</p>
              )}
            </div>
          )}
        </section>
        <aside className="calendar-detail">
          <p className="kicker">التاريخ المحدد</p>
          <h3>{activeDate}</h3>
          {selectedEvents.length ? (
            selectedEvents.map((item) => (
              <div className="agenda-item" key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {item.location ?? 'جلسة قانونية'}
                  {item.caseId
                    ? ` · قضية ${cases.data?.find((entry) => entry.id === item.caseId)?.caseNumber ?? ''}`
                    : ''}
                </span>
                {item.status === 'SCHEDULED' && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      complete.mutate(
                        {
                          id: item.id,
                          outcome: outcome || undefined,
                          decisionText: decisionText || undefined,
                          nextAction: nextAction || undefined,
                          nextHearingDate: nextHearingDate || undefined,
                          createTaskTitle: createTaskTitle || undefined,
                        },
                        {
                          onSuccess: () => {
                            setOutcome('');
                            setDecisionText('');
                            setNextAction('');
                            setNextHearingDate('');
                            setCreateTaskTitle('');
                          },
                        },
                      );
                    }}
                  >
                    <label>
                      نتيجة الجلسة
                      <input
                        value={outcome}
                        onChange={(event) => setOutcome(event.target.value)}
                        placeholder="سجل النتيجة"
                      />
                    </label>
                    <label>
                      نص القرار
                      <input
                        value={decisionText}
                        onChange={(event) => setDecisionText(event.target.value)}
                        placeholder="ما قررته المحكمة"
                      />
                    </label>
                    <label>
                      الإجراء التالي
                      <input
                        value={nextAction}
                        onChange={(event) => setNextAction(event.target.value)}
                        placeholder="ما المطلوب تنفيذه"
                      />
                    </label>
                    <label>
                      موعد الجلسة التالية (اختياري)
                      <input
                        type="date"
                        value={nextHearingDate}
                        onChange={(event) => setNextHearingDate(event.target.value)}
                      />
                    </label>
                    <label>
                      إنشاء مهمة مرتبطة (اختياري)
                      <input
                        value={createTaskTitle}
                        onChange={(event) => setCreateTaskTitle(event.target.value)}
                        placeholder="مثال: تجهيز حافظة المستندات"
                      />
                    </label>
                    <button disabled={complete.isPending}>تسجيل النتيجة والمتابعة</button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p className="muted">لا توجد مواعيد في هذا التاريخ.</p>
          )}
        </aside>
      </div>
      <form className="quick-entry event-entry" onSubmit={submit}>
        <div>
          <label htmlFor="event-title">جلسة أو موعد جديد</label>
          <input
            id="event-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: جلسة المرافعة"
            required
          />
        </div>
        <div>
          <label htmlFor="event-date">التاريخ</label>
          <input
            id="event-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
        <label>
          النوع
          <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            <option value="HEARING">جلسة</option>
            <option value="EXPERT_SESSION">جلسة خبير</option>
            <option value="PROSECUTION_APPOINTMENT">نيابة</option>
            <option value="INVESTIGATION">تحقيق</option>
            <option value="ENFORCEMENT_PROCEDURE">إجراء تنفيذ</option>
            <option value="CLIENT_APPOINTMENT">موعد موكل</option>
            <option value="DEADLINE">ميعاد قانوني</option>
            <option value="OTHER">أخرى</option>
          </select>
        </label>
        <label>
          الوقت (اختياري)
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label>
          القضية (اختياري)
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">موعد عام</option>
            {cases.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.caseNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل (اختياري)
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">بدون موكل مباشر</option>
            {clients.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          المكان
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="المحكمة أو المكتب"
          />
        </label>
        <label className="event-preparation">
          المطلوب تحضيره
          <input
            value={preparationNotes}
            onChange={(event) => setPreparationNotes(event.target.value)}
            placeholder="مذكرة، مستندات، تواصل…"
          />
        </label>
        <button>إضافة إلى الجدول</button>
      </form>
      {(save.isError || complete.isError) && (
        <p className="error" role="alert">
          تعذر حفظ الموعد أو نتيجته. بقيت البيانات في النموذج للمحاولة مرة أخرى.
        </p>
      )}
    </section>
  );
}
