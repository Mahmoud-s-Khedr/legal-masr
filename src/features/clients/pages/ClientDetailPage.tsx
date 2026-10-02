import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Tabs } from '../../../components/ui/Tabs';
import { useCaseList } from '../../cases/api/casesApi';
import { AttachmentPanel } from '../../documents/components/AttachmentPanel';
import { useClientFinanceSummary } from '../../finances/api/financesApi';
import { usePowerOfAttorneyList } from '../../powersOfAttorney/api/powersOfAttorneyApi';
import { ClientForm } from '../forms/ClientForm';
import { useArchiveClient, useClient, useRestoreClient, useUpdateClient } from '../api/clientsApi';

const money = (amount: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount / 100);

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'summary' | 'cases' | 'poas' | 'account' | 'attachments'>(
    'summary',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const client = useClient(id);
  const cases = useCaseList({ clientId: id });
  const powersOfAttorney = usePowerOfAttorneyList({});
  const finance = useClientFinanceSummary(id);
  const update = useUpdateClient();
  const archive = useArchiveClient();
  const restore = useRestoreClient();
  if (client.isLoading) return <p className="table-message">جارٍ التحميل…</p>;
  if (!client.data) return <p className="table-message">الموكل غير موجود.</p>;
  const item = client.data;
  const linkedPowers =
    powersOfAttorney.data?.filter((poa) => poa.clientNames.includes(item.fullName)) ?? [];

  return (
    <section className="entity-detail detail-workspace">
      <header className="detail-hero">
        <div className="detail-avatar" aria-hidden="true">
          {item.fullName.trim().slice(0, 1)}
        </div>
        <div className="detail-title">
          <div className="detail-eyebrow">
            <span>ملف موكل</span>
            {item.archivedAt && <span className="badge">مؤرشف</span>}
          </div>
          <h2>{item.fullName}</h2>
          <p>
            <bdi>{item.internalNumber}</bdi>
            {item.primaryPhone && (
              <>
                {' '}
                · <bdi>{item.primaryPhone}</bdi>
              </>
            )}
          </p>
        </div>
        <div className="detail-actions">
          {item.archivedAt ? (
            <button type="button" onClick={() => restore.mutate(id)}>
              استعادة
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmArchive(true)}
            >
              أرشفة
            </button>
          )}
          <button type="button" onClick={() => setEditOpen(true)}>
            تعديل
          </button>
        </div>
      </header>
      <Tabs
        label="أقسام ملف الموكل"
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { id: 'summary', label: 'ملخص' },
          { id: 'cases', label: 'القضايا' },
          { id: 'poas', label: 'التوكيلات' },
          { id: 'account', label: 'الحساب' },
          { id: 'attachments', label: 'المرفقات' },
        ]}
      />
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-title">
              <h3>بيانات الاتصال</h3>
            </div>
            <dl className="detail-definition-grid">
              <div>
                <dt>الرقم الداخلي</dt>
                <dd>
                  <bdi>{item.internalNumber}</bdi>
                </dd>
              </div>
              <div>
                <dt>الهاتف</dt>
                <dd>{item.primaryPhone ? <bdi>{item.primaryPhone}</bdi> : '—'}</dd>
              </div>
              <div>
                <dt>البريد</dt>
                <dd>{item.email ? <bdi>{item.email}</bdi> : '—'}</dd>
              </div>
              <div>
                <dt>الرقم القومي</dt>
                <dd>{item.nationalId ? <bdi>{item.nationalId}</bdi> : '—'}</dd>
              </div>
            </dl>
            {(item.address || item.notes) && (
              <div className="case-summary-text">
                <span>العنوان والملاحظات</span>
                <p>
                  {item.address ?? '—'}
                  {item.notes && <> — {item.notes}</>}
                </p>
              </div>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>نظرة سريعة</h3>
            </div>
            <strong className="large-metric">
              <bdi>{cases.data?.length ?? 0}</bdi>
            </strong>
            <p className="muted">قضايا مرتبطة بالموكل</p>
            <strong className="large-metric">
              <bdi>{linkedPowers.length}</bdi>
            </strong>
            <p className="muted">توكيلات مسجلة</p>
          </section>
        </div>
      )}
      {tab === 'cases' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>القضايا المرتبطة</h3>
            <Link className="text-link" to="/cases/new">
              إضافة قضية
            </Link>
          </div>
          {!cases.data?.length ? (
            <p className="empty-compact">لا توجد قضايا مرتبطة بهذا الموكل.</p>
          ) : (
            <ul className="compact-records">
              {cases.data.map((caseItem) => (
                <li key={caseItem.id}>
                  <div className="record-copy">
                    <Link to={`/cases/${caseItem.id}`}>
                      <bdi>{caseItem.internalNumber}</bdi>
                    </Link>
                    <span>
                      {caseItem.officialNumber ? (
                        <bdi>{caseItem.officialNumber}</bdi>
                      ) : (
                        'لا يوجد رقم رسمي'
                      )}{' '}
                      · {caseItem.status}
                    </span>
                  </div>
                  <span className="status-chip">{caseItem.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'poas' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>التوكيلات المرتبطة</h3>
            <Link className="text-link" to="/powers-of-attorney">
              إدارة التوكيلات
            </Link>
          </div>
          {!linkedPowers.length ? (
            <p className="empty-compact">لا توجد توكيلات مرتبطة بهذا الموكل.</p>
          ) : (
            <ul className="compact-records">
              {linkedPowers.map((poa) => (
                <li key={poa.id}>
                  <div className="record-copy">
                    <Link to={`/powers-of-attorney/${poa.id}`}>
                      <bdi>{poa.internalSequence}</bdi>
                    </Link>
                    <span>
                      {poa.officialNumber ? <bdi>{poa.officialNumber}</bdi> : 'بدون رقم رسمي'}
                    </span>
                  </div>
                  {poa.archivedAt && <span className="badge">مؤرشف</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'account' && (
        <div className="finance-summary">
          <article>
            <span>المحصل</span>
            <strong>
              <bdi>{money(finance.data?.receivedMinor ?? 0)}</bdi>
            </strong>
          </article>
          <article>
            <span>المصروفات</span>
            <strong>
              <bdi>{money(finance.data?.expensesMinor ?? 0)}</bdi>
            </strong>
          </article>
          <article className="finance-net">
            <span>صافي الحركة</span>
            <strong>
              <bdi>{money(finance.data?.netCashMinor ?? 0)}</bdi>
            </strong>
          </article>
        </div>
      )}
      {tab === 'attachments' && <AttachmentPanel owner={{ clientId: id }} title="مرفقات الموكل" />}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل بيانات الموكل">
        <ClientForm
          defaultValues={{
            internalNumber: item.internalNumber,
            fullName: item.fullName,
            nationalId: item.nationalId ?? undefined,
            primaryPhone: item.primaryPhone ?? undefined,
            email: item.email ?? undefined,
            address: item.address ?? undefined,
            notes: item.notes ?? undefined,
          }}
          busy={update.isPending}
          submitLabel="حفظ التعديلات"
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            try {
              await update.mutateAsync({ id, ...values });
              setEditOpen(false);
            } catch {
              // Keep the modal open so the lawyer can correct or retry the draft.
            }
          }}
        />
        {update.isError && (
          <p className="error" role="alert">
            تعذر حفظ التعديلات. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="أرشفة الموكل"
        description="ستُخفى بيانات الموكل من القوائم الاعتيادية مع بقاء القضايا والسجلات محفوظة. يمكنك استعادته لاحقًا."
        confirmLabel="أرشفة الموكل"
        cancelLabel="إلغاء"
        onConfirm={() => archive.mutate(id, { onSuccess: () => setConfirmArchive(false) })}
      />
    </section>
  );
}
