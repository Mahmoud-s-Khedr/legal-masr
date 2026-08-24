import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '../api/searchApi';
import type { SearchEntityType } from '../../../bridge/types';

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: hits } = useGlobalSearch(debounced);
  const entityTypes: SearchEntityType[] = ['CLIENT', 'CASE', 'POWER_OF_ATTORNEY'];
  const grouped = Object.fromEntries(
    entityTypes.map((type) => [type, (hits ?? []).filter((hit) => hit.entityType === type)]),
  ) as Record<
    (typeof entityTypes)[number],
    typeof hits extends undefined ? never[] : NonNullable<typeof hits>
  >;

  const goTo = (entityType: string, entityId: string) => {
    setOpen(false);
    setInput('');
    navigate(
      entityType === 'CLIENT'
        ? `/clients/${entityId}`
        : entityType === 'CASE'
          ? `/cases/${entityId}`
          : `/powers-of-attorney/${entityId}`,
    );
  };
  const selectableHits = entityTypes.flatMap((entityType) => grouped[entityType]);
  const resultsId = 'global-search-results';

  return (
    <div className="global-search">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-controls={resultsId}
        aria-expanded={open && Boolean(debounced)}
        aria-activedescendant={activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined}
        aria-label={t('app.searchLabel')}
        placeholder={t('search.placeholder')}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!selectableHits.length) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => (index + 1) % selectableHits.length);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => (index - 1 + selectableHits.length) % selectableHits.length);
          }
          if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            const hit = selectableHits[activeIndex];
            goTo(hit.entityType, hit.entityId);
          }
          if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
      />
      {open && debounced && (
        <div id={resultsId} className="global-search-results" role="listbox">
          {!hits?.length ? (
            <p>{t('search.noResults')}</p>
          ) : (
            <>
              {entityTypes.map((entityType) =>
                grouped[entityType].length ? (
                  <div key={entityType}>
                    <p className="kicker">{t(`search.groups.${entityType.toLowerCase()}`)}</p>
                    <ul>
                      {grouped[entityType].map((hit) => {
                        const hitIndex = selectableHits.indexOf(hit);
                        return (
                          <li key={hit.entityId}>
                            <button
                              id={`global-search-option-${hitIndex}`}
                              type="button"
                              role="option"
                              aria-selected={activeIndex === hitIndex}
                              className={activeIndex === hitIndex ? 'active' : undefined}
                              onMouseEnter={() => setActiveIndex(hitIndex)}
                              onClick={() => goTo(hit.entityType, hit.entityId)}
                            >
                              <bdi>{hit.title}</bdi>
                              {hit.subtitle && (
                                <span className="muted">
                                  {' '}
                                  — <bdi>{hit.subtitle}</bdi>
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null,
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
