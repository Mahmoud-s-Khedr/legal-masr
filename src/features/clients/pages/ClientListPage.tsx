import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';

import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { RecordTable } from '@/components/forms/RecordTable';
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
        <Alert variant="destructive">
          <AlertDescription>{t('app.loadError')}</AlertDescription>
        </Alert>
      ) : !clients?.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{query ? t('clients.noResults') : t('clients.empty')}</EmptyTitle>
            <EmptyDescription>
              {query ? t('clients.noResultsHint') : t('clients.emptyHint')}
            </EmptyDescription>
            {!query && (
              <Button onClick={() => navigate('/clients/new')}>{t('clients.newButton')}</Button>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="data-table-scroll">
          <RecordTable className="data-table">
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
                    <Badge variant="secondary">
                      {client.archivedAt ? t('clients.archivedBadge') : t('clients.active')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </RecordTable>
        </div>
      )}
    </section>
  );
}
