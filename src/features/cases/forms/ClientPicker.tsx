import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ClientSummary } from '../../../bridge/types';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';

const SEARCH_THRESHOLD = 6;

/** Multi-select of clients that stays usable with hundreds of records. */
export function ClientPicker({
  clients,
  value,
  onChange,
  error,
}: {
  clients: ClientSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter(
      (client) =>
        value.includes(client.id) ||
        client.fullName.toLowerCase().includes(needle) ||
        client.internalNumber.toLowerCase().includes(needle) ||
        (client.primaryPhone ?? '').includes(needle),
    );
  }, [clients, query, value]);
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));

  if (!clients.length)
    return (
      <div className="client-picker-empty">
        <strong>{t('cases.form.noClientsTitle')}</strong>
        <span>{t('cases.form.noClientsHint')}</span>
        <Link className="button-link secondary-link" to="/clients/new">
          {t('clients.newButton')}
        </Link>
      </div>
    );

  return (
    <div className={`client-picker${error ? ' has-error' : ''}`}>
      {clients.length > SEARCH_THRESHOLD && (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('cases.form.clientSearch')}
          aria-label={t('cases.form.clientSearch')}
        />
      )}
      <ul className="client-picker-list">
        {visible.map((client) => {
          const checked = value.includes(client.id);
          return (
            <li key={client.id} className={checked ? 'selected' : undefined}>
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => toggle(client.id, next)}
                aria-label={client.fullName}
              />
              <button
                type="button"
                className="client-picker-name"
                tabIndex={-1}
                onClick={() => toggle(client.id, !checked)}
              >
                <bdi>{client.fullName}</bdi>
                <span className="mono" dir="ltr">
                  {client.internalNumber}
                </span>
              </button>
            </li>
          );
        })}
        {!visible.length && <li className="client-picker-none">{t('clients.noResults')}</li>}
      </ul>
      <div className="client-picker-footer">
        <span>{t('cases.form.selectedClients', { count: value.length })}</span>
        <Link to="/clients/new" className="text-link">
          {t('cases.form.addClientLink')}
        </Link>
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
