import { UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CASE_STATUSES, CaseCoreFormValues, LITIGATION_DEGREES } from '../schemas/case.schema';

export function CaseCoreFields<T extends CaseCoreFormValues>({
  register,
}: {
  register: UseFormRegister<T>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label>
        {t('cases.fields.caseNumber')}
        <input dir="ltr" {...register('internalNumber' as never)} required autoFocus />
      </label>
      <label>
        {t('cases.fields.judicialYear')}
        <input
          type="number"
          dir="ltr"
          {...register('officialYear' as never, { valueAsNumber: true })}
        />
      </label>
      <label>
        {t('cases.fields.status')}
        <select {...register('status' as never)}>
          {CASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`cases.status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('cases.fields.courtName')}
        <input {...register('courtName' as never)} />
      </label>
      <label>
        {t('cases.fields.circuitName')}
        <input {...register('circuitName' as never)} />
      </label>
      <label>
        {t('cases.fields.caseType')}
        <input {...register('caseType' as never)} />
      </label>
      <label>
        الدرجة القضائية
        <select {...register('litigationDegree' as never)}>
          <option value="">—</option>
          {LITIGATION_DEGREES.map((degree) => (
            <option key={degree} value={degree}>
              {degree}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('cases.fields.filedOn')}
        <input type="date" dir="ltr" {...register('filedOn' as never)} />
      </label>
      <label>
        {t('cases.fields.closedOn')}
        <input type="date" dir="ltr" {...register('closedOn' as never)} />
      </label>
      <label>
        {t('cases.fields.summary')}
        <textarea {...register('subject' as never)} />
      </label>
      <label>
        {t('cases.fields.notes')}
        <textarea {...register('notes' as never)} />
      </label>
    </>
  );
}
