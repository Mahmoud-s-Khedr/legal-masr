import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCaseList } from "../../cases/api/casesApi";
import { useClientList } from "../../clients/api/clientsApi";

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: clients, isLoading: clientsLoading } = useClientList({});
  const { data: cases, isLoading: casesLoading } = useCaseList({});
  return (
    <section className="dashboard-ledger">
      <header className="page-heading compact-heading">
        <div><p className="kicker">{t("dashboard.heroTag")}</p><h2>{t("dashboard.heading")}</h2><p>{t("dashboard.description")}</p></div>
        <div className="quick-actions"><Link className="button-link" to="/clients/new">{t("dashboard.addClient")}</Link><Link className="button-link secondary-link" to="/cases/new">{t("dashboard.addCase")}</Link></div>
      </header>
      <div className="dashboard-registers">
        <section className="register-section" aria-labelledby="recent-clients-heading">
          <div className="register-heading"><div><p className="kicker">{t("dashboard.clientsKicker")}</p><h3 id="recent-clients-heading">{t("dashboard.clientsTitle")}</h3></div><Link className="text-link" to="/clients">{t("dashboard.viewAll")}</Link></div>
          {clientsLoading ? <p className="table-message">{t("clients.loading")}</p> : !clients?.length ? <p className="table-message">{t("clients.empty")}</p> : <div className="data-table-scroll"><table className="data-table dashboard-table"><thead><tr><th scope="col">{t("clients.columns.name")}</th><th scope="col">{t("clients.columns.phone")}</th></tr></thead><tbody>{clients.slice(0, 5).map((client) => <tr key={client.id}><th scope="row"><Link to={`/clients/${client.id}`}>{client.displayName}</Link></th><td dir="ltr">{client.primaryPhone ?? "—"}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="register-section" aria-labelledby="recent-cases-heading">
          <div className="register-heading"><div><p className="kicker">{t("dashboard.casesKicker")}</p><h3 id="recent-cases-heading">{t("dashboard.casesTitle")}</h3></div><Link className="text-link" to="/cases">{t("dashboard.viewAll")}</Link></div>
          {casesLoading ? <p className="table-message">{t("cases.loading")}</p> : !cases?.length ? <p className="table-message">{t("cases.empty")}</p> : <div className="data-table-scroll"><table className="data-table dashboard-table"><thead><tr><th scope="col">{t("cases.columns.number")}</th><th scope="col">{t("cases.columns.client")}</th><th scope="col">{t("cases.columns.status")}</th></tr></thead><tbody>{cases.slice(0, 5).map((caseSummary) => <tr key={caseSummary.id}><th scope="row"><Link to={`/cases/${caseSummary.id}`}>{caseSummary.caseNumber}</Link></th><td>{caseSummary.primaryClientName ?? "—"}</td><td><span className="badge">{t(`cases.status.${caseSummary.status}`)}</span></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </section>
  );
}
