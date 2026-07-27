import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { CaseDto } from "../../../bridge/types";
import { CaseCoreFields } from "./CaseCoreFields";
import { caseCoreSchema, CaseCoreFormValues } from "../schemas/case.schema";

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
      caseNumber: caseDto.caseNumber,
      judicialYear: caseDto.judicialYear ?? undefined,
      courtName: caseDto.courtName ?? undefined,
      circuitName: caseDto.circuitName ?? undefined,
      caseType: caseDto.caseType ?? undefined,
      clientLegalCapacity: caseDto.clientLegalCapacity ?? undefined,
      status: caseDto.status,
      filedOn: caseDto.filedOn ?? undefined,
      closedOn: caseDto.closedOn ?? undefined,
      summary: caseDto.summary ?? undefined,
      notes: caseDto.notes ?? undefined,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CaseCoreFields register={register} />
      <button disabled={busy || formState.isSubmitting}>{t("cases.save")}</button>
    </form>
  );
}
