import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Fact, RecordHeader } from '../../../components/layout/RecordHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useCaseList } from '../../cases/api/casesApi';
import { CaseStatusBadge } from '../../cases/components/CaseIdentity';
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
  const { t } = useTranslation();
  const format = useFormat();
  const { id = '' } = useParams();
  const cases = useCaseList({ includeArchived: true });
  const [tab, setTab] = useState<'summary' | 'clients' | 'lawyers' | 'cases' | 'attachments'>(
    'summary',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const power = usePowerOfAttorney(id);
  const save = useSavePowerOfAttorney();
  const archive = useArchivePowerOfAttorney();
  const restore = useRestorePowerOfAttorney();
  if (power.isLoading)
    return (
      <p className="page-status" role="status">
        {t('records.loading')}
      </p>
    );
  if (power.isError)
    return (
      <p className="page-status error" role="alert">
        {t('records.loadError')}
      </p>
    );
  if (!power.data) return <p className="page-status">التوكيل غير موجود.</p>;
  const item = power.data;
  return (
    <section className="entity-detail detail-workspace">
      {(restore.isError || (archive.isError && !archiveOpen)) && (
        <p className="error" role="alert">
          {t('records.statusChangeError')}
        </p>
      )}
      <RecordHeader
        icon="poa"
        kicker="توكيل"
        title={<bdi>{item.internalSequence}</bdi>}
        badges={
          item.archivedAt && (
            <span className="status-badge tone-muted">{t('records.archived')}</span>
          )
        }
        meta={
          <>
            <span>
              {item.officialNumber ? (
                <>
                  رقم <bdi className="mono">{item.officialNumber}</bdi>
                  {item.issueYear ? <> لسنة {item.issueYear}</> : null}
                </>
              ) : (
                'لا يوجد رقم رسمي'
              )}
            </span>
            {item.notaryOffice && <span dir="auto">{item.notaryOffice}</span>}
            {item.clients.length > 0 && (
              <span dir="auto">{item.clients.map((client) => client.fullName).join('، ')}</span>
            )}
          </>
        }
        actions={
          <>
            <Button type="button" onClick={() => setEditOpen(true)}>
              {t('records.edit')}
            </Button>
            {item.archivedAt ? (
              <Button
                type="button"
                variant="secondary"
                className="secondary-button"
                disabled={restore.isPending}
                onClick={() => restore.mutate(id)}
              >
                {t('records.restore')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="quiet-button"
                onClick={() => setArchiveOpen(true)}
              >
                {t('records.archive')}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        variant="underline"
        label="أقسام التوكيل"
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { id: 'summary', label: 'ملخص' },
          { id: 'clients', label: 'الموكلون', count: item.clients.length },
          { id: 'lawyers', label: 'المحامون', count: item.lawyers.length },
          { id: 'cases', label: 'القضايا', count: item.caseIds.length },
          { id: 'attachments', label: 'المرفقات' },
        ]}
      />
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-title">
              <h3>بيانات التوكيل</h3>
            </div>
            <dl className="facts">
              <Fact label="رقم التوكيل الرسمي">
                {item.officialNumber && <bdi className="mono">{item.officialNumber}</bdi>}
              </Fact>
              <Fact label="سنة الإصدار">{item.issueYear}</Fact>
              <Fact label="تاريخ الإصدار">{item.issueDate && format.date(item.issueDate)}</Fact>
              <Fact label="مكتب التوثيق">{item.notaryOffice}</Fact>
              {item.notes && (
                <Fact label="ملاحظات" wide>
                  <span className="prewrap">{item.notes}</span>
                </Fact>
              )}
            </dl>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>الموكلون في التوكيل</h3>
            </div>
            <ul className="compact-records">
              {item.clients.map((client) => (
                <li key={client.id}>
                  <div className="record-copy">
                    <Link to={`/clients/${client.id}`}>
                      <bdi>{client.fullName}</bdi>
                    </Link>
                    <span>
                      <bdi className="mono">{client.internalNumber}</bdi>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="facts facts-compact">
              <Fact label="المحامون المذكورون">{format.number(item.lawyers.length)}</Fact>
              <Fact label="قضايا مرتبطة">{format.number(item.caseIds.length)}</Fact>
            </dl>
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
              {item.caseIds.map((caseId) => {
                const linked = cases.data?.find((caseItem) => caseItem.id === caseId);
                return (
                  <li key={caseId}>
                    <div className="record-copy">
                      <Link to={`/cases/${caseId}`}>
                        <bdi>{linked?.internalNumber ?? 'فتح القضية المرتبطة'}</bdi>
                      </Link>
                      {linked && <span dir="auto">{linked.clientNames.join('، ')}</span>}
                    </div>
                    {linked && (
                      <CaseStatusBadge status={linked.status} archived={!!linked.archivedAt} />
                    )}
                  </li>
                );
              })}
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
        {save.isError && (
          <p className="error" role="alert">
            تعذر حفظ التوكيل. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="أرشفة التوكيل"
        description="سيبقى التوكيل وسجل علاقاته محفوظين، لكنه لن يظهر في القوائم الاعتيادية."
        confirmLabel="أرشفة"
        cancelLabel="إلغاء"
        pending={archive.isPending}
        error={archive.isError ? 'تعذر أرشفة السجل.' : undefined}
        onConfirm={() => archive.mutate(id, { onSuccess: () => setArchiveOpen(false) })}
      />
    </section>
  );
}
