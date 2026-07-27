import { UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CASE_STATUSES, CaseCoreFormValues } from "../schemas/case.schema";

export function CaseCoreFields<T extends CaseCoreFormValues>({ register }: { register: UseFormRegister<T> }) {
  const { t } = useTranslation();
  return (
    <>
      <label>
        {t("cases.fields.caseNumber")}
        <input dir="ltr" {...register("caseNumber" as never)} required autoFocus />
      </label>
      <label>
        {t("cases.fields.judicialYear")}
        <input type="number" dir="ltr" {...register("judicialYear" as never, { valueAsNumber: true })} />
      </label>
      <label>
        {t("cases.fields.status")}
        <select {...register("status" as never)}>
          {CASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`cases.status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("cases.fields.courtName")}
        <input {...register("courtName" as never)} />
      </label>
      <label>
        {t("cases.fields.circuitName")}
        <input {...register("circuitName" as never)} />
      </label>
      <label>
        {t("cases.fields.caseType")}
        <input {...register("caseType" as never)} />
      </label>
      <label>
        {t("cases.fields.clientLegalCapacity")}
        <input {...register("clientLegalCapacity" as never)} />
      </label>
      <label>
        {t("cases.fields.filedOn")}
        <input type="date" dir="ltr" {...register("filedOn" as never)} />
      </label>
      <label>
        {t("cases.fields.closedOn")}
        <input type="date" dir="ltr" {...register("closedOn" as never)} />
      </label>
      <label>
        {t("cases.fields.summary")}
        <textarea {...register("summary" as never)} />
      </label>
      <label>
        {t("cases.fields.notes")}
        <textarea {...register("notes" as never)} />
      </label>
    </>
  );
}
