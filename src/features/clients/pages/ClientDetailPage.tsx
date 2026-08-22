import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import { Icon } from '../../../components/layout/Icon';
import { useCaseList } from '../../cases/api/casesApi';
import { useDocuments } from '../../documents/api/documentsApi';
import { useEventList } from '../../events/api/eventsApi';
import { useClientFinanceSummary } from '../../finances/api/financesApi';
import {
  useArchiveClient,
  useClient,
  useExportClient,
  useRestoreClient,
  useUpdateClient,
} from '../api/clientsApi';
import { ClientForm } from '../forms/ClientForm';

const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(value / 100);
type Tab = 'summary' | 'cases' | 'documents' | 'account' | 'edit';

export function ClientDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [tab, setTab] = useState<Tab>('summary');
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCaseList({ clientId: id, includeArchived: true });
  const { data: events } = useEventList({ clientId: id });
  const { data: documents } = useDocuments({ clientId: id });
  const { data: finance } = useClientFinanceSummary(id);
  const updateClient = useUpdateClient();
  const archiveClient = useArchiveClient();
  const restoreClient = useRestoreClient();
  const exportClient = useExportClient();

  if (isLoading) return <p>{t('clients.loading')}</p>;
  if (!client) return <p>{t('clients.detail.notFound')}</p>;
  const activeCases = cases?.filter((item) => !item.archivedAt) ?? [];
  const upcomingEvents = events?.filter((event) => event.status === 'SCHEDULED').slice(0, 4) ?? [];
  const archive = () => {
    if (
      window.confirm(
        'ستُخفى بطاقة الموكل من القوائم اليومية مع بقاء قضاياه وبياناته. هل تريد المتابعة؟',
      )
    )
      archiveClient.mutate(client.id);
  };
  const exportRecord = async () => {
    const destination = await open({ directory: true, multiple: false });
    if (typeof destination === 'string') exportClient.mutate({ id: client.id, destination });
  };

  return (
    <section className="entity-detail detail-workspace">
      <header className="detail-hero">
        <div className="detail-avatar" aria-hidden="true">
          {client.displayName.trim().charAt(0)}
        </div>
        <div className="detail-title">
          <div className="detail-eyebrow">
            <span>{client.clientType === 'INDIVIDUAL' ? 'موكل فرد' : 'جهة أو شركة'}</span>
            {client.archivedAt && <span className="badge">مؤرشف</span>}
          </div>
          <h2>{client.displayName}</h2>
          <p>
            {client.primaryPhone ?? 'لا يوجد هاتف'}
            {client.email ? ` · ${client.email}` : ''}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="button-link" to="/cases/new">
            <Icon name="plus" size={18} />
            إضافة قضية
          </Link>
          <button
            className="secondary-button"
            type="button"
            onClick={exportRecord}
            disabled={exportClient.isPending}
          >
            <Icon name="backup" size={18} />
            تصدير
          </button>
          {client.archivedAt ? (
            <button type="button" onClick={() => restoreClient.mutate(client.id)}>
              استعادة
            </button>
          ) : (
            <button className="secondary-button danger-button" type="button" onClick={archive}>
              <Icon name="archive" size={18} />
              أرشفة
            </button>
          )}
        </div>
      </header>

      <nav className="detail-tabs" aria-label="أقسام ملف الموكل">
        {(
          [
            ['summary', 'الملخص'],
            ['cases', `القضايا (${cases?.length ?? 0})`],
            ['documents', `المستندات (${documents?.length ?? 0})`],
            ['account', 'الحساب'],
            ['edit', 'تعديل البيانات'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'active' : ''}
            aria-current={tab === value ? 'page' : undefined}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card detail-card-wide">
            <div className="card-title">
              <h3>بيانات التواصل</h3>
            </div>
            <dl className="detail-definition-grid">
              <div>
                <dt>الهاتف</dt>
                <dd dir="ltr">{client.primaryPhone ?? '—'}</dd>
              </div>
              <div>
                <dt>البريد الإلكتروني</dt>
                <dd>{client.email ?? '—'}</dd>
              </div>
              <div>
                <dt>{client.clientType === 'INDIVIDUAL' ? 'الرقم القومي' : 'رقم التسجيل'}</dt>
                <dd dir="ltr">
                  {client.clientType === 'INDIVIDUAL'
                    ? (client.nationalId ?? '—')
                    : (client.registrationNumber ?? '—')}
                </dd>
              </div>
              <div>
                <dt>العنوان</dt>
                <dd>{client.address ?? '—'}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>القضايا النشطة</h3>
              <button className="text-button" type="button" onClick={() => setTab('cases')}>
                عرض الكل
              </button>
            </div>
            <strong className="large-metric">{activeCases.length}</strong>
            <span className="muted">قضية غير مؤرشفة</span>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>الرصيد الحالي</h3>
              <Link to={`/finances?client=${client.id}`}>فتح المالية</Link>
            </div>
            <strong
              className={`large-metric ${(finance?.netCashMinor ?? 0) < 0 ? 'money-negative' : ''}`}
            >
              {money(finance?.netCashMinor ?? 0)}
            </strong>
            <span className="muted">صافي الحركة المسجلة</span>
          </section>
          <section className="detail-card detail-card-wide">
            <div className="card-title">
              <h3>المواعيد القادمة</h3>
              <Link to={`/calendar?client=${client.id}`}>الجدول</Link>
            </div>
            {!upcomingEvents.length ? (
              <p className="table-message">لا توجد مواعيد قادمة مرتبطة بهذا الموكل.</p>
            ) : (
              <ul className="compact-records">
                {upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <time dir="ltr">
                      {event.eventDate}
                      {event.startTime ? ` · ${event.startTime}` : ''}
                    </time>
                    <Link to={`/calendar?event=${event.id}`}>{event.title}</Link>
                    <span>{event.location ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>ملاحظات</h3>
            </div>
            <p>{client.notes || 'لا توجد ملاحظات مسجلة.'}</p>
          </section>
        </div>
      )}

      {tab === 'cases' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>قضايا الموكل</h3>
            <Link className="button-link compact-button" to="/cases/new">
              قضية جديدة
            </Link>
          </div>
          {!cases?.length ? (
            <p className="table-message">{t('clients.detail.noCases')}</p>
          ) : (
            <div className="data-table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم القضية</th>
                    <th>السنة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => (
                    <tr key={item.id}>
                      <th>
                        <Link to={`/cases/${item.id}`}>{item.caseNumber}</Link>
                      </th>
                      <td>{item.judicialYear ?? '—'}</td>
                      <td>
                        <span className="badge">
                          {item.archivedAt ? 'مؤرشفة' : t(`cases.status.${item.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'documents' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>مستندات الموكل</h3>
            <Link to={`/documents?client=${client.id}`}>إدارة المستندات</Link>
          </div>
          {!documents?.length ? (
            <p className="table-message">لا توجد مستندات مرتبطة بالموكل.</p>
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
        <section className="detail-card">
          <div className="card-title">
            <h3>ملخص حساب الموكل</h3>
            <Link className="button-link compact-button" to={`/finances?client=${client.id}`}>
              عرض الكشف الكامل
            </Link>
          </div>
          <div className="finance-summary embedded-summary">
            <article>
              <span>أتعاب محصلة</span>
              <strong>{money(finance?.receivedMinor ?? 0)}</strong>
            </article>
            <article>
              <span>مصروفات</span>
              <strong>{money(finance?.expensesMinor ?? 0)}</strong>
            </article>
            <article className="finance-net">
              <span>صافي الحركة</span>
              <strong>{money(finance?.netCashMinor ?? 0)}</strong>
            </article>
          </div>
        </section>
      )}

      {tab === 'edit' && (
        <section className="detail-card edit-card">
          <div className="card-title">
            <h3>تعديل بيانات الموكل</h3>
          </div>
          <ClientForm
            defaultValues={{
              clientType: client.clientType,
              displayName: client.displayName,
              nationalId: client.nationalId ?? undefined,
              registrationNumber: client.registrationNumber ?? undefined,
              primaryPhone: client.primaryPhone ?? undefined,
              email: client.email ?? undefined,
              address: client.address ?? undefined,
              notes: client.notes ?? undefined,
            }}
            busy={updateClient.isPending}
            submitLabel={t('clients.save')}
            onSubmit={(values) =>
              updateClient.mutateAsync({ id: client.id, ...values }).then(() => {
                setTab('summary');
              })
            }
          />
          {updateClient.isError && (
            <p className="error">{errorMessage(updateClient.error, t('app.defaultError'))}</p>
          )}
        </section>
      )}
      {exportClient.isSuccess && (
        <p className="success">تم تصدير بيانات الموكل إلى المجلد المحدد.</p>
      )}
      {exportClient.isError && <p className="error">تعذر تصدير بيانات الموكل.</p>}
    </section>
  );
}
