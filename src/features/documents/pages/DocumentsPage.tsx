import { FormEvent, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../components/layout/Icon';
import {
  useAddDocument,
  useCheckDocumentMissing,
  useDocuments,
  useOpenDocument,
  useRemoveDocument,
  useRevealDocument,
  useUpdateDocument,
} from '../api/documentsApi';

const CATEGORIES = [
  'PLEADING',
  'COURT_DECISION',
  'EVIDENCE',
  'CONTRACT',
  'POWER_OF_ATTORNEY',
  'IDENTIFICATION',
  'RECEIPT',
  'CORRESPONDENCE',
  'OTHER',
];
const CATEGORY_LABELS: Record<string, string> = {
  PLEADING: 'مذكرة أو صحيفة دعوى',
  COURT_DECISION: 'حكم أو قرار',
  EVIDENCE: 'دليل أو حافظة',
  CONTRACT: 'عقد',
  POWER_OF_ATTORNEY: 'توكيل',
  IDENTIFICATION: 'إثبات شخصية',
  RECEIPT: 'إيصال',
  CORRESPONDENCE: 'مراسلات',
  OTHER: 'أخرى',
};

export function DocumentsPage() {
  const [path, setPath] = useState('');
  const [managed, setManaged] = useState(true);
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('case') ?? undefined;
  const clientId = searchParams.get('client') ?? undefined;
  const { data = [], isLoading } = useDocuments({ caseId, clientId });
  const add = useAddDocument();
  const remove = useRemoveDocument();
  const update = useUpdateDocument();
  const checkMissing = useCheckDocumentMissing();
  const openDocument = useOpenDocument();
  const revealDocument = useRevealDocument();
  const selectedDocumentId = searchParams.get('document');
  const choose = async () => {
    const selected = await open({ multiple: false, directory: false });
    if (typeof selected === 'string') setPath(selected);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (editingId) {
      update.mutate(
        {
          id: editingId,
          category,
          description: description || undefined,
          documentDate: documentDate || undefined,
        },
        {
          onSuccess: () => {
            setEditingId(null);
            setCategory('OTHER');
            setDescription('');
            setDocumentDate('');
          },
        },
      );
    } else if (path)
      add.mutate(
        {
          input: {
            caseId,
            clientId,
            path,
            category,
            description: description || undefined,
            documentDate: documentDate || undefined,
          },
          managed,
        },
        {
          onSuccess: () => {
            setPath('');
            setDescription('');
            setDocumentDate('');
          },
        },
      );
  };
  return (
    <section className="work-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المستندات</p>
          <h2>مستندات القضايا</h2>
          <p>أضف نسخة محفوظة داخل التطبيق، أو مرجعًا خارجيًا يبقى في مكانه الأصلي.</p>
        </div>
      </header>
      <form className="document-intake" onSubmit={submit}>
        <div className="document-pick">
          <span className="document-glyph">
            <Icon name="documents" size={20} />
          </span>
          <div>
            <strong>
              {editingId
                ? 'تعديل بيانات المستند'
                : path
                  ? path.split(/[\\/]/).pop()
                  : 'اختر المستند المراد إضافته'}
            </strong>
            <span>
              {editingId
                ? 'لن يتغير الملف نفسه'
                : path
                  ? 'تم اختيار ملف محلي'
                  : 'PDF، ملفات Office، صور، أو أي مرفق قانوني'}
            </span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={choose}
            disabled={Boolean(editingId)}
          >
            اختيار ملف
          </button>
        </div>
        <label>
          الفئة
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => (
              <option value={item} key={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          وصف
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          تاريخ المستند
          <input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
          />
        </label>
        {!editingId && (
          <label className="storage-mode">
            <input
              type="checkbox"
              checked={managed}
              onChange={(event) => setManaged(event.target.checked)}
            />
            <span>
              <strong>حفظ نسخة مُدارة</strong>
              <small>تُنسخ إلى مجلد Legal Masr المحلي وتدخل في النسخ الاحتياطية.</small>
            </span>
          </label>
        )}
        <div className="form-actions">
          <button disabled={editingId ? update.isPending : !path || add.isPending}>
            {editingId
              ? update.isPending
                ? 'جارٍ الحفظ…'
                : 'حفظ البيانات'
              : add.isPending
                ? 'جارٍ الإضافة…'
                : 'إضافة مستند'}
          </button>
          {editingId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingId(null);
                setCategory('OTHER');
                setDescription('');
                setDocumentDate('');
              }}
            >
              إلغاء
            </button>
          )}
        </div>
        {(add.isError || update.isError) && (
          <p className="error" role="alert">
            تعذر حفظ المستند. راجع الملف والبيانات وحاول مرة أخرى.
          </p>
        )}
      </form>
      <section className="work-register documents-register">
        <div className="register-heading">
          <div>
            <p className="kicker">الفهرس المحلي</p>
            <h3>المستندات المسجلة</h3>
          </div>
          <span className="count-pill">{data.length} ملف</span>
        </div>
        {isLoading ? (
          <p className="table-message">جارٍ تحميل الفهرس…</p>
        ) : !data.length ? (
          <p className="table-message">لا توجد مستندات بعد. اختر ملفًا ليظهر هنا مع بياناته.</p>
        ) : (
          <ul className="record-list">
            {data.map((document) => (
              <li
                className={document.id === selectedDocumentId ? 'selected-record' : ''}
                key={document.id}
              >
                <span className="file-mark">
                  {document.originalFilename.split('.').at(-1)?.toUpperCase() ?? 'FILE'}
                </span>
                <div className="record-copy">
                  <strong>{document.originalFilename}</strong>
                  <span>
                    {CATEGORY_LABELS[document.category] ?? document.category} ·{' '}
                    {document.storageMode === 'MANAGED_COPY' ? 'نسخة مُدارة' : 'مرجع خارجي'}
                    {document.missingAt ? ' · الملف غير متاح' : ''}
                  </span>
                  <div className="document-actions">
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openDocument.mutate(document.id)}
                    >
                      فتح
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => revealDocument.mutate(document.id)}
                    >
                      إظهار في المجلد
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => checkMissing.mutate(document.id)}
                    >
                      تحقق
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setEditingId(document.id);
                        setCategory(document.category);
                        setDescription(document.description ?? '');
                        setDocumentDate(document.documentDate ?? '');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      تعديل البيانات
                    </button>
                  </div>
                </div>
                <button
                  className="text-button danger-button"
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        document.storageMode === 'MANAGED_COPY'
                          ? 'سيُحذف الملف المُدار نهائيًا من التطبيق. هل تريد المتابعة؟'
                          : 'سيُزال المرجع فقط، ولن يُحذف الملف الأصلي. هل تريد المتابعة؟',
                      )
                    )
                      remove.mutate(document.id);
                  }}
                >
                  إزالة
                </button>
              </li>
            ))}
          </ul>
        )}
        {(openDocument.isError || revealDocument.isError || checkMissing.isError) && (
          <p className="error" role="alert">
            الملف غير متاح في مساره الحالي.
          </p>
        )}
      </section>
    </section>
  );
}
