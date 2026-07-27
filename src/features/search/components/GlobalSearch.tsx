import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useGlobalSearch } from "../api/searchApi";

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: hits } = useGlobalSearch(debounced);
  const entityTypes = ["client", "case", "event", "task", "document"] as const;
  const grouped = Object.fromEntries(entityTypes.map((type) => [type, (hits ?? []).filter((hit) => hit.entityType === type)])) as Record<(typeof entityTypes)[number], typeof hits extends undefined ? never[] : NonNullable<typeof hits>>;

  const goTo = (entityType: string, entityId: string) => {
    setOpen(false);
    setInput("");
    navigate(entityType === "client" ? `/clients/${entityId}` : entityType === "case" ? `/cases/${entityId}` : entityType === "event" ? `/calendar?event=${entityId}` : entityType === "task" ? `/tasks?task=${entityId}` : `/documents?document=${entityId}`);
  };

  return (
    <div className="global-search">
      <input
        aria-label={t("app.searchLabel")}
        placeholder={t("search.placeholder")}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && debounced && (
        <div className="global-search-results">
          {!hits?.length ? (
            <p>{t("search.noResults")}</p>
          ) : (
            <>
              {entityTypes.map((entityType) =>
                grouped[entityType].length ? (
                  <div key={entityType}>
                    <p className="kicker">{t(`search.groups.${entityType}`)}</p>
                    <ul>
                      {grouped[entityType].map((hit) => (
                        <li key={hit.entityId}>
                          <button type="button" onClick={() => goTo(hit.entityType, hit.entityId)}>
                            {hit.title}
                            {hit.subtitle && <span className="muted"> — {hit.subtitle}</span>}
                          </button>
                        </li>
                      ))}
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
