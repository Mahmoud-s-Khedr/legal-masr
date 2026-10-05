import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../components/layout/Icon';
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

const categories: readonly AttachmentCategory[] = [
  'IDENTIFICATION',
  'POWER_OF_ATTORNEY',
  'CASE_FILE',
  'COURT_DECISION',
  'EVIDENCE',
  'RECEIPT',
  'CORRESPONDENCE',
  'OTHER',
];

const fileExtension = (filename: string) => {
  const extension = /\.([a-z0-9]{1,5})$/i.exec(filename)?.[1];
  return extension ? extension.toUpperCase() : null;
};

/** Which record a file belongs to, for the global documents list. */
function AttachmentOwner({ attachment }: { attachment: AttachmentDto }) {
  const { t } = useTranslation();
  const cases = useCaseList({ includeArchived: true });
  const clients = useClientList({ includeArchived: true });
  if (attachment.caseId) {
    const item = cases.data?.find((candidate) => candidate.id === attachment.caseId);
    return (
      <Link className="owner-link" to={`/cases/${attachment.caseId}`}>
        {t('documents.owner.case')} <bdi>{item?.internalNumber ?? '…'}</bdi>
      </Link>
    );
  }
  if (attachment.clientId) {
    const item = clients.data?.find((candidate) => candidate.id === attachment.clientId);
    return (
      <Link className="owner-link" to={`/clients/${attachment.clientId}`}>
        {t('documents.owner.client')} <bdi>{item?.fullName ?? '…'}</bdi>
      </Link>
    );
  }
  if (attachment.powerOfAttorneyId)
    return (
      <Link className="owner-link" to={`/powers-of-attorney/${attachment.powerOfAttorneyId}`}>
        {t('documents.owner.poa')}
      </Link>
    );
  if (attachment.expenseId)
    return <span className="owner-link">{t('documents.owner.expense')}</span>;
  return null;
}

export function AttachmentPanel({
  owner,
  title,
  description,
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
  const { t } = useTranslation();
  const categoryLabel = (category: AttachmentCategory) => t(`documents.categories.${category}`);
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
        setActionError(t('documents.pickError'));
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
          ? t('documents.updateError')
          : asAppError(error)?.code === 'ATTACHMENT_SOURCE_MISSING'
            ? t('documents.sourceMissing')
            : t('documents.copyError'),
      );
    } finally {
      saving.current = false;
    }
  };

  return (
    <section className="detail-card attachment-panel">
      <div className="card-title">
        <div>
          <h3>{title ?? t('documents.title')}</h3>
          <p className="muted">{description ?? t('documents.panelHint')}</p>
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
            {t('documents.add')}
          </Button>
        )}
      </div>
      {attachments.isLoading ? (
        <p className="table-message">{t('documents.loading')}</p>
      ) : attachments.isError ? (
        <p className="error" role="alert">
          {t('documents.loadError')}
        </p>
      ) : !attachments.data?.length ? (
        <p className="empty-compact">{t('documents.empty')}</p>
      ) : (
        <ul className="compact-records attachment-rows">
          {attachments.data.map((attachment) => (
            <li key={attachment.id}>
              <span className="file-mark" aria-hidden="true">
                {fileExtension(attachment.originalFilename) ?? t('documents.fileMark')}
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
                  aria-label={t('documents.openAria', { name: attachment.originalFilename })}
                  onClick={() => {
                    setActionError(null);
                    open.mutate(attachment.id, {
                      onError: () => setActionError(t('documents.openError')),
                    });
                  }}
                >
                  {t('documents.open')}
                </Button>
                <Button
                  type="button"
                  className="text-button"
                  disabled={reveal.isPending}
                  aria-label={t('documents.revealAria', { name: attachment.originalFilename })}
                  onClick={() => {
                    setActionError(null);
                    reveal.mutate(attachment.id, {
                      onError: () => setActionError(t('documents.revealError')),
                    });
                  }}
                >
                  {t('documents.reveal')}
                </Button>
                <Button
                  type="button"
                  className="text-button"
                  aria-label={t('documents.editAria', { name: attachment.originalFilename })}
                  onClick={() => {
                    setActionError(null);
                    setEditingId(attachment.id);
                    setCategory(attachment.category);
                    setDescriptionValue(attachment.description ?? '');
                    setDocumentDate(attachment.documentDate ?? '');
                    setDialogOpen(true);
                  }}
                >
                  {t('records.edit')}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="text-button danger-button"
                  aria-label={t('documents.removeAria', { name: attachment.originalFilename })}
                  onClick={() => setRemoving(attachment)}
                >
                  {t('documents.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={dialogOpen}
        onOpenChange={(openValue) => (openValue ? setDialogOpen(true) : close())}
        title={editingId ? t('documents.editTitle') : t('documents.add')}
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
                <Icon name="documents" size={20} />
              </span>
              <div>
                <strong>
                  <bdi>{source?.filename ?? t('documents.noFile')}</bdi>
                </strong>
                <span>{t('documents.copyNote')}</span>
              </div>
              <Button
                variant="secondary"
                type="button"
                className="secondary-button"
                disabled={pickerPending || add.isPending || update.isPending}
                onClick={() => void selectSource()}
              >
                {t('documents.pick')}
              </Button>
            </div>
          )}
          <label>
            {t('documents.category')}
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as AttachmentCategory)}
              items={categories.map((value) => ({ value, label: categoryLabel(value) }))}
            />
          </label>
          <label>
            {t('documents.description')}
            <Input
              value={descriptionValue}
              onChange={(event) => setDescriptionValue(event.target.value)}
            />
          </label>
          <label>
            {t('documents.date')}
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
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                pickerPending || add.isPending || update.isPending || (!editingId && !source)
              }
            >
              {editingId ? t('records.saveEdits') : t('documents.save')}
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
        title={t('documents.removeTitle')}
        description={t('documents.removeDescription')}
        confirmLabel={t('documents.removeTitle')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        error={actionError ?? undefined}
        onConfirm={() => {
          if (!removing || deleting.current) return;
          deleting.current = true;
          setActionError(null);
          remove.mutate(removing, {
            onSuccess: () => setRemoving(null),
            onError: () => setActionError(t('documents.removeError')),
            onSettled: () => {
              deleting.current = false;
            },
          });
        }}
      />
    </section>
  );
}
