import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDocuments } from '../../documents/api/documentsApi';
import {
  useCaseFinanceSummary,
  usePayments,
  useSaveFeeAgreement,
} from '../../finances/api/financesApi';
import { useHearings } from '../../hearings/api/hearingsApi';
import { useTaskList } from '../../tasks/api/tasksApi';
import { parseMoneyToMinor } from '../../finances/pages/FinancesPage';
import { useArchiveCase, useCase, useRestoreCase, useUpdateCase } from '../api/casesApi';
import { CaseClientsPanel } from '../components/CaseClientsPanel';
import { CasePartiesPanel } from '../components/CasePartiesPanel';
import { CaseEditForm } from '../forms/CaseEditForm';

const money = (amount: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount / 100);
export function CaseDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<
    'summary' | 'relationships' | 'hearings' | 'tasks' | 'attachments' | 'account' | 'edit'
  >('summary');
  const [fee, setFee] = useState('');
  const item = useCase(id);
  const hearings = useHearings({ caseId: id });
  const tasks = useTaskList({ view: 'ALL', referenceDate: '9999-12-31', caseId: id });
  const attachments = useDocuments({ caseId: id });
  const account = useCaseFinanceSummary(id);
  const payments = usePayments({ caseId: id });
  const archive = useArchiveCase();
  const restore = useRestoreCase();
  const update = useUpdateCase();
  const saveFee = useSaveFeeAgreement();
  if (item.isLoading) return <p>جارٍ التحميل…</p>;
  if (!item.data) return <p>القضية غير موجودة.</p>;
  const caseDto = item.data;
  const nextHearing = hearings.data?.find((hearing) => hearing.status === 'SCHEDULED');
  return (
    <section className="entity-detail">
      <header className="detail-hero">
        <div>
          <p className="kicker">قضية</p>
          <h2>{caseDto.internalNumber}</h2>
          <p>
            {caseDto.officialNumber
              ? `${caseDto.officialNumber}${caseDto.officialYear ? ` / ${caseDto.officialYear}` : ''}`
              : 'لا يوجد رقم رسمي'}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="button-link" to={`/calendar?case=${id}`}>
            إضافة جلسة
          </Link>
          {caseDto.archivedAt ? (
            <button onClick={() => restore.mutate(id)}>استعادة</button>
          ) : (
            <button className="secondary-button" onClick={() => archive.mutate(id)}>
              أرشفة
            </button>
          )}
        </div>
      </header>
      <nav className="detail-tabs">
        {(
          [
            'summary',
            'relationships',
            'hearings',
            'tasks',
            'attachments',
            'account',
            'edit',
          ] as const
        ).map((value) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </nav>
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <h3>بيانات القضية</h3>
            <dl>
              <dt>المحكمة</dt>
              <dd>{caseDto.courtName ?? '—'}</dd>
              <dt>الموضوع</dt>
              <dd>{caseDto.subject ?? '—'}</dd>
              <dt>الجلسة القادمة</dt>
              <dd>
                {nextHearing ? `${nextHearing.hearingDate} ${nextHearing.hearingTime ?? ''}` : '—'}
              </dd>
            </dl>
          </section>
        </div>
      )}
      {tab === 'relationships' && (
        <>
          <CaseClientsPanel caseDto={caseDto} />
          <CasePartiesPanel caseDto={caseDto} />
        </>
      )}
      {tab === 'hearings' && (
        <section className="detail-card">
          <h3>الجلسات</h3>
          <ul>
            {hearings.data?.map((hearing) => (
              <li key={hearing.id}>
                {hearing.hearingDate} · {hearing.hearingType ?? 'جلسة'} · {hearing.status}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'tasks' && (
        <section className="detail-card">
          <h3>المهام</h3>
          <ul>
            {tasks.data?.map((task) => (
              <li key={task.id}>
                {task.completed ? '✓' : '○'} {task.title} · {task.dueDate}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'attachments' && (
        <section className="detail-card">
          <h3>المرفقات</h3>
          <Link to={`/documents?case=${id}`}>إضافة مرفق</Link>
          <ul>
            {attachments.data?.map((attachment) => (
              <li key={attachment.id}>{attachment.originalFilename}</li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'account' && (
        <section className="detail-card">
          <h3>الحساب</h3>
          <p>
            المتفق عليه: {money(account.data?.agreedFeeMinor ?? 0)} · المحصل:{' '}
            {money(account.data?.receivedMinor ?? 0)}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const amount = parseMoneyToMinor(fee);
              if (amount) saveFee.mutate({ caseId: id, amountMinor: amount });
            }}
          >
            <input
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              inputMode="decimal"
            />
            <button>حفظ اتفاق الأتعاب</button>
          </form>
          <ul>
            {payments.data?.map((payment) => (
              <li key={payment.id}>
                {payment.paymentDate} · {money(payment.amountMinor)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'edit' && (
        <CaseEditForm
          caseDto={caseDto}
          busy={update.isPending}
          onSubmit={async (values) => {
            await update.mutateAsync({
              id,
              ...values,
              officialYear: Number.isNaN(values.officialYear) ? undefined : values.officialYear,
              clients: caseDto.clients.map((client) => ({
                clientId: client.clientId,
                legalCapacity: client.legalCapacity ?? undefined,
                powerOfAttorneyId: client.powerOfAttorneyId ?? undefined,
                notes: client.notes ?? undefined,
              })),
            });
            setTab('summary');
          }}
        />
      )}
    </section>
  );
}
