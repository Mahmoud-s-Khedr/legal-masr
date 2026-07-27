import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useCaseList } from "../api/casesApi";

export function CaseListPage() {
  const { t } = useTranslation();
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const { data: cases, isLoading } = useCaseList({ includeArchived });

  return (
    <section className="entity-list">
      <div className="entity-list-header">
        <h2>{t("cases.title")}</h2>
        <button onClick={() => navigate("/cases/new")}>{t("cases.newButton")}</button>
      </div>

      <div className="entity-list-toolbar">
        <label className="checkbox-field">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          {t("cases.showArchived")}
        </label>
      </div>

      {isLoading ? <p className="table-message">{t("cases.loading")}</p> : !cases?.length ? <p className="table-message">{t("cases.empty")}</p> : (
        <div className="data-table-scroll">
          <table className="data-table">
            <caption>{t("cases.tableCaption")}</caption>
            <thead><tr>
              <th scope="col">{t("cases.columns.number")}</th>
              <th scope="col">{t("cases.columns.year")}</th>
              <th scope="col">{t("cases.columns.client")}</th>
              <th scope="col">{t("cases.columns.status")}</th>
            </tr></thead>
            <tbody>{cases.map((caseSummary) => (
              <tr key={caseSummary.id}>
                <th scope="row"><Link to={`/cases/${caseSummary.id}`}>{caseSummary.caseNumber}</Link></th>
                <td>{caseSummary.judicialYear ?? "—"}</td>
                <td>{caseSummary.primaryClientName ?? "—"}</td>
                <td><span className="badge">{caseSummary.archivedAt ? t("cases.archivedBadge") : t(`cases.status.${caseSummary.status}`)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
