import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useClientList } from '../api/clientsApi';

export function ClientListPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const { data: clients, isLoading } = useClientList({
    query: query || undefined,
    includeArchived,
  });

  return (
    <section className="entity-list">
      <div className="entity-list-header">
        <h2>{t('clients.title')}</h2>
        <button onClick={() => navigate('/clients/new')}>{t('clients.newButton')}</button>
      </div>

      <div className="entity-list-toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('clients.searchPlaceholder')}
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          {t('clients.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <p className="table-message">{t('clients.loading')}</p>
      ) : !clients?.length ? (
        <p className="table-message">{t('clients.empty')}</p>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
            <caption>{t('clients.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('clients.columns.name')}</th>
                <th scope="col">{t('clients.columns.type')}</th>
                <th scope="col">{t('clients.columns.phone')}</th>
                <th scope="col">{t('clients.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <th scope="row">
                    <Link to={`/clients/${client.id}`}>{client.displayName}</Link>
                  </th>
                  <td>
                    {t(
                      `clients.fields.${client.clientType === 'INDIVIDUAL' ? 'individual' : 'organization'}`,
                    )}
                  </td>
                  <td dir="ltr">{client.primaryPhone ?? '—'}</td>
                  <td>
                    {client.archivedAt ? (
                      <span className="badge">{t('clients.archivedBadge')}</span>
                    ) : (
                      <span className="status-dot">{t('clients.active')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
