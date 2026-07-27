import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ClientSummary } from "../../../bridge/types";
import { CaseCoreFields } from "./CaseCoreFields";
import { CaseCreateFormValues, caseCreateFormSchema } from "../schemas/case.schema";

export function CaseCreateForm({
  clients,
  busy,
  onSubmit,
  onCancel,
}: {
  clients: ClientSummary[];
  busy: boolean;
  onSubmit: (values: CaseCreateFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, control, formState } = useForm<CaseCreateFormValues>({
    resolver: zodResolver(caseCreateFormSchema),
    defaultValues: { status: "DRAFT", clientIds: [], primaryClientId: "" },
  });
  const selectedClientIds = useWatch({ control, name: "clientIds" }) ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CaseCoreFields register={register} />
      <fieldset>
        <legend>{t("cases.fields.clients")}</legend>
        {clients.map((client) => (
          <label key={client.id} className="checkbox-field">
            <input type="checkbox" value={client.id} {...register("clientIds")} />
            {client.displayName}
          </label>
        ))}
      </fieldset>
      {selectedClientIds.length > 0 && (
        <label>
          {t("cases.fields.primaryClient")}
          <select {...register("primaryClientId")}>
            <option value="" disabled>
              {t("cases.fields.primaryClient")}
            </option>
            {clients
              .filter((client) => selectedClientIds.includes(client.id))
              .map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="form-actions">
        <button disabled={busy || formState.isSubmitting}>{t("cases.save")}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          {t("cases.cancel")}
        </button>
      </div>
    </form>
  );
}
