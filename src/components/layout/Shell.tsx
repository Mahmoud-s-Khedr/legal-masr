import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink } from 'react-router-dom';
import { AppRoutes, NAV_ITEMS } from '../../app/router';
import { GlobalSearch } from '../../features/search/components/GlobalSearch';
import { useSettings } from '../../features/settings/api/settingsApi';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Icon } from './Icon';

export function Shell({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const lockTimeoutMinutes = settings?.lockTimeoutMinutes;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lockTimeoutMinutes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLock, lockTimeoutMinutes * 60_000);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [lockTimeoutMinutes, onLock]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  useEffect(() => {
    if (!createOpen) return;
    createMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateOpen(false);
        createButtonRef.current?.focus();
      }
      if (event.key === 'Tab' && !createMenuRef.current?.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createOpen]);

  const navigation = (onNavigate?: () => void) => (
    <nav aria-label={t('app.workspaceKicker')}>
      <p className="sidebar-section-label">{t('app.workspaceKicker')}</p>
      {NAV_ITEMS.map(({ to, key, icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}>
          <Icon name={icon} />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand brand-block">
            <img src="/logo.png" alt="" />
            <div>
              <strong>{t('app.brandName')}</strong>
              <span>{t('app.brandTagline')}</span>
            </div>
          </div>
          {navigation()}
          <div className="sidebar-footer">
            <span>{t('app.localOnly')}</span>
            <button className="sidebar-lock" type="button" onClick={onLock}>
              <Icon name="lock" size={17} />
              {t('nav.lock')}
            </button>
          </div>
        </aside>
        <header className="topbar">
          <div className="topbar-main">
            <button
              ref={menuButtonRef}
              className="menu-button"
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('app.openMenu')}
              aria-expanded={drawerOpen}
            >
              <Icon name="menu" size={21} />
            </button>
            <div className="search-wrap">
              <Icon name="search" size={19} />
              <GlobalSearch />
            </div>
          </div>
          <div className="topbar-actions">
            <div className="create-menu-wrap">
              <button
                ref={createButtonRef}
                className="create-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded={createOpen}
                onClick={() => setCreateOpen((current) => !current)}
              >
                <Icon name="plus" size={18} />
                <span>{t('app.add')}</span>
                <Icon name="chevron-down" size={15} />
              </button>
              {createOpen && (
                <div
                  ref={createMenuRef}
                  className="create-menu"
                  role="menu"
                  aria-label={t('app.add')}
                  onKeyDown={(event) => {
                    const items = Array.from(
                      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
                    );
                    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      const offset = event.key === 'ArrowDown' ? 1 : -1;
                      items[(currentIndex + offset + items.length) % items.length]?.focus();
                    }
                    if (event.key === 'Home') {
                      event.preventDefault();
                      items[0]?.focus();
                    }
                    if (event.key === 'End') {
                      event.preventDefault();
                      items.at(-1)?.focus();
                    }
                  }}
                >
                  <Link to="/clients/new" role="menuitem" onClick={() => setCreateOpen(false)}>
                    <Icon name="clients" size={18} />
                    {t('dashboard.addClient')}
                  </Link>
                  <Link to="/cases/new" role="menuitem" onClick={() => setCreateOpen(false)}>
                    <Icon name="cases" size={18} />
                    {t('dashboard.addCase')}
                  </Link>
                  <Link to="/calendar" role="menuitem" onClick={() => setCreateOpen(false)}>
                    <Icon name="calendar" size={18} />
                    {t('app.addHearing')}
                  </Link>
                  <Link to="/tasks" role="menuitem" onClick={() => setCreateOpen(false)}>
                    <Icon name="tasks" size={18} />
                    {t('app.addTask')}
                  </Link>
                </div>
              )}
            </div>
            <LanguageSwitcher />
            <button
              className="lock-button icon-button"
              onClick={onLock}
              aria-label={t('app.lockButton')}
            >
              <Icon name="lock" size={17} />
            </button>
          </div>
        </header>
        <main className="workspace">
          <AppRoutes />
        </main>
        {drawerOpen && (
          <div
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('app.workspaceKicker')}
          >
            <button
              className="drawer-backdrop"
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                menuButtonRef.current?.focus();
              }}
              aria-label={t('app.closeMenu')}
            />
            <aside
              className="drawer-panel"
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
                  ),
                );
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <div className="drawer-header">
                <strong>{t('app.brandName')}</strong>
                <button
                  ref={drawerCloseRef}
                  className="drawer-close"
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  aria-label={t('app.closeMenu')}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              {navigation(() => setDrawerOpen(false))}
              <div className="sidebar-footer">
                <span>{t('app.localOnly')}</span>
                <button
                  className="sidebar-lock"
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    menuButtonRef.current?.focus();
                    onLock();
                  }}
                >
                  <Icon name="lock" size={17} />
                  {t('nav.lock')}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
