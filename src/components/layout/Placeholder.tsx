import { useTranslation } from "react-i18next";

export function Placeholder({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <section className="placeholder compact-placeholder">
      <div><span>{t("placeholder.tag")}</span><h2>{label}</h2></div>
      <p>{t("placeholder.description")}</p>
    </section>
  );
}
