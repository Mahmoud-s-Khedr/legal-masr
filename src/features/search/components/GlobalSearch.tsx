import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '../api/searchApi';
import type { SearchEntityType, SearchHit } from '../../../bridge/types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const entityTypes: SearchEntityType[] = ['CLIENT', 'CASE', 'POWER_OF_ATTORNEY'];

function recordPath(entityType: SearchEntityType, entityId: string) {
  if (entityType === 'CLIENT') return `/clients/${entityId}`;
  if (entityType === 'CASE') return `/cases/${entityId}`;
  return `/powers-of-attorney/${entityId}`;
}

export function GlobalSearch({
  query,
  onQueryChange,
  palette = false,
  onNavigate: afterNavigate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  palette?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resultsId = useId();
  const [debounced, setDebounced] = useState(query);
  const [open, setOpen] = useState(palette);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const { data: hits = [] } = useGlobalSearch(debounced);
  const grouped = Object.fromEntries(
    entityTypes.map((type) => [type, hits.filter((hit) => hit.entityType === type)]),
  ) as Record<SearchEntityType, SearchHit[]>;

  const goTo = (hit: SearchHit) => {
    setOpen(false);
    onQueryChange('');
    afterNavigate?.();
    navigate(recordPath(hit.entityType, hit.entityId));
  };
  const selectableHits = entityTypes.flatMap((entityType) => grouped[entityType]);

  return (
    <section className={palette ? 'global-search global-search-palette' : 'global-search'}>
      <Input
        autoFocus={palette}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={resultsId}
        aria-expanded={(palette || open) && Boolean(debounced)}
        aria-activedescendant={activeIndex >= 0 ? `${resultsId}-option-${activeIndex}` : undefined}
        aria-label={t('app.searchLabel')}
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !palette && setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
            afterNavigate?.();
            return;
          }
          if (!selectableHits.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(
              (index) => (index + direction + selectableHits.length) % selectableHits.length,
            );
          }
          if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            goTo(selectableHits[activeIndex]);
          }
        }}
      />
      {(palette || open) && debounced && (
        <div id={resultsId} className="global-search-results" role="listbox">
          {!hits.length ? (
            <p>{t('search.noResults')}</p>
          ) : (
            entityTypes.map((entityType) =>
              grouped[entityType].length ? (
                <section key={entityType}>
                  <p className="kicker">{t(`search.groups.${entityType.toLowerCase()}`)}</p>
                  <ul>
                    {grouped[entityType].map((hit) => {
                      const hitIndex = selectableHits.indexOf(hit);
                      return (
                        <li key={hit.entityId}>
                          <Button
                            id={`${resultsId}-option-${hitIndex}`}
                            type="button"
                            role="option"
                            aria-selected={activeIndex === hitIndex}
                            variant="ghost"
                            className={activeIndex === hitIndex ? 'active' : undefined}
                            onMouseEnter={() => setActiveIndex(hitIndex)}
                            onClick={() => goTo(hit)}
                          >
                            <bdi>{hit.title}</bdi>
                            {hit.subtitle && (
                              <span className="muted">
                                {' '}
                                — <bdi>{hit.subtitle}</bdi>
                              </span>
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null,
            )
          )}
        </div>
      )}
    </section>
  );
}
