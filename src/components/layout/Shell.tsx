import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink } from 'react-router-dom';
import { AppRoutes, NAV_ITEMS } from '../../app/router';
import { GlobalSearch } from '../../features/search/components/GlobalSearch';
import { DropdownMenu } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { useSettings } from '../../features/settings/api/settingsApi';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Icon } from './Icon';

export function Shell({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const lockTimeoutMinutes = settings?.lockTimeoutMinutes;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    const lockOnResume = () => {
      if (document.visibilityState === 'visible') void onLock();
    };
    document.addEventListener('visibilitychange', lockOnResume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
      document.removeEventListener('visibilitychange', lockOnResume);
    };
  }, [lockTimeoutMinutes, onLock]);

  useEffect(() => {
    const openSearchPalette = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', openSearchPalette);
    return () => window.removeEventListener('keydown', openSearchPalette);
  }, []);

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
      <Sheet.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Sheet.Root open={searchPaletteOpen} onOpenChange={setSearchPaletteOpen}>
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
                <Button className="sidebar-lock" type="button" variant="ghost" onClick={onLock}>
                  <Icon name="lock" size={17} />
                  {t('nav.lock')}
                </Button>
              </div>
            </aside>
            <header className="topbar">
              <div className="topbar-main">
                <Sheet.Trigger className="menu-button" aria-label={t('app.openMenu')}>
                  <Icon name="menu" size={21} />
                </Sheet.Trigger>
                <div className="search-wrap">
                  <Icon name="search" size={19} />
                  <GlobalSearch query={searchQuery} onQueryChange={setSearchQuery} />
                </div>
                <Sheet.Trigger
                  className="search-palette-trigger icon-button"
                  aria-label={t('search.openPalette')}
                >
                  <Icon name="search" size={18} />
                </Sheet.Trigger>
              </div>
              <div className="topbar-actions">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger className="create-button">
                    <Icon name="plus" size={18} />
                    <span>{t('app.add')}</span>
                    <Icon name="chevron-down" size={15} />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Positioner side="bottom" align="end" sideOffset={8}>
                      <DropdownMenu.Popup className="create-menu" aria-label={t('app.add')}>
                        <DropdownMenu.LinkItem render={<Link to="/clients/new" />} closeOnClick>
                          <Icon name="clients" size={18} />
                          {t('dashboard.addClient')}
                        </DropdownMenu.LinkItem>
                        <DropdownMenu.LinkItem render={<Link to="/cases/new" />} closeOnClick>
                          <Icon name="cases" size={18} />
                          {t('dashboard.addCase')}
                        </DropdownMenu.LinkItem>
                        <DropdownMenu.LinkItem render={<Link to="/calendar" />} closeOnClick>
                          <Icon name="calendar" size={18} />
                          {t('app.addHearing')}
                        </DropdownMenu.LinkItem>
                        <DropdownMenu.LinkItem render={<Link to="/tasks" />} closeOnClick>
                          <Icon name="tasks" size={18} />
                          {t('app.addTask')}
                        </DropdownMenu.LinkItem>
                      </DropdownMenu.Popup>
                    </DropdownMenu.Positioner>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <LanguageSwitcher />
                <Button
                  className="lock-button icon-button"
                  variant="ghost"
                  type="button"
                  onClick={onLock}
                  aria-label={t('app.lockButton')}
                >
                  <Icon name="lock" size={17} />
                </Button>
              </div>
            </header>
            <main className="workspace">
              <AppRoutes />
            </main>
            <Sheet.Portal>
              <Sheet.Backdrop className="drawer-backdrop" />
              <Sheet.Viewport className="mobile-drawer">
                <Sheet.Popup className="drawer-panel" aria-label={t('app.workspaceKicker')}>
                  <div className="drawer-header">
                    <Sheet.Title>{t('app.brandName')}</Sheet.Title>
                    <Sheet.Close className="drawer-close" aria-label={t('app.closeMenu')}>
                      <Icon name="close" size={20} />
                    </Sheet.Close>
                  </div>
                  {navigation(() => setDrawerOpen(false))}
                  <div className="sidebar-footer">
                    <span>{t('app.localOnly')}</span>
                    <Button
                      className="sidebar-lock"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDrawerOpen(false);
                        onLock();
                      }}
                    >
                      <Icon name="lock" size={17} />
                      {t('nav.lock')}
                    </Button>
                  </div>
                </Sheet.Popup>
              </Sheet.Viewport>
            </Sheet.Portal>
            <Sheet.Portal>
              <Sheet.Backdrop className="dialog-backdrop" />
              <Sheet.Viewport className="dialog-viewport">
                <Sheet.Popup className="command-palette" aria-label={t('search.paletteTitle')}>
                  <Sheet.Title>{t('search.paletteTitle')}</Sheet.Title>
                  <GlobalSearch
                    palette
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    onNavigate={() => setSearchPaletteOpen(false)}
                  />
                </Sheet.Popup>
              </Sheet.Viewport>
            </Sheet.Portal>
          </div>
        </Sheet.Root>
      </Sheet.Root>
    </BrowserRouter>
  );
}
