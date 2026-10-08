import { DraftForm } from '@/components/forms/DraftForm';
import { FieldGroup } from '@/components/ui/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/forms/FormField';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { clientFormDefaults, ClientFormValues, clientFormSchema } from '../schemas/client.schema';

export function ClientForm({
  defaultValues,
  suggestedNumber,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<ClientFormValues>;
  /** The next free internal number, filled in while the field is still empty. */
  suggestedNumber?: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState, control, getValues, setValue } =
    useForm<ClientFormValues>({
      resolver: zodResolver(clientFormSchema),
      defaultValues: { ...clientFormDefaults, ...defaultValues },
    });
  useEffect(() => {
    if (suggestedNumber && !getValues('internalNumber'))
      setValue('internalNumber', suggestedNumber);
  }, [suggestedNumber, getValues, setValue]);
  const internalNumber = useWatch({ control, name: 'internalNumber' });
  const { errors } = formState;

  return (
    <DraftForm
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        return handleSubmit((values) => onSubmit(values).catch(() => undefined))(event);
      }}
    >
      <FieldGroup>
        <fieldset className="form-section">
          <legend className="form-section-title">{t('clients.form.identitySection')}</legend>
          <div className="form-grid">
            <Field
              label={t('clients.fields.fullName')}
              error={errors.fullName ? t('forms.required') : undefined}
              required
              className="span-all"
            >
              <Input {...register('fullName')} autoFocus autoComplete="off" />
            </Field>
            <Field
              label={t('clients.fields.internalNumber')}
              hint={
                suggestedNumber && internalNumber === suggestedNumber
                  ? t('forms.suggestedNumber')
                  : t('clients.form.internalNumberHint')
              }
              error={errors.internalNumber ? t('forms.required') : undefined}
              required
            >
              <Input dir="ltr" {...register('internalNumber')} autoComplete="off" />
            </Field>
            <Field label={t('clients.fields.nationalId')} hint={t('clients.form.nationalIdHint')}>
              <Input dir="ltr" inputMode="numeric" {...register('nationalId')} autoComplete="off" />
            </Field>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend className="form-section-title">{t('clients.form.contactSection')}</legend>
          <div className="form-grid">
            <Field label={t('clients.fields.primaryPhone')}>
              <Input dir="ltr" type="tel" inputMode="tel" {...register('primaryPhone')} />
            </Field>
            <Field label={t('clients.fields.email')}>
              <Input type="email" dir="ltr" {...register('email')} />
            </Field>
            <Field label={t('clients.fields.address')} className="span-all">
              <Input {...register('address')} />
            </Field>
            <Field label={t('clients.fields.notes')} className="span-all">
              <Textarea {...register('notes')} />
            </Field>
          </div>
        </fieldset>
        <div className="form-actions">
          <Button type="submit" disabled={busy || formState.isSubmitting}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t('clients.cancel')}
            </Button>
          )}
        </div>
      </FieldGroup>
    </DraftForm>
  );
}
