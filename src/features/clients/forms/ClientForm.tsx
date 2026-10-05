import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { clientFormDefaults, ClientFormValues, clientFormSchema } from '../schemas/client.schema';

export function ClientForm({
  defaultValues,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<ClientFormValues>;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...clientFormDefaults, ...defaultValues },
  });
  const { errors } = formState;

  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
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
            hint={t('clients.form.internalNumberHint')}
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
        <Button disabled={busy || formState.isSubmitting}>{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
            {t('clients.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
