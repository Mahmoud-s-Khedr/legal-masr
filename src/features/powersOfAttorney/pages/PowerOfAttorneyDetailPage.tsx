import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/button';
import { AttachmentPanel } from '../../documents/components/AttachmentPanel';
import { PowerOfAttorneyForm } from '../components/PowerOfAttorneyForm';
import {
  useArchivePowerOfAttorney,
  usePowerOfAttorney,
  useRestorePowerOfAttorney,
  useSavePowerOfAttorney,
} from '../api/powersOfAttorneyApi';

export function PowerOfAttorneyDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'summary' | 'clients' | 'lawyers' | 'cases' | 'attachments'>(
    'summary',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const power = usePowerOfAttorney(id);
  const save = useSavePowerOfAttorney();
  const archive = useArchivePowerOfAttorney();
  const restore = useRestorePowerOfAttorney();
  if (power.isLoading) return <p className="table-message">جارٍ التحميل…</p>;
  if (!power.data) return <p className="table-message">التوكيل غير موجود.</p>;
  const item = power.data;
  return (
    <section className="entity-detail detail-workspace">
      <header className="detail-hero">
        <div className="case-symbol" aria-hidden="true">
          ت
        </div>
        <div className="detail-title">
          <div className="detail-eyebrow">
            <span>توكيل</span>
            {item.archivedAt && <span className="badge">مؤرشف</span>}
          </div>
          <h2>
            <bdi>{item.internalSequence}</bdi>
          </h2>
          <p>{item.officialNumber ? <bdi>{item.officialNumber}</bdi> : 'لا يوجد رقم رسمي'}</p>
        </div>
        <div className="detail-actions">
          {item.archivedAt ? (
            <Button type="button" onClick={() => restore.mutate(id)}>
              استعادة
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="secondary-button"
              onClick={() => setArchiveOpen(true)}
            >
              أرشفة
            </Button>
          )}
          <Button type="button" onClick={() => setEditOpen(true)}>
            تعديل
          </Button>
        </div>
      </header>
      <Tabs
        label="أقسام التوكيل"
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { id: 'summary', label: 'ملخص' },
          { id: 'clients', label: 'الموكلون' },
          { id: 'lawyers', label: 'المحامون' },
          { id: 'cases', label: 'القضايا' },
          { id: 'attachments', label: 'المرفقات' },
        ]}
      />
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-title">
              <h3>بيانات التوكيل</h3>
            </div>
            <dl className="detail-definition-grid">
              <div>
                <dt>رقم التوكيل</dt>
                <dd>{item.officialNumber ? <bdi>{item.officialNumber}</bdi> : '—'}</dd>
              </div>
              <div>
                <dt>تاريخ الإصدار</dt>
                <dd>{item.issueDate ? <bdi>{item.issueDate}</bdi> : '—'}</dd>
              </div>
              <div>
                <dt>مكتب التوثيق</dt>
                <dd>{item.notaryOffice ?? '—'}</dd>
              </div>
            </dl>
            {item.notes && (
              <div className="case-summary-text">
                <span>ملاحظات</span>
                <p>{item.notes}</p>
              </div>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>الارتباطات</h3>
            </div>
            <strong className="large-metric">
              <bdi>{item.clients.length}</bdi>
            </strong>
            <p className="muted">موكلون</p>
            <strong className="large-metric">
              <bdi>{item.caseIds.length}</bdi>
            </strong>
            <p className="muted">قضايا مرتبطة</p>
          </section>
        </div>
      )}
      {tab === 'clients' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>الموكلون</h3>
          </div>
          <ul className="compact-records">
            {item.clients.map((client) => (
              <li key={client.id}>
                <div className="record-copy">
                  <Link to={`/clients/${client.id}`}>{client.fullName}</Link>
                  <span>
                    <bdi>{client.internalNumber}</bdi>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'lawyers' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>المحامون المذكورون</h3>
          </div>
          {!item.lawyers.length ? (
            <p className="empty-compact">لا يوجد محامون مسجلون في هذا التوكيل.</p>
          ) : (
            <ul className="compact-records">
              {item.lawyers.map((lawyer) => (
                <li key={lawyer.id}>
                  <div className="record-copy">
                    <strong>{lawyer.fullName}</strong>
                    <span>
                      {lawyer.barNumber ? <bdi>{lawyer.barNumber}</bdi> : 'دون رقم قيد'}
                      {lawyer.notes && ` · ${lawyer.notes}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'cases' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>القضايا المرتبطة</h3>
          </div>
          {!item.caseIds.length ? (
            <p className="empty-compact">لا توجد قضايا مرتبطة بالتوكيل.</p>
          ) : (
            <ul className="compact-records">
              {item.caseIds.map((caseId) => (
                <li key={caseId}>
                  <Link to={`/cases/${caseId}`}>فتح القضية المرتبطة</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'attachments' && (
        <AttachmentPanel owner={{ powerOfAttorneyId: id }} title="صورة التوكيل والمرفقات" />
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل التوكيل">
        <PowerOfAttorneyForm
          powerOfAttorney={item}
          busy={save.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (input) => {
            try {
              await save.mutateAsync({ id, ...input });
              setEditOpen(false);
            } catch {
              // Keep the modal open so the lawyer can correct or retry the draft.
            }
          }}
        />
        {save.isError && <p className="error">تعذر حفظ التوكيل.</p>}
      </Dialog>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="أرشفة التوكيل"
        description="سيبقى التوكيل وسجل علاقاته محفوظين، لكنه لن يظهر في القوائم الاعتيادية."
        confirmLabel="أرشفة"
        cancelLabel="إلغاء"
        onConfirm={() => archive.mutate(id, { onSuccess: () => setArchiveOpen(false) })}
      />
    </section>
  );
}
