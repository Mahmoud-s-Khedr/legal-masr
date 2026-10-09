import { DraftForm } from '@/components/forms/DraftForm';
import { FieldGroup } from '@/components/ui/field';
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
      judicialYear: caseDto.judicialYear ?? undefined,
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
    <DraftForm
      control={control}
      noValidate
      className="dialog-wide-form"
      onSubmit={handleSubmit((values) => onSubmit(values).catch(() => undefined))}
    >
      <FieldGroup>
        <CaseCoreFields register={register} control={control} errors={formState.errors} />
        <div className="form-actions">
          <Button type="submit" disabled={busy || formState.isSubmitting}>
            {t('records.saveEdits')}
          </Button>
          {onCancel && (
            <Button type="button" variant="secondary" data-draft-cancel onClick={onCancel}>
              {t('cases.cancel')}
            </Button>
          )}
        </div>
      </FieldGroup>
    </DraftForm>
  );
}
