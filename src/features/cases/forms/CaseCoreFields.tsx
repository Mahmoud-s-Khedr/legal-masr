import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select';
import { CreatableCombobox } from '@/components/forms/CreatableCombobox';

import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Field } from '../../../components/forms/FormField';
import { Input } from '../../../components/ui/input';

import { Textarea } from '../../../components/ui/textarea';
import {
  CASE_STATUSES,
  CaseCoreFormValues,
  LITIGATION_DEGREES,
  parseYearInput,
} from '../schemas/case.schema';

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
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CASE_STATUSES.map((status) => ({
                        value: status,
                        label: t(`cases.status.${status}`),
                      })).map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={t('cases.fields.litigationDegree')}>
            <Controller
              control={control}
              name={'litigationDegree' as never}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(value) => field.onChange(value || undefined)}
                  items={[
                    { value: '', label: t('forms.notSpecified') },
                    ...LITIGATION_DEGREES.map((degree) => ({
                      value: degree,
                      label: t(`cases.degrees.${degree}`),
                    })),
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {[
                        { value: '', label: t('forms.notSpecified') },
                        ...LITIGATION_DEGREES.map((degree) => ({
                          value: degree,
                          label: t(`cases.degrees.${degree}`),
                        })),
                      ].map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label={t('cases.fields.officialNumber')}
            hint={t('cases.form.officialNumberHint')}
            error={errorFor('officialNumber', t('cases.form.officialNumberRequired'))}
          >
            <Input dir="ltr" {...register('officialNumber' as never)} />
          </Field>
          <Field
            label={t('cases.fields.caseYear')}
            hint={t('cases.form.caseYearHint')}
            error={errorFor('officialYear', t('forms.invalidYear'))}
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              {...register('officialYear' as never, { setValueAs: parseYearInput })}
            />
          </Field>
          <Field
            label={t('cases.fields.judicialYear')}
            hint={t('cases.form.judicialYearHint')}
            error={errorFor('judicialYear', t('forms.invalidJudicialYear'))}
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              {...register('judicialYear' as never, { setValueAs: parseYearInput })}
            />
          </Field>
          <Field label={t('cases.fields.caseType')} hint={t('cases.form.caseTypeHint')}>
            <CreatableCombobox suggestion="caseType" {...register('caseType' as never)} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend className="form-section-title">{t('cases.form.courtSection')}</legend>
        <div className="form-grid">
          <Field label={t('cases.fields.courtName')}>
            <CreatableCombobox
              suggestion="courtName"
              {...register('courtName' as never)}
              placeholder={t('cases.form.courtPlaceholder')}
            />
          </Field>
          <Field label={t('cases.fields.circuitName')}>
            <CreatableCombobox suggestion="circuitName" {...register('circuitName' as never)} />
          </Field>
          <Field
            label={t('cases.fields.filedOn')}
            error={errorFor('filedOn', t('forms.invalidDate'))}
          >
            <Controller
              control={control}
              name={'filedOn' as never}
              render={({ field }) => <DatePicker {...field} value={field.value ?? ''} />}
            />
          </Field>
          <Field
            label={t('cases.fields.closedOn')}
            error={
              errors?.closedOn?.message === 'CLOSED_BEFORE_FILED'
                ? t('forms.closedBeforeFiled')
                : errorFor('closedOn', t('forms.invalidDate'))
            }
          >
            <Controller
              control={control}
              name={'closedOn' as never}
              render={({ field }) => <DatePicker {...field} value={field.value ?? ''} />}
            />
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
