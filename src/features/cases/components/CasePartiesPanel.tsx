import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import type { CaseDto } from '../../../bridge/types';
import { useAddParty, useRemoveParty } from '../api/casesApi';
import { CasePartyFormValues, casePartyFormSchema } from '../schemas/case.schema';

const ROLES = ['OPPONENT', 'WITNESS', 'EXPERT', 'OTHER'] as const;

export function CasePartiesPanel({ caseDto }: { caseDto: CaseDto }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const addParty = useAddParty();
  const removeParty = useRemoveParty(caseDto.id);
  const { register, handleSubmit, reset, formState } = useForm<CasePartyFormValues>({
    resolver: zodResolver(casePartyFormSchema),
    defaultValues: { role: 'OPPONENT', name: '' },
  });

  return (
    <div className="panel">
      <h3>{t('cases.parties.title')}</h3>
      {caseDto.parties.length === 0 ? (
        <p>{t('cases.parties.empty')}</p>
      ) : (
        <ul className="entity-list-rows">
          {caseDto.parties.map((party) => (
            <li key={party.id}>
              {party.name} <span className="badge">{t(`cases.parties.roles.${party.role}`)}</span>
              {party.phone && <span className="muted"> — {party.phone}</span>}
              <button className="text-button" onClick={() => removeParty.mutate(party.id)}>
                {t('cases.parties.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form
          onSubmit={handleSubmit(async (values) => {
            await addParty.mutateAsync({ caseId: caseDto.id, ...values });
            reset({ role: 'OPPONENT', name: '' });
            setAdding(false);
          })}
        >
          <label>
            {t('cases.parties.role')}
            <select {...register('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`cases.parties.roles.${role}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('cases.parties.name')}
            <input {...register('name')} required autoFocus />
          </label>
          <label>
            {t('cases.parties.phone')}
            <input dir="ltr" {...register('phone')} />
          </label>
          <div className="form-actions">
            <button disabled={formState.isSubmitting}>{t('cases.parties.add')}</button>
            <button type="button" className="secondary-button" onClick={() => setAdding(false)}>
              {t('cases.cancel')}
            </button>
          </div>
          {addParty.isError && (
            <p className="error">{errorMessage(addParty.error, t('app.defaultError'))}</p>
          )}
        </form>
      ) : (
        <button onClick={() => setAdding(true)}>{t('cases.parties.add')}</button>
      )}
    </div>
  );
}
