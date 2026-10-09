import { DraftForm } from '@/components/forms/DraftForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreatableCombobox } from '@/components/forms/CreatableCombobox';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { opponentDraftSchema } from '@/lib/formSchemas';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { CaseDto, CaseOpponentDto, CaseOpponentInput } from '../../../bridge/types';
import { ConfirmDialog, FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';
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
                    .join(' · ') || t('cases.parties.noDetails')}
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

                  onClick={() => setEditing(opponent)}
                >
                  {t('records.edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"

                  onClick={() => setRemoving(opponent)}
                >
                  {t('documents.remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormDialog
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
          <Alert variant="destructive">
            <AlertDescription>{t('cases.parties.saveError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
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
        <Alert variant="destructive">
          <AlertDescription>{t('cases.parties.removeError')}</AlertDescription>
        </Alert>
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
  const form = useForm<z.infer<typeof opponentDraftSchema>>({
    resolver: zodResolver(opponentDraftSchema),
    defaultValues: {
      fullName: initial?.fullName ?? '',
      legalCapacity: initial?.legalCapacity ?? '',
      lawyerName: initial?.lawyerName ?? '',
      phone: initial?.phone ?? '',
      address: initial?.address ?? '',
      notes: initial?.notes ?? '',
    },
  });

  const fullName = useWatch({ control: form.control, name: 'fullName' });
  const setFullName = (value: string) =>
    form.setValue('fullName', value, { shouldValidate: form.formState.isSubmitted });
  const legalCapacity = useWatch({ control: form.control, name: 'legalCapacity' });
  const setLegalCapacity = (value: string) =>
    form.setValue('legalCapacity', value, { shouldValidate: form.formState.isSubmitted });
  const lawyerName = useWatch({ control: form.control, name: 'lawyerName' });
  const setLawyerName = (value: string) =>
    form.setValue('lawyerName', value, { shouldValidate: form.formState.isSubmitted });
  const phone = useWatch({ control: form.control, name: 'phone' });
  const setPhone = (value: string) =>
    form.setValue('phone', value, { shouldValidate: form.formState.isSubmitted });
  const address = useWatch({ control: form.control, name: 'address' });
  const setAddress = (value: string) =>
    form.setValue('address', value, { shouldValidate: form.formState.isSubmitted });
  const notes = useWatch({ control: form.control, name: 'notes' });
  const setNotes = (value: string) =>
    form.setValue('notes', value, { shouldValidate: form.formState.isSubmitted });
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async () => {
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
      })}
    >
      <FieldGroup>
        <Field
          label={<>{t('cases.parties.name')}</>}
          required
          error={form.formState.errors.fullName ? t('forms.required') : undefined}
        >
          <Input
            required
            autoFocus
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            ref={(node) => form.register('fullName').ref(node)}
            aria-invalid={!!form.formState.errors.fullName}
          />
        </Field>
        <Field
          label={<>{t('cases.parties.role')}</>}
          error={form.formState.errors.legalCapacity ? t('forms.invalid') : undefined}
        >
          <CreatableCombobox
            suggestion="legalCapacity"
            value={legalCapacity}
            onChange={(event) => setLegalCapacity(event.target.value)}
            ref={(node) => form.register('legalCapacity').ref(node)}
            aria-invalid={!!form.formState.errors.legalCapacity}
          />
        </Field>
        <Field
          label={<>{t('cases.parties.lawyer')}</>}
          error={form.formState.errors.lawyerName ? t('forms.invalid') : undefined}
        >
          <Input
            value={lawyerName}
            onChange={(event) => setLawyerName(event.target.value)}
            ref={(node) => form.register('lawyerName').ref(node)}
            aria-invalid={!!form.formState.errors.lawyerName}
          />
        </Field>
        <Field
          label={<>{t('cases.parties.phone')}</>}
          error={form.formState.errors.phone ? t('forms.invalid') : undefined}
        >
          <Input
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            ref={(node) => form.register('phone').ref(node)}
            aria-invalid={!!form.formState.errors.phone}
          />
        </Field>
        <Field
          label={<>{t('cases.parties.address')}</>}
          error={form.formState.errors.address ? t('forms.invalid') : undefined}
        >
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            ref={(node) => form.register('address').ref(node)}
            aria-invalid={!!form.formState.errors.address}
          />
        </Field>
        <Field
          label={<>{t('common.notes')}</>}
          error={form.formState.errors.notes ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            ref={(node) => form.register('notes').ref(node)}
            aria-invalid={!!form.formState.errors.notes}
          />
        </Field>
        <FormDialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('cases.parties.save')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
