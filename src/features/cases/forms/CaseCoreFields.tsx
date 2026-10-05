import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { CASE_STATUSES, CaseCoreFormValues, LITIGATION_DEGREES } from '../schemas/case.schema';

export function CaseCoreFields<T extends CaseCoreFormValues>({
  register,
  control,
  errors,
  autoFocus = true,
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
  errors?: FieldErrors<FieldValues>;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const errorFor = (name: keyof CaseCoreFormValues, message = t('forms.invalid')) =>
    errors?.[name] ? message : undefined;
  return (
    <>
      <fieldset className="form-section">
        <legend className="form-section-title">{t('cases.form.identitySection')}</legend>
        <div className="form-grid form-grid-3">
          <Field
            label={t('cases.fields.caseNumber')}
            hint={t('cases.form.internalNumberHint')}
            error={errorFor('internalNumber', t('forms.required'))}
            required
          >
            <Input dir="ltr" {...register('internalNumber' as never)} autoFocus={autoFocus} />
          </Field>
          <Field label={t('cases.fields.officialNumber')} hint={t('cases.form.officialNumberHint')}>
            <Input dir="ltr" {...register('officialNumber' as never)} />
          </Field>
          <Field label={t('cases.fields.judicialYear')} error={errorFor('officialYear')}>
            <Input
              type="number"
              dir="ltr"
              inputMode="numeric"
              min={1900}
              max={2200}
              {...register('officialYear' as never, { valueAsNumber: true })}
            />
          </Field>
          <Field label={t('cases.fields.caseType')} hint={t('cases.form.caseTypeHint')}>
            <Input {...register('caseType' as never)} />
          </Field>
          <Field label={t('cases.fields.litigationDegree')}>
            <Controller
              control={control}
              name={'litigationDegree' as never}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(value) => field.onChange(value || undefined)}
                  placeholder={t('forms.notSpecified')}
                  items={[
                    { value: '', label: t('forms.notSpecified') },
                    ...LITIGATION_DEGREES.map((degree) => ({
                      value: degree,
                      label: t(`cases.degrees.${degree}`),
                    })),
                  ]}
                />
              )}
            />
          </Field>
          <Field label={t('cases.fields.status')}>
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
          </Field>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend className="form-section-title">{t('cases.form.courtSection')}</legend>
        <div className="form-grid">
          <Field label={t('cases.fields.courtName')}>
            <Input
              {...register('courtName' as never)}
              placeholder={t('cases.form.courtPlaceholder')}
            />
          </Field>
          <Field label={t('cases.fields.circuitName')}>
            <Input {...register('circuitName' as never)} />
          </Field>
          <Field label={t('cases.fields.filedOn')} error={errorFor('filedOn')}>
            <DatePicker {...register('filedOn' as never)} />
          </Field>
          <Field label={t('cases.fields.closedOn')} error={errorFor('closedOn')}>
            <DatePicker {...register('closedOn' as never)} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend className="form-section-title">{t('cases.form.subjectSection')}</legend>
        <div className="form-grid">
          <Field label={t('cases.fields.summary')}>
            <Textarea {...register('subject' as never)} />
          </Field>
          <Field label={t('cases.fields.notes')}>
            <Textarea {...register('notes' as never)} />
          </Field>
        </div>
      </fieldset>
    </>
  );
}
