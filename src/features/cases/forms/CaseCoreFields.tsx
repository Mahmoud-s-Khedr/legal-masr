import { Controller, type Control, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { CASE_STATUSES, CaseCoreFormValues, LITIGATION_DEGREES } from '../schemas/case.schema';

export function CaseCoreFields<T extends CaseCoreFormValues>({
  register,
  control,
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label>
        {t('cases.fields.caseNumber')}
        <Input dir="ltr" {...register('internalNumber' as never)} required autoFocus />
      </label>
      <label>
        {t('cases.fields.judicialYear')}
        <Input
          type="number"
          dir="ltr"
          {...register('officialYear' as never, { valueAsNumber: true })}
        />
      </label>
      <label>
        {t('cases.fields.status')}
        <Controller
          control={control}
          name={'status' as never}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              items={CASE_STATUSES.map((status) => ({
                value: status,
                label: t(`cases.status.${status}`),
              }))}
            />
          )}
        />
      </label>
      <label>
        {t('cases.fields.courtName')}
        <Input {...register('courtName' as never)} />
      </label>
      <label>
        {t('cases.fields.circuitName')}
        <Input {...register('circuitName' as never)} />
      </label>
      <label>
        {t('cases.fields.caseType')}
        <Input {...register('caseType' as never)} />
      </label>
      <label>
        الدرجة القضائية
        <Controller
          control={control}
          name={'litigationDegree' as never}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(value) => field.onChange(value || undefined)}
              placeholder="—"
              items={LITIGATION_DEGREES.map((degree) => ({ value: degree, label: degree }))}
            />
          )}
        />
      </label>
      <label>
        {t('cases.fields.filedOn')}
        <DatePicker {...register('filedOn' as never)} />
      </label>
      <label>
        {t('cases.fields.closedOn')}
        <DatePicker {...register('closedOn' as never)} />
      </label>
      <label>
        {t('cases.fields.summary')}
        <Textarea {...register('subject' as never)} />
      </label>
      <label>
        {t('cases.fields.notes')}
        <Textarea {...register('notes' as never)} />
      </label>
    </>
  );
}
