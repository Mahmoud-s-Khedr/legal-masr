import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { CaseDto, CaseOpponentDto, CaseOpponentInput } from '../../../bridge/types';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { useAddOpponent, useRemoveOpponent, useUpdateOpponent } from '../api/casesApi';

export function CasePartiesPanel({ caseDto }: { caseDto: CaseDto }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<CaseOpponentDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<CaseOpponentDto | null>(null);
  const add = useAddOpponent();
  const update = useUpdateOpponent(caseDto.id);
  const remove = useRemoveOpponent(caseDto.id);
  return (
    <section className="detail-card">
      <div className="card-title">
        <h3>{t('cases.parties.title')}</h3>
        <Button
          type="button"
          variant="secondary"
          className="secondary-button"
          onClick={() => setEditing('new')}
        >
          {t('cases.parties.add')}
        </Button>
      </div>
      {!caseDto.opponents.length ? (
        <p className="empty-compact">{t('cases.parties.empty')}</p>
      ) : (
        <ul className="compact-records">
          {caseDto.opponents.map((opponent) => (
            <li key={opponent.id}>
              <div className="record-copy">
                <strong dir="auto">{opponent.fullName}</strong>
                <span dir="auto">
                  {[
                    opponent.legalCapacity,
                    opponent.lawyerName &&
                      t('cases.parties.lawyerLine', { name: opponent.lawyerName }),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'دون صفة مسجلة'}
                  {opponent.phone && (
                    <>
                      {' · '}
                      <bdi className="mono">{opponent.phone}</bdi>
                    </>
                  )}
                </span>
              </div>
              <div className="row-actions">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setEditing(opponent)}
                >
                  {t('records.edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button danger-button"
                  onClick={() => setRemoving(opponent)}
                >
                  {t('documents.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? t('cases.parties.add') : t('cases.parties.editTitle')}
      >
        {editing && (
          <OpponentForm
            initial={editing === 'new' ? undefined : editing}
            busy={add.isPending || update.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') await add.mutateAsync({ caseId: caseDto.id, ...input });
              else await update.mutateAsync({ id: editing.id, ...input });
              setEditing(null);
            }}
          />
        )}
        {(add.isError || update.isError) && (
          <p className="error" role="alert">
            {t('cases.parties.saveError')}
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('cases.parties.removeTitle')}
        description={t('cases.parties.removeDescription')}
        confirmLabel={t('cases.parties.removeTitle')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          !remove.isPending &&
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
      {remove.isError && (
        <p className="error" role="alert">
          {t('cases.parties.removeError')}
        </p>
      )}
    </section>
  );
}

function OpponentForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: CaseOpponentDto;
  busy: boolean;
  onSave: (input: Omit<CaseOpponentInput, 'caseId'>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [legalCapacity, setLegalCapacity] = useState(initial?.legalCapacity ?? '');
  const [lawyerName, setLawyerName] = useState(initial?.lawyerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await onSave({
            fullName: fullName.trim(),
            legalCapacity: legalCapacity || undefined,
            lawyerName: lawyerName || undefined,
            phone: phone || undefined,
            address: address || undefined,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      }}
    >
      <label>
        {t('cases.parties.name')}
        <Input
          required
          autoFocus
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label>
        {t('cases.parties.role')}
        <Input value={legalCapacity} onChange={(event) => setLegalCapacity(event.target.value)} />
      </label>
      <label>
        {t('cases.parties.lawyer')}
        <Input value={lawyerName} onChange={(event) => setLawyerName(event.target.value)} />
      </label>
      <label>
        {t('cases.parties.phone')}
        <Input
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <label>
        {t('cases.parties.address')}
        <Input value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label>
        {t('common.notes')}
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy}>{t('cases.parties.save')}</Button>
      </div>
    </form>
  );
}
