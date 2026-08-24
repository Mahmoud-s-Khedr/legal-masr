import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HearingDto } from '../../../bridge/types';
import { useCaseList } from '../../cases/api/casesApi';
import { useHearings, useRecordHearingDecision, useSaveHearing } from '../api/hearingsApi';
import { useTaskList } from '../../tasks/api/tasksApi';

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function AgendaPage() {
  const [params] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [caseId, setCaseId] = useState(params.get('case') ?? '');
  const [hearingTime, setHearingTime] = useState('');
  const [hearingType, setHearingType] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [nextDate, setNextDate] = useState('');
  const cases = useCaseList({});
  const hearings = useHearings({});
  const tasks = useTaskList({ view: 'ALL', referenceDate: selectedDate });
  const save = useSaveHearing();
  const decide = useRecordHearingDecision();
  const selectedHearing = hearings.data?.find((item) => item.id === params.get('hearing'));
  const activeDate = selectedHearing?.hearingDate ?? selectedDate;
  const itemsByDate = useMemo(() => {
    const records = new Map<string, { hearings: HearingDto[]; tasks: string[] }>();
    for (const hearing of hearings.data ?? []) {
      const entry = records.get(hearing.hearingDate) ?? { hearings: [], tasks: [] };
      entry.hearings.push(hearing);
      records.set(hearing.hearingDate, entry);
    }
    for (const task of tasks.data ?? []) {
      const entry = records.get(task.dueDate) ?? { hearings: [], tasks: [] };
      entry.tasks.push(task.title);
      records.set(task.dueDate, entry);
    }
    return records;
  }, [hearings.data, tasks.data]);
  const active = itemsByDate.get(activeDate) ?? { hearings: [], tasks: [] };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!caseId) return;
    save.mutate(
      {
        caseId,
        hearingDate: selectedDate,
        hearingTime: hearingTime || undefined,
        hearingType: hearingType || undefined,
        location: location || undefined,
        circuitName: undefined,
        requiredDocuments: undefined,
        notes: notes || undefined,
        reminderMinutes: undefined,
      },
      {
        onSuccess: () => {
          setHearingTime('');
          setHearingType('');
          setLocation('');
          setNotes('');
        },
      },
    );
  };
  return (
    <section className="calendar-page">
      <header className="page-heading calendar-heading">
        <div>
          <p className="kicker">الأجندة</p>
          <h2>الجلسات والمهام</h2>
          <p>كل التواريخ قانونية يومية ولا تتحول بين المناطق الزمنية.</p>
        </div>
      </header>
      <div className="calendar-layout">
        <section className="calendar-surface">
          <label>
            اختر تاريخًا{' '}
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <div className="calendar-agenda-list">
            {[...itemsByDate.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, entry]) => (
                <section key={date}>
                  <h3>{date}</h3>
                  {entry.hearings.map((hearing) => (
                    <button
                      className="agenda-item"
                      type="button"
                      key={hearing.id}
                      onClick={() => setSelectedDate(hearing.hearingDate)}
                    >
                      <strong>جلسة {hearing.hearingType ?? ''}</strong>
                      <span>
                        {hearing.hearingTime ?? 'طوال اليوم'} ·{' '}
                        {hearing.status === 'COMPLETED' ? 'مكتملة' : 'مجدولة'}
                      </span>
                    </button>
                  ))}
                  {entry.tasks.map((task, index) => (
                    <div className="agenda-item" key={`${date}-${index}`}>
                      <strong>مهمة</strong>
                      <span>{task}</span>
                    </div>
                  ))}
                </section>
              ))}
            {!itemsByDate.size && <p className="table-message">لا توجد جلسات أو مهام بعد.</p>}
          </div>
        </section>
        <aside className="calendar-detail">
          <p className="kicker">{activeDate}</p>
          <h3>تفاصيل اليوم</h3>
          {active.hearings.map((hearing) => (
            <div className="agenda-item" key={hearing.id}>
              <strong>{hearing.hearingType ?? 'جلسة'}</strong>
              <span>
                {hearing.location ?? '—'} · {hearing.hearingTime ?? 'طوال اليوم'}
              </span>
              {hearing.status === 'SCHEDULED' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    decide.mutate({
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
                  }}
                >
                  <input
                    value={decisionText}
                    onChange={(event) => setDecisionText(event.target.value)}
                    placeholder="نص القرار"
                  />
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(event) => setNextDate(event.target.value)}
                  />
                  <button disabled={decide.isPending}>تسجيل القرار</button>
                </form>
              )}
            </div>
          ))}
          {active.tasks.map((task, index) => (
            <div className="agenda-item" key={`task-${index}`}>
              <strong>مهمة</strong>
              <span>{task}</span>
            </div>
          ))}
        </aside>
      </div>
      <form className="quick-entry event-entry" onSubmit={submit}>
        <label>
          القضية
          <select required value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">اختر القضية</option>
            {cases.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          التاريخ
          <input
            required
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label>
          الوقت
          <input
            type="time"
            value={hearingTime}
            onChange={(event) => setHearingTime(event.target.value)}
          />
        </label>
        <label>
          نوع الجلسة
          <input value={hearingType} onChange={(event) => setHearingType(event.target.value)} />
        </label>
        <label>
          المكان
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label>
          ملاحظات
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button disabled={save.isPending}>إضافة جلسة</button>
      </form>
      {(save.isError || decide.isError) && (
        <p className="error" role="alert">
          تعذر حفظ الجلسة أو قرارها. بقيت البيانات المدخلة للمحاولة مرة أخرى.
        </p>
      )}
    </section>
  );
}
