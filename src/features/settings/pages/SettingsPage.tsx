import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { BackupSettingsPanel } from "../../backups/pages/BackupsPage";
import { useSettings, useUpdateSettings } from "../api/settingsApi";
import { SettingsFormValues, settingsSchema } from "../schemas/settings.schema";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings) reset({ language: settings.language, theme: settings.theme, lockTimeoutMinutes: settings.lockTimeoutMinutes });
  }, [settings, reset]);

  if (isLoading || !settings) return <p>{t("settings.loading")}</p>;

  const selectedTab = searchParams.get("tab") === "backups" ? "backups" : searchParams.get("tab") === "security" ? "security" : "general";
  const chooseTab = (tab: "general" | "security" | "backups") => setSearchParams(tab === "general" ? {} : { tab });

  return (
    <section className="settings">
      <p className="kicker">{t("settings.kicker")}</p>
      <h2>{t("settings.heading")}</h2>
      <div className="settings-tabs" role="tablist" aria-label={t("settings.heading")}>
        {(["general", "security", "backups"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={selectedTab === tab} className={selectedTab === tab ? "active" : ""} onClick={() => chooseTab(tab)}>{t(`settings.tabs.${tab}`)}</button>)}
      </div>
      {selectedTab === "backups" ? <BackupSettingsPanel /> : (
        <form onSubmit={handleSubmit(async (values) => {
          await updateSettings.mutateAsync({ ...values, backupDirectory: settings.backupDirectory ?? "" });
          await i18n.changeLanguage(values.language);
          setSaved(true);
        })}>
          {selectedTab === "general" ? <>
            <label>{t("settings.language")}<select {...register("language")}><option value="ar">{t("gate.fields.languageAr")}</option><option value="en">{t("gate.fields.languageEn")}</option></select></label>
            <label>{t("settings.theme")}<select {...register("theme")}><option value="system">{t("settings.themes.system")}</option><option value="light">{t("settings.themes.light")}</option><option value="dark">{t("settings.themes.dark")}</option></select></label>
          </> : <label>{t("settings.lockTimeout")}<input type="number" min="1" {...register("lockTimeoutMinutes", { valueAsNumber: true })} /></label>}
          <button>{t("settings.save")}</button>
          {saved && <p className="success">{t("settings.saved")}</p>}
        </form>
      )}
    </section>
  );
}
