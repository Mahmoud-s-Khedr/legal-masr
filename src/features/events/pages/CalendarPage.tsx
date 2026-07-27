import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EventDto } from '../../../bridge/types';
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
  const [outcome, setOutcome] = useState('');
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
  const label = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(month);
  const moveMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      save.mutate(
        { title, eventDate: selectedDate, eventType: 'HEARING', isAllDay: true },
        { onSuccess: () => setTitle('') },
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
              {Object.entries(grouped).map(([date, events]) => (
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
              {!data.length && <p className="table-message">لا توجد أحداث مجدولة بعد.</p>}
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
                <span>{item.location ?? 'جلسة قانونية'}</span>
                {item.status === 'SCHEDULED' && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      complete.mutate({ id: item.id, outcome: outcome || undefined });
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
                    <button disabled={complete.isPending}>تسجيل النتيجة</button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p className="muted">لا توجد مواعيد في هذا التاريخ.</p>
          )}
        </aside>
      </div>
      <form className="quick-entry" onSubmit={submit}>
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
        <button>إضافة إلى الجدول</button>
      </form>
    </section>
  );
}
