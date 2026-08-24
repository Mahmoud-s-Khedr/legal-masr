import { useState } from 'react';
import { bridge } from '../../../bridge/commands';
import type { AttachmentCategory, AttachmentDto, AttachmentListInput } from '../../../bridge/types';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import {
  useAddAttachment,
  useAttachments,
  useOpenAttachment,
  useRemoveAttachment,
  useRevealAttachment,
  useUpdateAttachment,
} from '../api/documentsApi';

const categories: ReadonlyArray<[AttachmentCategory, string]> = [
  ['IDENTIFICATION', 'إثبات هوية'],
  ['POWER_OF_ATTORNEY', 'توكيل'],
  ['CASE_FILE', 'ملف قضية'],
  ['COURT_DECISION', 'قرار أو حكم'],
  ['EVIDENCE', 'دليل'],
  ['RECEIPT', 'إيصال'],
  ['CORRESPONDENCE', 'مراسلات'],
  ['OTHER', 'أخرى'],
];

const categoryLabel = (category: AttachmentCategory) =>
  categories.find(([value]) => value === category)?.[1] ?? category;

export function AttachmentPanel({
  owner,
  title = 'المرفقات',
  description = 'يُنسخ كل ملف إلى مساحة التطبيق المحلية ويُضمّن في النسخ الاحتياطية.',
}: {
  owner: AttachmentListInput;
  title?: string;
  description?: string;
}) {
  const attachments = useAttachments(owner);
  const add = useAddAttachment();
  const update = useUpdateAttachment();
  const remove = useRemoveAttachment();
  const open = useOpenAttachment();
  const reveal = useRevealAttachment();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [source, setSource] = useState<{ token: string; filename: string } | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>('OTHER');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AttachmentDto | null>(null);

  const reset = () => {
    setSource(null);
    setCategory('OTHER');
    setDescriptionValue('');
    setDocumentDate('');
    setEditingId(null);
  };
  const close = () => {
    reset();
    setDialogOpen(false);
  };
  const selectSource = async () => {
    const selection = await bridge.attachmentSelectSource();
    setSource({ token: selection.sourceToken, filename: selection.filename });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) {
      await update.mutateAsync({
        id: editingId,
        category,
        description: descriptionValue || undefined,
        documentDate: documentDate || undefined,
      });
      close();
      return;
    }
    if (!source) return;
    await add.mutateAsync({
      ...owner,
      sourceToken: source.token,
      category,
      description: descriptionValue || undefined,
      documentDate: documentDate || undefined,
    });
    close();
  };

  return (
    <section className="detail-card attachment-panel">
      <div className="card-title">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="compact-button" onClick={() => setDialogOpen(true)}>
          إضافة مرفق
        </button>
      </div>
      {attachments.isLoading ? (
        <p className="table-message">جارٍ تحميل المرفقات…</p>
      ) : !attachments.data?.length ? (
        <p className="empty-compact">لا توجد مرفقات بعد.</p>
      ) : (
        <ul className="compact-records attachment-rows">
          {attachments.data.map((attachment) => (
            <li key={attachment.id}>
              <span className="file-mark" aria-hidden="true">
                ملف
              </span>
              <div className="record-copy">
                <strong>
                  <bdi>{attachment.originalFilename}</bdi>
                </strong>
                <span>
                  {categoryLabel(attachment.category)}
                  {attachment.documentDate && (
                    <>
                      {' '}
                      · <bdi>{attachment.documentDate}</bdi>
                    </>
                  )}
                  {attachment.description && ` · ${attachment.description}`}
                </span>
              </div>
              <div className="attachment-actions">
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
                    setDescriptionValue(attachment.description ?? '');
                    setDocumentDate(attachment.documentDate ?? '');
                    setDialogOpen(true);
                  }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  className="text-button danger-button"
                  onClick={() => setRemoving(attachment)}
                >
                  إزالة
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(add.isError || update.isError || remove.isError || open.isError || reveal.isError) && (
        <p className="error" role="alert">
          تعذر إتمام عملية المرفق. لم تُفقد بيانات النموذج.
        </p>
      )}
      <Dialog
        open={dialogOpen}
        onOpenChange={(openValue) => (openValue ? setDialogOpen(true) : close())}
        title={editingId ? 'تعديل بيانات المرفق' : 'إضافة مرفق'}
      >
        <form className="dialog-form" onSubmit={save}>
          {!editingId && (
            <div className="document-pick">
              <span className="document-glyph" aria-hidden="true">
                ⌑
              </span>
              <div>
                <strong>
                  <bdi>{source?.filename ?? 'لم يُختر ملف'}</bdi>
                </strong>
                <span>سيُنشأ نسخة مُدارة محليًا؛ لا يُحتفظ بمسار الملف الأصلي.</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void selectSource()}
              >
                اختيار ملف
              </button>
            </div>
          )}
          <label>
            الفئة
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AttachmentCategory)}
            >
              {categories.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            الوصف{' '}
            <input
              value={descriptionValue}
              onChange={(event) => setDescriptionValue(event.target.value)}
            />
          </label>
          <label>
            تاريخ المستند{' '}
            <input
              type="date"
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={close}>
              إلغاء
            </button>
            <button disabled={add.isPending || update.isPending || (!editingId && !source)}>
              {editingId ? 'حفظ البيانات' : 'إضافة المرفق'}
            </button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(openValue) => !openValue && setRemoving(null)}
        title="إزالة المرفق"
        description="سيُحذف سجل المرفق والنسخة المُدارة من مساحة التطبيق. لا يؤثر ذلك في الملف الأصلي الذي اخترته."
        confirmLabel="إزالة المرفق"
        cancelLabel="إلغاء"
        destructive
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing, { onSuccess: () => setRemoving(null) });
        }}
      />
    </section>
  );
}
