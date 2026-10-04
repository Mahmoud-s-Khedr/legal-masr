import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ClientSummary } from '../../../bridge/types';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { CaseCoreFields } from './CaseCoreFields';
import {
  CaseCreateFormValues,
  caseCreateFormDefaults,
  caseCreateFormSchema,
} from '../schemas/case.schema';

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
  const { register, control, handleSubmit, formState } = useForm<CaseCreateFormValues>({
    resolver: zodResolver(caseCreateFormSchema),
    defaultValues: caseCreateFormDefaults,
  });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}>
      <CaseCoreFields register={register} control={control} />
      <fieldset>
        <legend>{t('cases.fields.clients')}</legend>
        {clients.map((client) => (
          <Controller
            key={client.id}
            control={control}
            name="clientIds"
            render={({ field }) => (
              <div className="checkbox-field">
                <Checkbox
                  checked={field.value.includes(client.id)}
                  onCheckedChange={(checked) =>
                    field.onChange(
                      checked
                        ? [...field.value, client.id]
                        : field.value.filter((id) => id !== client.id),
                    )
                  }
                  aria-label={client.fullName}
                />
                {client.fullName}
              </div>
            )}
          />
        ))}
      </fieldset>
      <div className="form-actions">
        <Button disabled={busy || formState.isSubmitting}>{t('cases.save')}</Button>
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          {t('cases.cancel')}
        </Button>
      </div>
    </form>
  );
}
