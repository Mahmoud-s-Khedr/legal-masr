import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label>
        الرقم الداخلي
        <input dir="ltr" {...register('internalNumber')} required autoFocus />
      </label>
      <label>
        الاسم الكامل
        <input {...register('fullName')} required />
      </label>
      <label>
        {t('clients.fields.primaryPhone')}
        <input dir="ltr" {...register('primaryPhone')} />
      </label>
      <label>
        {t('clients.fields.nationalId')}
        <input {...register('nationalId')} />
      </label>
      <label>
        {t('clients.fields.email')}
        <input type="email" dir="ltr" {...register('email')} />
      </label>
      <label>
        {t('clients.fields.address')}
        <input {...register('address')} />
      </label>
      <label>
        {t('clients.fields.notes')}
        <textarea {...register('notes')} />
      </label>
      <div className="form-actions">
        <button disabled={busy || formState.isSubmitting}>{submitLabel}</button>
        {onCancel && (
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t('clients.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
