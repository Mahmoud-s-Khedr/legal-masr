import { useState } from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useDebounced } from '@/lib/useDebounced';
import { useGlobalSearch } from '../api/searchApi';
import type { SearchHit } from '@/bridge/types';
export function GlobalSearch({
  query,
  onQueryChange,
  palette = false,
  onNavigate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  palette?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(!!query);
  const debounced = useDebounced(query);
  const search = useGlobalSearch(debounced);
  const hits = debounced === query ? (search.data ?? []) : [];
  const go = (hit: SearchHit) => {
    setOpen(false);
    onQueryChange('');
    onNavigate?.();
    navigate(
      `/${hit.entityType === 'CLIENT' ? 'clients' : hit.entityType === 'CASE' ? 'cases' : 'powers-of-attorney'}/${hit.entityId}`,
    );
  };
  return (
    <section className={palette ? 'global-search global-search-palette' : 'global-search'}>
      <Autocomplete.Root
        items={hits}
        value={query}
        open={open && !!query && debounced === query}
        onOpenChange={(next, details) => {
          setOpen(next);
          if (details.reason === 'escape-key') onNavigate?.();
        }}
        onValueChange={(next, details) => {
          if (details.reason === 'item-press') {
            const hit = hits.find((h) => h.title === next);
            if (hit) go(hit);
          } else {
            onQueryChange(next);
            setOpen(true);
          }
        }}
        itemToStringValue={(hit) => hit.title}
        filter={null}
      >
        <Autocomplete.Input
          render={<Input />}
          autoFocus={palette}
          aria-label={t('app.searchLabel')}
          placeholder={t('search.placeholder')}
        />
        <Autocomplete.Portal>
          <Autocomplete.Positioner sideOffset={6} className="isolate z-50">
            <Autocomplete.Popup className="max-h-80 w-(--anchor-width) overflow-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg">
              <Autocomplete.Empty>{t('search.noResults')}</Autocomplete.Empty>
              <Autocomplete.List>
                {(hit: SearchHit) => (
                  <Autocomplete.Item
                    key={`${hit.entityType}-${hit.entityId}`}
                    value={hit}
                    className="cursor-default rounded-md p-2 outline-none data-highlighted:bg-accent"
                  >
                    <span className="text-xs text-muted-foreground">
                      {t(`search.groups.${hit.entityType.toLowerCase()}`)}
                    </span>
                    <bdi>{hit.title}</bdi>
                    {hit.subtitle && (
                      <span>
                        {' '}
                        — <bdi>{hit.subtitle}</bdi>
                      </span>
                    )}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </section>
  );
}
