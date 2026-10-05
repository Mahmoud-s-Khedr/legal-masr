import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { asAppError } from '../../../bridge/errors';
import { bridge } from '../../../bridge/commands';
import type { AttachmentCategory, AttachmentDto, AttachmentListInput } from '../../../bridge/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
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

const fileExtension = (filename: string) => {
  const extension = /\.([a-z0-9]{1,5})$/i.exec(filename)?.[1];
  return extension ? extension.toUpperCase() : 'ملف';
};

/** Which record a file belongs to, for the global documents list. */
function AttachmentOwner({ attachment }: { attachment: AttachmentDto }) {
  const cases = useCaseList({ includeArchived: true });
  const clients = useClientList({ includeArchived: true });
  if (attachment.caseId) {
    const item = cases.data?.find((candidate) => candidate.id === attachment.caseId);
    return (
      <Link className="owner-link" to={`/cases/${attachment.caseId}`}>
        قضية <bdi>{item?.internalNumber ?? '…'}</bdi>
      </Link>
    );
  }
  if (attachment.clientId) {
    const item = clients.data?.find((candidate) => candidate.id === attachment.clientId);
    return (
      <Link className="owner-link" to={`/clients/${attachment.clientId}`}>
        الموكل <bdi>{item?.fullName ?? '…'}</bdi>
      </Link>
    );
  }
  if (attachment.powerOfAttorneyId)
    return (
      <Link className="owner-link" to={`/powers-of-attorney/${attachment.powerOfAttorneyId}`}>
        توكيل
      </Link>
    );
  if (attachment.expenseId) return <span className="owner-link">مرفق مصروف</span>;
  return null;
}

const categoryLabel = (category: AttachmentCategory) =>
  categories.find(([value]) => value === category)?.[1] ?? category;

export function AttachmentPanel({
  owner,
  title = 'المرفقات',
  description = 'يُنسخ كل ملف إلى مساحة التطبيق المحلية ويُضمّن في النسخ الاحتياطية.',
  allowAdd = true,
  showOwner = false,
}: {
  owner: AttachmentListInput;
  title?: string;
  description?: string;
  allowAdd?: boolean;
  showOwner?: boolean;
}) {
  const format = useFormat();
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

  const [pickerPending, setPickerPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const saving = useRef(false);
  const picking = useRef(false);
  const deleting = useRef(false);
  const dialogGeneration = useRef(0);

  const reset = () => {
    setSource(null);
    setCategory('OTHER');
    setDescriptionValue('');
    setDocumentDate('');
    setEditingId(null);
  };
  const close = () => {
    if (saving.current) return;
    dialogGeneration.current++;
    reset();
    setDialogOpen(false);
  };
  const selectSource = async () => {
    if (picking.current || saving.current) return;
    picking.current = true;
    setPickerPending(true);
    setActionError(null);
    const generation = dialogGeneration.current;
    try {
      const selection = await bridge.attachmentSelectSource();
      if (generation === dialogGeneration.current)
        setSource({ token: selection.sourceToken, filename: selection.filename });
    } catch (error) {
      if (
        generation === dialogGeneration.current &&
        asAppError(error)?.code !== 'OPERATION_CANCELLED'
      )
        setActionError('تعذر اختيار الملف. حاول الاختيار مرة أخرى.');
    } finally {
      picking.current = false;
      setPickerPending(false);
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current || picking.current || (!editingId && !source)) return;
    saving.current = true;
    setActionError(null);
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          category,
          description: descriptionValue || undefined,
          documentDate: documentDate || undefined,
        });
      } else if (source) {
        const token = source.token;
        // Rust consumes picker capabilities even when the copy fails.
        setSource(null);
        await add.mutateAsync({
          ...owner,
          sourceToken: token,
          category,
          description: descriptionValue || undefined,
          documentDate: documentDate || undefined,
        });
      }
      saving.current = false;
      close();
    } catch (error) {
      setActionError(
        editingId
          ? 'تعذر حفظ بيانات المرفق. بيانات النموذج محفوظة للمحاولة مرة أخرى.'
          : asAppError(error)?.code === 'ATTACHMENT_SOURCE_MISSING'
            ? 'الملف المختار غير متاح. اختر الملف مرة أخرى؛ بيانات النموذج محفوظة.'
            : 'تعذر نسخ المرفق. اختر الملف مرة أخرى؛ بيانات النموذج محفوظة.',
      );
    } finally {
      saving.current = false;
    }
  };

  return (
    <section className="detail-card attachment-panel">
      <div className="card-title">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        {allowAdd && (
          <Button
            type="button"
            className="compact-button"
            onClick={() => {
              setActionError(null);
              setDialogOpen(true);
            }}
          >
            إضافة مرفق
          </Button>
        )}
      </div>
      {attachments.isLoading ? (
        <p className="table-message">جارٍ تحميل المرفقات…</p>
      ) : attachments.isError ? (
        <p className="error" role="alert">
          تعذر تحميل المرفقات. حاول فتح السجل مرة أخرى.
        </p>
      ) : !attachments.data?.length ? (
        <p className="empty-compact">لا توجد مرفقات بعد.</p>
      ) : (
        <ul className="compact-records attachment-rows">
          {attachments.data.map((attachment) => (
            <li key={attachment.id}>
              <span className="file-mark" aria-hidden="true">
                {fileExtension(attachment.originalFilename)}
              </span>
              <div className="record-copy">
                <strong>
                  <bdi>{attachment.originalFilename}</bdi>
                </strong>
                <span>
                  {categoryLabel(attachment.category)}
                  {attachment.documentDate && (
                    <>
                      {' · '}
                      <bdi>{format.date(attachment.documentDate)}</bdi>
                    </>
                  )}
                  {' · '}
                  {format.bytes(attachment.fileSizeBytes)}
                  {attachment.description && (
                    <>
                      {' · '}
                      <bdi dir="auto">{attachment.description}</bdi>
                    </>
                  )}
                </span>
                {showOwner && <AttachmentOwner attachment={attachment} />}
              </div>
              <div className="attachment-actions">
                <Button
                  type="button"
                  className="text-button"
                  disabled={open.isPending}
                  aria-label={`فتح ${attachment.originalFilename}`}
                  onClick={() => {
                    setActionError(null);
                    open.mutate(attachment.id, {
                      onError: () =>
                        setActionError(
                          'تعذر فتح المرفق. تأكد من توفر النسخة المُدارة والتطبيق المناسب.',
                        ),
                    });
                  }}
                >
                  فتح
                </Button>
                <Button
                  type="button"
                  className="text-button"
                  disabled={reveal.isPending}
                  aria-label={`إظهار ${attachment.originalFilename} في المجلد`}
                  onClick={() => {
                    setActionError(null);
                    reveal.mutate(attachment.id, {
                      onError: () =>
                        setActionError('تعذر إظهار المرفق. تأكد من توفر النسخة المُدارة.'),
                    });
                  }}
                >
                  إظهار
                </Button>
                <Button
                  type="button"
                  className="text-button"
                  aria-label={`تعديل بيانات ${attachment.originalFilename}`}
                  onClick={() => {
                    setActionError(null);
                    setEditingId(attachment.id);
                    setCategory(attachment.category);
                    setDescriptionValue(attachment.description ?? '');
                    setDocumentDate(attachment.documentDate ?? '');
                    setDialogOpen(true);
                  }}
                >
                  تعديل
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="text-button danger-button"
                  aria-label={`إزالة ${attachment.originalFilename}`}
                  onClick={() => setRemoving(attachment)}
                >
                  إزالة
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={dialogOpen}
        onOpenChange={(openValue) => (openValue ? setDialogOpen(true) : close())}
        title={editingId ? 'تعديل بيانات المرفق' : 'إضافة مرفق'}
      >
        <form className="dialog-form" onSubmit={(event) => void save(event)}>
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
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
              <Button
                variant="secondary"
                type="button"
                className="secondary-button"
                disabled={pickerPending || add.isPending || update.isPending}
                onClick={() => void selectSource()}
              >
                اختيار ملف
              </Button>
            </div>
          )}
          <label>
            الفئة
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as AttachmentCategory)}
              items={categories.map(([value, label]) => ({ value, label }))}
            />
          </label>
          <label>
            الوصف{' '}
            <Input
              value={descriptionValue}
              onChange={(event) => setDescriptionValue(event.target.value)}
            />
          </label>
          <label>
            تاريخ المستند{' '}
            <DatePicker
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              className="secondary-button"
              disabled={add.isPending || update.isPending}
              onClick={close}
            >
              إلغاء
            </Button>
            <Button
              disabled={
                pickerPending || add.isPending || update.isPending || (!editingId && !source)
              }
            >
              {editingId ? 'حفظ البيانات' : 'إضافة المرفق'}
            </Button>
          </div>
        </form>
      </Dialog>
      {!dialogOpen && !removing && actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(openValue) => !openValue && setRemoving(null)}
        title="إزالة المرفق"
        description="سيُحذف سجل المرفق والنسخة المُدارة من مساحة التطبيق. لا يؤثر ذلك في الملف الأصلي الذي اخترته."
        confirmLabel="إزالة المرفق"
        cancelLabel="إلغاء"
        destructive
        pending={remove.isPending}
        error={actionError ?? undefined}
        onConfirm={() => {
          if (!removing || deleting.current) return;
          deleting.current = true;
          setActionError(null);
          remove.mutate(removing, {
            onSuccess: () => setRemoving(null),
            onError: () =>
              setActionError('تعذر إزالة المرفق. تحقق من السجل قبل المحاولة مرة أخرى.'),
            onSettled: () => {
              deleting.current = false;
            },
          });
        }}
      />
    </section>
  );
}
