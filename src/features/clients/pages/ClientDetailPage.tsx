import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCaseList } from '../../cases/api/casesApi';
import { useDocuments } from '../../documents/api/documentsApi';
import { useClientFinanceSummary } from '../../finances/api/financesApi';
import { ClientForm } from '../forms/ClientForm';
import { useArchiveClient, useClient, useRestoreClient, useUpdateClient } from '../api/clientsApi';

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const [editing, setEditing] = useState(false);
  const client = useClient(id);
  const cases = useCaseList({ clientId: id });
  const attachments = useDocuments({ clientId: id });
  const finance = useClientFinanceSummary(id);
  const update = useUpdateClient();
  const archive = useArchiveClient();
  const restore = useRestoreClient();
  if (client.isLoading) return <p>جارٍ التحميل…</p>;
  if (!client.data) return <p>الموكل غير موجود.</p>;
  const item = client.data;
  return (
    <section className="entity-detail">
      <header className="detail-hero">
        <div>
          <p className="kicker">موكل · {item.internalNumber}</p>
          <h2>{item.fullName}</h2>
          <p>{item.primaryPhone ?? '—'}</p>
        </div>
        <div className="detail-actions">
          {item.archivedAt ? (
            <button onClick={() => restore.mutate(id)}>استعادة</button>
          ) : (
            <button className="secondary-button" onClick={() => archive.mutate(id)}>
              أرشفة
            </button>
          )}
          <button onClick={() => setEditing(!editing)}>تعديل</button>
        </div>
      </header>
      {editing && (
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
          submitLabel="حفظ"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, ...values });
            setEditing(false);
          }}
        />
      )}
      <div className="detail-grid">
        <section className="detail-card">
          <h3>البيانات</h3>
          <p>{item.address ?? 'لا يوجد عنوان'}</p>
          <p>{item.notes ?? 'لا توجد ملاحظات'}</p>
        </section>
        <section className="detail-card">
          <h3>الحساب</h3>
          <p>المحصل: {finance.data?.receivedMinor ?? 0} قرش</p>
        </section>
      </div>
      <section className="detail-card">
        <h3>القضايا</h3>
        <ul>
          {cases.data?.map((caseItem) => (
            <li key={caseItem.id}>
              <Link to={`/cases/${caseItem.id}`}>{caseItem.internalNumber}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="detail-card">
        <h3>المرفقات</h3>
        <Link to={`/documents?client=${id}`}>إضافة مرفق</Link>
        <ul>
          {attachments.data?.map((attachment) => (
            <li key={attachment.id}>{attachment.originalFilename}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
