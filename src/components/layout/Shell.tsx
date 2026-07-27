import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, NavLink } from "react-router-dom";
import { AppRoutes, NAV_ITEMS } from "../../app/router";
import { GlobalSearch } from "../../features/search/components/GlobalSearch";
import { useSettings } from "../../features/settings/api/settingsApi";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Icon } from "./Icon";

const NAV_ICONS = ["home", "clients", "cases", "calendar", "tasks", "documents", "finances", "settings"] as const;

export function Shell({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const lockTimeoutMinutes = settings?.lockTimeoutMinutes;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!lockTimeoutMinutes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLock, lockTimeoutMinutes * 60_000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [lockTimeoutMinutes, onLock]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  const navigation = (onNavigate?: () => void) => (
    <nav aria-label={t("app.workspaceKicker")}>
      <p className="sidebar-section-label">{t("app.workspaceKicker")}</p>
      {NAV_ITEMS.map(({ to, key }, index) => (
        <NavLink key={to} to={to} end={to === "/"} onClick={onNavigate}>
          <Icon name={NAV_ICONS[index]} />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <button className="menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label={t("app.openMenu")} aria-expanded={drawerOpen}>
              <Icon name="menu" size={21} />
            </button>
            <div className="brand-block">
              <img src="/logo.png" alt="" />
              <div><strong>{t("app.brandName")}</strong><span>{t("app.brandTagline")}</span></div>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap"><Icon name="search" size={18} /><GlobalSearch /></div>
            <span className="local-status">{t("app.localOnly")}</span>
            <LanguageSwitcher />
            <button className="lock-button" onClick={onLock} aria-label={t("app.lockButton")}>
              <Icon name="lock" size={17} />
              <span>{t("app.lockButton")}</span>
            </button>
          </div>
        </header>
        <aside className="sidebar">
          {navigation()}
          <div className="sidebar-footer"><span>{t("app.localOnly")}</span></div>
        </aside>
        <main className="workspace">
          <AppRoutes />
        </main>
        {drawerOpen && (
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label={t("app.workspaceKicker")}>
            <button className="drawer-backdrop" type="button" onClick={() => setDrawerOpen(false)} aria-label={t("app.closeMenu")} />
            <aside className="drawer-panel">
              <div className="drawer-header">
                <strong>{t("app.brandName")}</strong>
                <button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label={t("app.closeMenu")}><Icon name="close" size={20} /></button>
              </div>
              {navigation(() => setDrawerOpen(false))}
              <div className="sidebar-footer"><span>{t("app.localOnly")}</span></div>
            </aside>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
