import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ClientSummary } from '../../../bridge/types';
import { CaseCoreFields } from './CaseCoreFields';
import { CaseCreateFormValues, caseCreateFormSchema } from '../schemas/case.schema';

export function CaseCreateForm({
  clients,
  busy,
  onSubmit,
  onCancel,
}: {
  clients: ClientSummary[];
  busy: boolean;
  onSubmit: (values: CaseCreateFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, control, formState } = useForm<CaseCreateFormValues>({
    resolver: zodResolver(caseCreateFormSchema),
    defaultValues: { status: 'ACTIVE', clientIds: [] },
  });
  const selectedClientIds = useWatch({ control, name: 'clientIds' }) ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CaseCoreFields register={register} />
      <fieldset>
        <legend>{t('cases.fields.clients')}</legend>
        {clients.map((client) => (
          <label key={client.id} className="checkbox-field">
            <input type="checkbox" value={client.id} {...register('clientIds')} />
            {client.fullName}
          </label>
        ))}
      </fieldset>
      <div className="form-actions">
        <button disabled={busy || formState.isSubmitting}>{t('cases.save')}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          {t('cases.cancel')}
        </button>
      </div>
    </form>
  );
}
