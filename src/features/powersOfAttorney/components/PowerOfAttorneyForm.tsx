import { DraftForm } from '@/components/forms/DraftForm';
import { CreatableCombobox } from '@/components/forms/CreatableCombobox';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field } from '@/components/forms/FormField';
import { FieldGroup } from '@/components/ui/field';
import { DatePicker } from '@/components/forms/DatePicker';
import { EntityMultiPicker } from '@/components/forms/EntityPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { optionalDate, requiredText } from '@/lib/formSchemas';
import type { PowerOfAttorneyDto, PowerOfAttorneyInput } from '@/bridge/types';
import { useClientList } from '../../clients/api/clientsApi';
import { InlineClientCreateDialog } from '../../clients/components/InlineClientCreateDialog';
const schema = z.object({
  internalSequence: requiredText,
  officialNumber: z.string(),
  issueDate: optionalDate,
  notaryOffice: z.string(),
  notes: z.string(),
  clientIds: z
    .array(z.string())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length),
  lawyers: z.array(
    z.object({
      id: z.string().optional(),
      fullName: requiredText,
      barNumber: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
});
export function PowerOfAttorneyForm({
  powerOfAttorney,
  suggestedNumber,
  busy,
  onSubmit,
  onCancel,
}: {
  powerOfAttorney?: PowerOfAttorneyDto;
  suggestedNumber?: string;
  busy: boolean;
  onSubmit: (input: PowerOfAttorneyInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const clients = useClientList({ includeArchived: true });
  const [clientName, setClientName] = useState('');
  const [creating, setCreating] = useState(false);
  const { register, control, handleSubmit, formState, setValue, getValues } = useForm<
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      internalSequence: powerOfAttorney?.internalSequence ?? '',
      officialNumber: powerOfAttorney?.officialNumber ?? '',
      issueDate: powerOfAttorney?.issueDate ?? '',
      notaryOffice: powerOfAttorney?.notaryOffice ?? '',
      notes: powerOfAttorney?.notes ?? '',
      clientIds: powerOfAttorney?.clients.map((c) => c.id) ?? [],
      lawyers:
        powerOfAttorney?.lawyers.map((l) => ({
          id: l.id,
          fullName: l.fullName,
          barNumber: l.barNumber ?? '',
          notes: l.notes ?? '',
        })) ?? [],
    },
  });
  useEffect(() => {
    if (suggestedNumber && !getValues('internalSequence'))
      setValue('internalSequence', suggestedNumber);
  }, [suggestedNumber, getValues, setValue]);
  const lawyers = useWatch({ control, name: 'lawyers' });
  return (
    <>
      <DraftForm
        control={control}
        noValidate
        onSubmit={handleSubmit(async (values) => {
          if (busy) return;
          try {
            await onSubmit({
              ...values,
              issueDate: values.issueDate || undefined,
              issueYear: values.issueDate ? Number(values.issueDate.slice(0, 4)) : undefined,
            });
          } catch {
            /* Parent renders save errors; draft is retained. */
          }
        })}
      >
        <FieldGroup>
          <fieldset className="form-section">
            <legend className="form-section-title">{t('poa.dataTitle')}</legend>
            <div className="form-grid">
              <Field
                label={t('poa.fields.internalSequence')}
                required
                error={formState.errors.internalSequence ? t('forms.required') : undefined}
              >
                <Input dir="ltr" {...register('internalSequence')} autoFocus autoComplete="off" />
              </Field>
              <Field label={t('poa.fields.officialNumber')}>
                <Input dir="ltr" {...register('officialNumber')} autoComplete="off" />
              </Field>
              <Field
                label={t('poa.fields.issueDate')}
                error={formState.errors.issueDate ? t('forms.invalidDate') : undefined}
              >
                <Controller
                  control={control}
                  name="issueDate"
                  render={({ field }) => <DatePicker {...field} />}
                />
              </Field>
              <Field label={t('poa.fields.notaryOffice')}>
                <CreatableCombobox suggestion="notaryOffice" {...register('notaryOffice')} />
              </Field>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend className="form-section-title">{t('poa.clientsTitle')}</legend>
            <p className="form-section-hint">{t('poa.clientsHint')}</p>
            <Field
              label={t('poa.tabs.clients')}
              error={formState.errors.clientIds ? t('poa.clientsRequired') : undefined}
            >
              <Controller
                control={control}
                name="clientIds"
                render={({ field }) => (
                  <EntityMultiPicker
                    ref={field.ref}
                    items={(clients.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.fullName,
                      searchText: `${c.internalNumber} ${c.primaryPhone ?? ''}`,
                      disabled: !!c.archivedAt,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('cases.form.clientSearch')}
                    loading={clients.isLoading}
                    error={clients.isError ? t('clients.loadError') : undefined}
                    onCreate={(name) => {
                      setClientName(name);
                      setCreating(true);
                    }}
                  />
                )}
              />
            </Field>
          </fieldset>
          <fieldset className="form-section">
            <legend className="form-section-title">{t('poa.lawyersTitle')}</legend>
            {lawyers.map((lawyer, index) => (
              <div className="form-grid form-grid-3" key={lawyer.id ?? index}>
                <Field
                  label={t('poa.fields.lawyerName')}
                  required
                  error={
                    formState.errors.lawyers?.[index]?.fullName ? t('forms.required') : undefined
                  }
                >
                  <Input {...register(`lawyers.${index}.fullName`)} />
                </Field>
                <Field label={t('poa.fields.barNumber')}>
                  <Input dir="ltr" {...register(`lawyers.${index}.barNumber`)} />
                </Field>
                <Field label={t('common.notes')}>
                  <Input {...register(`lawyers.${index}.notes`)} />
                </Field>
                <div className="span-all">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() =>
                      setValue(
                        'lawyers',
                        lawyers.filter((_, i) => i !== index),
                        { shouldDirty: true },
                      )
                    }
                  >
                    {t('documents.remove')}
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue('lawyers', [...lawyers, { fullName: '', barNumber: '', notes: '' }], {
                    shouldDirty: true,
                  })
                }
              >
                {t('poa.addLawyer')}
              </Button>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <Field label={t('common.notes')}>
              <Textarea {...register('notes')} />
            </Field>
          </fieldset>
          <div className="form-actions">
            <Button type="submit" disabled={busy || formState.isSubmitting}>
              {t('poa.save')}
            </Button>
            <Button type="button" variant="secondary" data-draft-cancel onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        </FieldGroup>
      </DraftForm>
      <InlineClientCreateDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={clientName}
        onCreated={(id) =>
          setValue('clientIds', [...new Set([...getValues('clientIds'), id])], {
            shouldDirty: true,
          })
        }
      />
    </>
  );
}
