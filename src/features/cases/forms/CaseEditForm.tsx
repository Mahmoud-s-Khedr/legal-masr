import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CaseDto } from '../../../bridge/types';
import { CaseCoreFields } from './CaseCoreFields';
import { caseCoreSchema, CaseCoreFormValues } from '../schemas/case.schema';

export function CaseEditForm({
  caseDto,
  busy,
  onSubmit,
}: {
  caseDto: CaseDto;
  busy: boolean;
  onSubmit: (values: CaseCoreFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<CaseCoreFormValues>({
    resolver: zodResolver(caseCoreSchema),
    defaultValues: {
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
      <CaseCoreFields register={register} />
      <button disabled={busy || formState.isSubmitting}>{t('cases.save')}</button>
    </form>
  );
}
