import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { bridge } from '../../../bridge/commands';
import {
  useAddDocument,
  useDocuments,
  useOpenDocument,
  useRemoveDocument,
  useRevealDocument,
  useUpdateDocument,
} from '../api/documentsApi';

const CATEGORIES = [
  'IDENTIFICATION',
  'POWER_OF_ATTORNEY',
  'CASE_FILE',
  'COURT_DECISION',
  'EVIDENCE',
  'RECEIPT',
  'CORRESPONDENCE',
  'OTHER',
];

export function DocumentsPage() {
  const [source, setSource] = useState<{ token: string; filename: string } | null>(null);
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [params] = useSearchParams();
  const caseId = params.get('case') ?? undefined;
  const clientId = params.get('client') ?? undefined;
  const attachments = useDocuments({ caseId, clientId });
  const add = useAddDocument();
  const update = useUpdateDocument();
  const remove = useRemoveDocument();
  const open = useOpenDocument();
  const reveal = useRevealDocument();
  const choose = async () =>
    setSource(
      await bridge
        .attachmentSelectSource()
        .then((item) => ({ token: item.sourceToken, filename: item.filename })),
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (editingId)
      update.mutate({
        id: editingId,
        category,
        description: description || undefined,
        documentDate: documentDate || undefined,
      });
    else if (source)
      add.mutate({
        caseId,
        clientId,
        sourceToken: source.token,
        category,
        description: description || undefined,
        documentDate: documentDate || undefined,
      });
  };
  return (
    <section className="work-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المرفقات</p>
          <h2>مرفقات مُدارة</h2>
          <p>يُنسخ كل ملف إلى مساحة التطبيق المحلية ويُضمّن في النسخ الاحتياطية.</p>
        </div>
      </header>
      <form className="document-intake" onSubmit={submit}>
        <button type="button" className="secondary-button" onClick={choose}>
          {source?.filename ?? 'اختيار ملف'}
        </button>
        <label>
          الفئة
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          وصف
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          التاريخ
          <input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
          />
        </label>
        <button disabled={editingId ? update.isPending : !source || add.isPending}>
          {editingId ? 'حفظ البيانات' : 'إضافة مرفق'}
        </button>
      </form>
      <section className="work-register documents-register">
        <h3>المرفقات المسجلة</h3>
        {attachments.isLoading ? (
          <p>جارٍ التحميل…</p>
        ) : !attachments.data?.length ? (
          <p>لا توجد مرفقات بعد.</p>
        ) : (
          <ul className="record-list">
            {attachments.data.map((attachment) => (
              <li key={attachment.id}>
                <div>
                  <strong>{attachment.originalFilename}</strong>
                  <span>
                    {attachment.category}
                    {attachment.description ? ` · ${attachment.description}` : ''}
                  </span>
                </div>
                <div className="document-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open.mutate(attachment.id)}
                  >
                    فتح
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => reveal.mutate(attachment.id)}
                  >
                    إظهار
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setEditingId(attachment.id);
                      setCategory(attachment.category);
                      setDescription(attachment.description ?? '');
                      setDocumentDate(attachment.documentDate ?? '');
                    }}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="text-button danger-button"
                    onClick={() => {
                      if (confirm('سيُحذف المرفق والملف المُدار نهائيًا.'))
                        remove.mutate(attachment.id);
                    }}
                  >
                    إزالة
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
