import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ClientSummary } from '../../../bridge/types';
import { Button } from '../../../components/ui/button';
import { CaseCoreFields } from './CaseCoreFields';
import { ClientPicker } from './ClientPicker';
import {
  CaseCreateFormValues,
  caseCreateFormDefaults,
  caseCreateFormSchema,
} from '../schemas/case.schema';

export function CaseCreateForm({
  clients,
  initialClientIds = [],
  busy,
  onSubmit,
  onCancel,
}: {
  clients: ClientSummary[];
  initialClientIds?: string[];
  busy: boolean;
  onSubmit: (values: CaseCreateFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, formState, getValues, setValue } =
    useForm<CaseCreateFormValues>({
      resolver: zodResolver(caseCreateFormSchema),
      defaultValues: { ...caseCreateFormDefaults, clientIds: initialClientIds },
    });
  // A preselected client (from ?client=) only counts once it is a loaded, active client.
  useEffect(() => {
    if (!clients.length) return;
    const selected = getValues('clientIds');
    const known = selected.filter((id) => clients.some((client) => client.id === id));
    if (known.length !== selected.length) setValue('clientIds', known);
  }, [clients, getValues, setValue]);

  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <fieldset className="form-section">
        <legend className="form-section-title">{t('cases.fields.clients')}</legend>
        <p className="form-section-hint">{t('cases.form.clientsHint')}</p>
        <Controller
          control={control}
          name="clientIds"
          render={({ field }) => (
            <ClientPicker
              clients={clients}
              value={field.value}
              onChange={field.onChange}
              error={formState.errors.clientIds ? t('cases.form.clientsRequired') : undefined}
            />
          )}
        />
      </fieldset>
      <CaseCoreFields
        register={register}
        control={control}
        errors={formState.errors}
        autoFocus={false}
      />
      <div className="form-actions">
        <Button disabled={busy || formState.isSubmitting}>{t('cases.save')}</Button>
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('cases.cancel')}
        </Button>
      </div>
    </form>
  );
}
