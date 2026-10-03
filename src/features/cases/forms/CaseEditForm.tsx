import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { useTranslation } from 'react-i18next';
import type { CaseDto } from '../../../bridge/types';
import { CaseCoreFields } from './CaseCoreFields';
import { caseCoreFormDefaults, caseCoreSchema, CaseCoreFormValues } from '../schemas/case.schema';

export function CaseEditForm({
  caseDto,
  busy,
  onSubmit,
  onCancel,
}: {
  caseDto: CaseDto;
  busy: boolean;
  onSubmit: (values: CaseCoreFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, formState } = useForm<CaseCoreFormValues>({
    resolver: zodResolver(caseCoreSchema),
    defaultValues: {
      ...caseCoreFormDefaults,
      internalNumber: caseDto.internalNumber,
      officialNumber: caseDto.officialNumber ?? undefined,
      officialYear: caseDto.officialYear ?? undefined,
      courtName: caseDto.courtName ?? undefined,
      circuitName: caseDto.circuitName ?? undefined,
      caseType: caseDto.caseType ?? undefined,
      litigationDegree: caseDto.litigationDegree ?? undefined,
      status: caseDto.status,
      filedOn: caseDto.filedOn ?? undefined,
      closedOn: caseDto.closedOn ?? undefined,
      subject: caseDto.subject ?? undefined,
      notes: caseDto.notes ?? undefined,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CaseCoreFields register={register} control={control} />
      <div className="form-actions">
        <Button disabled={busy || formState.isSubmitting}>{t('cases.save')}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </form>
  );
}
