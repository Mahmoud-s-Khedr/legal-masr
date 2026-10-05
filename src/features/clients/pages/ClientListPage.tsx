import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { Table } from '../../../components/ui/table';
import { useClientList } from '../api/clientsApi';

export function ClientListPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const {
    data: clients,
    isLoading,
    isError,
  } = useClientList({
    query: query || undefined,
    includeArchived,
  });

  return (
    <section className="entity-list">
      <PageHeader
        kicker={t('clients.kicker')}
        title={t('clients.title')}
        description={t('clients.description')}
        actions={<Button onClick={() => navigate('/clients/new')}>{t('clients.newButton')}</Button>}
      />

      <div className="entity-list-toolbar">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('clients.searchPlaceholder')}
          aria-label={t('clients.searchPlaceholder')}
        />
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          {t('clients.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="table-message h-24" aria-label={t('clients.loading')} />
      ) : isError ? (
        <p className="error" role="alert">
          {t('app.loadError')}
        </p>
      ) : !clients?.length ? (
        <Card className="empty-state-card">
          <strong>{query ? t('clients.noResults') : t('clients.empty')}</strong>
          <span>{query ? t('clients.noResultsHint') : t('clients.emptyHint')}</span>
          {!query && (
            <Button onClick={() => navigate('/clients/new')}>{t('clients.newButton')}</Button>
          )}
        </Card>
      ) : (
        <div className="data-table-scroll">
          <Table className="data-table">
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
                    <Link to={`/clients/${client.id}`} dir="auto">
                      <bdi>{client.fullName}</bdi>
                    </Link>
                  </th>
                  <td className="mono">
                    <bdi>{client.internalNumber}</bdi>
                  </td>
                  <td className="mono">
                    {client.primaryPhone ? (
                      <bdi>{client.primaryPhone}</bdi>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${client.archivedAt ? 'tone-muted' : 'tone-active'}`}
                    >
                      {client.archivedAt ? t('clients.archivedBadge') : t('clients.active')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}
