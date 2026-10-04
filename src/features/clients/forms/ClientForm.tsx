import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
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

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <label>
        الرقم الداخلي
        <Input dir="ltr" {...register('internalNumber')} required autoFocus />
      </label>
      <label>
        الاسم الكامل
        <Input {...register('fullName')} required />
      </label>
      <label>
        {t('clients.fields.primaryPhone')}
        <Input dir="ltr" {...register('primaryPhone')} />
      </label>
      <label>
        {t('clients.fields.nationalId')}
        <Input {...register('nationalId')} />
      </label>
      <label>
        {t('clients.fields.email')}
        <Input type="email" dir="ltr" {...register('email')} />
      </label>
      <label>
        {t('clients.fields.address')}
        <Input {...register('address')} />
      </label>
      <label>
        {t('clients.fields.notes')}
        <Textarea {...register('notes')} />
      </label>
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
