import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, NavLink } from 'react-router-dom';
import { AppRoutes, NAV_GROUPS } from '../../app/router';
import { GlobalSearch } from '../../features/search/components/GlobalSearch';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTitle, SheetClose } from '../ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useSettings } from '../../features/settings/api/settingsApi';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Icon } from './Icon';
import { DeveloperContacts } from './DeveloperContacts';
import { shouldLockForLifecycleGap } from '../../lib/lifecycleLock';

export function Shell({ onLock }: { onLock: () => Promise<void> | void }) {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const lockTimeoutMinutes = settings?.lockTimeoutMinutes ?? 30;
  const onLockRef = useRef(onLock);
  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!lockTimeoutMinutes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lifecycleCheckAt = Date.now();
    let lockingForLifecycleGap = false;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void onLockRef.current(), lockTimeoutMinutes * 60_000);
    };
    const detectLifecycleGap = () => {
      const now = Date.now();
      const shouldLock = shouldLockForLifecycleGap(lifecycleCheckAt, now);
      lifecycleCheckAt = now;
      if (!shouldLock || lockingForLifecycleGap) return;
      lockingForLifecycleGap = true;
      void Promise.resolve(onLockRef.current()).finally(() => {
        lockingForLifecycleGap = false;
      });
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('wheel', reset, { passive: true });
    window.addEventListener('scroll', reset, { passive: true, capture: true });
    const lifecycleInterval = window.setInterval(detectLifecycleGap, 1_000);
    return () => {
      clearTimeout(timer);
      window.clearInterval(lifecycleInterval);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('wheel', reset);
      window.removeEventListener('scroll', reset, true);
    };
  }, [lockTimeoutMinutes]);

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
      {NAV_GROUPS.map((group) => (
        <div className="nav-group" key={group.key}>
          <p className="sidebar-section-label">{t(group.key)}</p>
          {group.items.map(({ to, key, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}>
              <Icon name={icon} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </div>
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
            <Button className="sidebar-lock" type="button" variant="ghost" onClick={onLock}>
              <Icon name="lock" size={17} />
              {t('nav.lock')}
            </Button>
          </div>
        </aside>
        <header className="topbar">
          <div className="topbar-main">
            <Button
              variant="ghost"
              onClick={() => setDrawerOpen(true)}
              className="menu-button min-[981px]:hidden"
              aria-label={t('app.openMenu')}
            >
              <Icon name="menu" size={21} />
            </Button>
            <div className="search-wrap">
              <Icon name="search" size={19} />
              <GlobalSearch query={searchQuery} onQueryChange={setSearchQuery} />
              <kbd className="search-shortcut" aria-hidden="true">
                Ctrl K
              </kbd>
            </div>
            <Button
              variant="ghost"
              onClick={() => setSearchPaletteOpen(true)}
              className="search-palette-trigger icon-button min-[761px]:hidden"
              aria-label={t('search.openPalette')}
            >
              <Icon name="search" size={18} />
            </Button>
          </div>
          <div className="topbar-actions">
            <DropdownMenu>
              <DropdownMenuTrigger className="create-button">
                <Icon name="plus" size={18} />
                <span>{t('app.add')}</span>
                <Icon name="chevron-down" size={16} />
              </DropdownMenuTrigger>

              <DropdownMenuContent className="create-menu" aria-label={t('app.add')}>
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link to="/clients/new" />}>
                    <Icon name="clients" size={18} />
                    {t('dashboard.addClient')}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/cases/new" />}>
                    <Icon name="cases" size={18} />
                    {t('dashboard.addCase')}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/calendar?create=hearing" />}>
                    <Icon name="calendar" size={18} />
                    {t('app.addHearing')}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/tasks?create=task" />}>
                    <Icon name="tasks" size={18} />
                    {t('app.addTask')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <LanguageSwitcher className="topbar-language" />
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
        <footer className="app-footer no-print">
          <Link to="/settings?tab=about">{t('settings.tabs.about')}</Link>
          <DeveloperContacts />
        </footer>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent
            showCloseButton={false}
            className="drawer-panel"
            aria-label={t('app.workspaceKicker')}
          >
            <div className="drawer-header">
              <SheetTitle>{t('app.brandName')}</SheetTitle>
              <SheetClose className="drawer-close" aria-label={t('app.closeMenu')}>
                <Icon name="close" size={20} />
              </SheetClose>
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
          </SheetContent>
        </Sheet>
        <Dialog open={searchPaletteOpen} onOpenChange={setSearchPaletteOpen}>
          <DialogContent
            showCloseButton={false}
            className="command-palette"
            aria-label={t('search.paletteTitle')}
          >
            <DialogTitle>{t('search.paletteTitle')}</DialogTitle>
            <GlobalSearch
              palette
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onNavigate={() => setSearchPaletteOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </BrowserRouter>
  );
}
