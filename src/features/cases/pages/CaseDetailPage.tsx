import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import { Icon } from '../../../components/layout/Icon';
import { useDocuments } from '../../documents/api/documentsApi';
import { useEventList } from '../../events/api/eventsApi';
import {
  useCaseFinanceSummary,
  useSaveFeeAgreement,
  useTransactions,
} from '../../finances/api/financesApi';
import { parseMoneyToMinor } from '../../finances/pages/FinancesPage';
import { useTaskList } from '../../tasks/api/tasksApi';
import {
  useArchiveCase,
  useCase,
  useExportCase,
  useRestoreCase,
  useUpdateCase,
} from '../api/casesApi';
import { CaseClientsPanel } from '../components/CaseClientsPanel';
import { CasePartiesPanel } from '../components/CasePartiesPanel';
import { CaseEditForm } from '../forms/CaseEditForm';

const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(value / 100);
type Tab = 'summary' | 'parties' | 'hearings' | 'tasks' | 'documents' | 'account' | 'edit';

export function CaseDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [tab, setTab] = useState<Tab>('summary');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeError, setFeeError] = useState('');
  const { data: caseDto, isLoading } = useCase(id);
  const { data: events } = useEventList({ caseId: id });
  const { data: tasks } = useTaskList({ caseId: id });
  const { data: documents } = useDocuments({ caseId: id });
  const { data: finance } = useCaseFinanceSummary(id);
  const { data: transactions } = useTransactions({ caseId: id });
  const updateCase = useUpdateCase();
  const archiveCase = useArchiveCase();
  const restoreCase = useRestoreCase();
  const exportCaseMutation = useExportCase();
  const saveFee = useSaveFeeAgreement();

  if (isLoading) return <p>{t('cases.loading')}</p>;
  if (!caseDto) return <p>{t('cases.detail.notFound')}</p>;
  const nextEvent = events
    ?.filter((event) => event.status === 'SCHEDULED')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  const lastCompleted = events
    ?.filter((event) => event.status === 'COMPLETED')
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];
  const openTasks = tasks?.filter((task) => task.status === 'OPEN') ?? [];
  const archive = () => {
    if (
      window.confirm(
        'ستُخفى القضية من القوائم اليومية مع بقاء سجلها قابلًا للبحث والاستعادة. هل تريد المتابعة؟',
      )
    )
      archiveCase.mutate(caseDto.id);
  };
  const exportCase = () => exportCaseMutation.mutate(caseDto.id);
  const saveAgreement = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountMinor = parseMoneyToMinor(feeAmount);
    if (!amountMinor) return setFeeError('أدخل قيمة صحيحة أكبر من صفر وبحد أقصى منزلتين عشريتين.');
    setFeeError('');
    await saveFee.mutateAsync({ caseId: caseDto.id, amountMinor });
    setFeeAmount('');
  };

  return (
    <section className="entity-detail detail-workspace">
      <header className="detail-hero case-hero">
        <div className="case-symbol" aria-hidden="true">
          <Icon name="cases" size={28} />
        </div>
        <div className="detail-title">
          <div className="detail-eyebrow">
            <span>{caseDto.caseType || 'قضية'}</span>
            <span className="status-chip">{t(`cases.status.${caseDto.status}`)}</span>
            {caseDto.archivedAt && <span className="badge">مؤرشفة</span>}
          </div>
          <h2>
            {caseDto.caseNumber}
            {caseDto.judicialYear ? ` / ${caseDto.judicialYear}` : ''}
          </h2>
          <p>
            {[
              caseDto.courtName,
              caseDto.circuitName,
              caseDto.clients.find((client) => client.isPrimary)?.displayName,
            ]
              .filter(Boolean)
              .join(' · ') || 'لم تُستكمل بيانات المحكمة والموكل'}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="button-link" to={`/calendar?case=${caseDto.id}`}>
            <Icon name="calendar" size={18} />
            إضافة جلسة
          </Link>
          <Link className="button-link secondary-link" to={`/tasks?case=${caseDto.id}`}>
            <Icon name="tasks" size={18} />
            إضافة مهمة
          </Link>
          <button
            className="secondary-button"
            type="button"
            onClick={exportCase}
            disabled={exportCaseMutation.isPending}
          >
            <Icon name="backup" size={18} />
            تصدير
          </button>
          {caseDto.archivedAt ? (
            <button onClick={() => restoreCase.mutate(caseDto.id)}>استعادة</button>
          ) : (
            <button className="secondary-button danger-button" onClick={archive}>
              <Icon name="archive" size={18} />
              أرشفة
            </button>
          )}
        </div>
      </header>
      {exportCaseMutation.isError && (
        <p className="error" role="alert">
          تعذر تصدير ملف القضية إلى المجلد المحدد.
        </p>
      )}

      <nav className="detail-tabs" aria-label="أقسام ملف القضية">
        {(
          [
            ['summary', 'الملخص'],
            ['parties', `الأطراف (${caseDto.parties.length + caseDto.clients.length})`],
            ['hearings', `الجلسات (${events?.length ?? 0})`],
            ['tasks', `المهام (${openTasks.length})`],
            ['documents', `المستندات (${documents?.length ?? 0})`],
            ['account', 'الحساب'],
            ['edit', 'تعديل'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'summary' && (
        <div className="case-summary-layout">
          <div className="detail-grid case-main-summary">
            <section className="detail-card detail-card-wide">
              <div className="card-title">
                <h3>معلومات القضية</h3>
              </div>
              <dl className="detail-definition-grid">
                <div>
                  <dt>رقم القضية</dt>
                  <dd dir="ltr">{caseDto.caseNumber}</dd>
                </div>
                <div>
                  <dt>السنة القضائية</dt>
                  <dd>{caseDto.judicialYear ?? '—'}</dd>
                </div>
                <div>
                  <dt>المحكمة</dt>
                  <dd>{caseDto.courtName ?? '—'}</dd>
                </div>
                <div>
                  <dt>الدائرة</dt>
                  <dd>{caseDto.circuitName ?? '—'}</dd>
                </div>
                <div>
                  <dt>نوع القضية</dt>
                  <dd>{caseDto.caseType ?? '—'}</dd>
                </div>
                <div>
                  <dt>صفة الموكل</dt>
                  <dd>{caseDto.clientLegalCapacity ?? '—'}</dd>
                </div>
              </dl>
              {caseDto.summary && (
                <div className="case-summary-text">
                  <span>موضوع القضية</span>
                  <p>{caseDto.summary}</p>
                </div>
              )}
            </section>
            <section className="detail-card detail-card-wide">
              <div className="card-title">
                <h3>آخر قرار مسجل</h3>
              </div>
              {lastCompleted ? (
                <div className="decision-card">
                  <time dir="ltr">{lastCompleted.eventDate}</time>
                  <strong>{lastCompleted.title}</strong>
                  <p>
                    {lastCompleted.decisionText ||
                      lastCompleted.outcome ||
                      'تمت الجلسة من دون نص قرار.'}
                  </p>
                  {lastCompleted.nextAction && (
                    <small>الإجراء التالي: {lastCompleted.nextAction}</small>
                  )}
                </div>
              ) : (
                <p className="table-message">لا توجد جلسة مكتملة بنتيجة مسجلة بعد.</p>
              )}
            </section>
          </div>
          <aside className="case-side-summary">
            <section className="detail-card next-event-card">
              <div className="card-title">
                <h3>الجلسة القادمة</h3>
              </div>
              {nextEvent ? (
                <>
                  <time dir="ltr">{nextEvent.eventDate}</time>
                  <strong>{nextEvent.startTime ?? 'طوال اليوم'}</strong>
                  <p>{nextEvent.title}</p>
                  <span>{nextEvent.location ?? caseDto.courtName ?? '—'}</span>
                  {nextEvent.preparationNotes && <small>{nextEvent.preparationNotes}</small>}
                  <Link to={`/calendar?event=${nextEvent.id}`}>فتح تفاصيل الجلسة</Link>
                </>
              ) : (
                <>
                  <p>لا توجد جلسة قادمة.</p>
                  <Link className="button-link compact-button" to={`/calendar?case=${caseDto.id}`}>
                    إضافة جلسة
                  </Link>
                </>
              )}
            </section>
            <section className="detail-card">
              <div className="card-title">
                <h3>المهام المفتوحة</h3>
                <button className="text-button" onClick={() => setTab('tasks')}>
                  عرض الكل
                </button>
              </div>
              {!openTasks.length ? (
                <p className="muted">لا توجد مهام مفتوحة.</p>
              ) : (
                <ul className="compact-records">
                  {openTasks.slice(0, 4).map((task) => (
                    <li key={task.id}>
                      <Link to={`/tasks?task=${task.id}`}>{task.title}</Link>
                      <span>{task.dueDate ?? 'بدون تاريخ'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}

      {tab === 'parties' && (
        <div className="detail-stack">
          <CaseClientsPanel caseDto={caseDto} />
          <CasePartiesPanel caseDto={caseDto} />
        </div>
      )}
      {tab === 'hearings' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>الجلسات والأحداث</h3>
            <Link className="button-link compact-button" to={`/calendar?case=${caseDto.id}`}>
              إضافة جلسة
            </Link>
          </div>
          {!events?.length ? (
            <p className="table-message">لا توجد جلسات أو أحداث مرتبطة بالقضية.</p>
          ) : (
            <ul className="timeline-list">
              {[...events]
                .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
                .map((event) => (
                  <li key={event.id}>
                    <time dir="ltr">
                      {event.eventDate}
                      {event.startTime ? ` · ${event.startTime}` : ''}
                    </time>
                    <div>
                      <Link to={`/calendar?event=${event.id}`}>{event.title}</Link>
                      <span>
                        {event.location ?? '—'} ·{' '}
                        {event.status === 'COMPLETED' ? 'مكتملة' : 'مجدولة'}
                      </span>
                      {event.outcome && <p>{event.outcome}</p>}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'tasks' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>مهام القضية</h3>
            <Link className="button-link compact-button" to={`/tasks?case=${caseDto.id}`}>
              إضافة مهمة
            </Link>
          </div>
          {!tasks?.length ? (
            <p className="table-message">لا توجد مهام مرتبطة بالقضية.</p>
          ) : (
            <ul className="compact-records">
              {tasks.map((task) => (
                <li key={task.id}>
                  <span className={`status-chip ${task.status.toLowerCase()}`}>
                    {task.status === 'OPEN'
                      ? 'مفتوحة'
                      : task.status === 'COMPLETED'
                        ? 'مكتملة'
                        : 'ملغاة'}
                  </span>
                  <Link to={`/tasks?task=${task.id}`}>{task.title}</Link>
                  <span>
                    {task.dueDate ?? 'بدون تاريخ'} · {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'documents' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>مستندات القضية</h3>
            <Link className="button-link compact-button" to={`/documents?case=${caseDto.id}`}>
              إضافة مستند
            </Link>
          </div>
          {!documents?.length ? (
            <p className="table-message">لا توجد مستندات مرتبطة بالقضية.</p>
          ) : (
            <ul className="compact-records">
              {documents.map((document) => (
                <li key={document.id}>
                  <span className="file-mark">
                    {document.originalFilename.split('.').at(-1)?.toUpperCase() ?? 'FILE'}
                  </span>
                  <Link to={`/documents?document=${document.id}`}>{document.originalFilename}</Link>
                  <span>{document.category}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'account' && (
        <div className="detail-stack">
          <section className="detail-card">
            <div className="card-title">
              <h3>ملخص حساب القضية</h3>
              <Link className="button-link compact-button" to={`/finances?case=${caseDto.id}`}>
                فتح الكشف
              </Link>
            </div>
            <div className="finance-summary embedded-summary">
              <article>
                <span>الأتعاب المتفق عليها</span>
                <strong>{money(finance?.agreedFeeMinor ?? 0)}</strong>
              </article>
              <article>
                <span>المحصل</span>
                <strong>{money(finance?.receivedMinor ?? 0)}</strong>
              </article>
              <article>
                <span>المتبقي</span>
                <strong>{money(finance?.outstandingMinor ?? 0)}</strong>
              </article>
              <article>
                <span>المصروفات</span>
                <strong>{money(finance?.expensesMinor ?? 0)}</strong>
              </article>
            </div>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>تحديد الأتعاب المتفق عليها</h3>
            </div>
            <form className="inline-form" onSubmit={saveAgreement}>
              <label>
                قيمة الأتعاب (ج.م)
                <input
                  dir="ltr"
                  inputMode="decimal"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                  placeholder={
                    finance?.agreedFeeMinor ? String(finance.agreedFeeMinor / 100) : '0.00'
                  }
                />
              </label>
              <button disabled={saveFee.isPending}>حفظ الاتفاق</button>
            </form>
            {feeError && <p className="error">{feeError}</p>}
            {saveFee.isSuccess && <p className="success">تم تحديث اتفاق الأتعاب.</p>}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>آخر الحركات</h3>
            </div>
            {!transactions?.length ? (
              <p className="table-message">لا توجد حركات مالية لهذه القضية.</p>
            ) : (
              <ul className="compact-records">
                {transactions.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <time dir="ltr">{item.transactionDate}</time>
                    <strong>{item.description || item.transactionType}</strong>
                    <span>{money(item.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {tab === 'edit' && (
        <section className="detail-card edit-card">
          <div className="card-title">
            <h3>تعديل بيانات القضية</h3>
          </div>
          <CaseEditForm
            caseDto={caseDto}
            busy={updateCase.isPending}
            onSubmit={async (values) => {
              await updateCase.mutateAsync({
                id: caseDto.id,
                ...values,
                judicialYear: Number.isNaN(values.judicialYear) ? undefined : values.judicialYear,
              });
              setTab('summary');
            }}
          />
          {updateCase.isError && (
            <p className="error">{errorMessage(updateCase.error, t('app.defaultError'))}</p>
          )}
        </section>
      )}
    </section>
  );
}
