import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';

import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { RecordTable } from '@/components/forms/RecordTable';

import { usePowerOfAttorneyList } from '../api/powersOfAttorneyApi';

export function PowersOfAttorneyPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const powers = usePowerOfAttorneyList({ query: query || undefined, includeArchived });
  const navigate = useNavigate();
  return (
    <section className="entity-list">
      <PageHeader
        kicker={t('poa.listKicker')}
        title={t('poa.title')}
        description={t('poa.description')}
        actions={
          <Button type="button" onClick={() => navigate('/powers-of-attorney/new')}>
            {t('poa.add')}
          </Button>
        }
      />
      <div className="entity-list-toolbar">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('poa.searchPlaceholder')}
          aria-label={t('poa.searchPlaceholder')}
        />
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          {t('poa.showArchived')}
        </label>
      </div>
      {powers.isLoading ? (
        <Skeleton className="table-message h-24" aria-label={t('poa.loading')} />
      ) : powers.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('poa.loadError')}</AlertDescription>
        </Alert>
      ) : !powers.data?.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{query ? t('poa.noResults') : t('poa.empty')}</EmptyTitle>
            <EmptyDescription>
              {query ? t('poa.noResultsHint') : t('poa.emptyHint')}
            </EmptyDescription>
            {!query && (
              <Button type="button" onClick={() => navigate('/powers-of-attorney/new')}>
                {t('poa.add')}
              </Button>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="data-table-scroll">
          <RecordTable className="data-table">
            <caption>{t('poa.title')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('poa.fields.internalSequence')}</th>
                <th scope="col">{t('poa.fields.officialNumber')}</th>
                <th scope="col">{t('poa.tabs.clients')}</th>
                <th scope="col">{t('clients.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {powers.data.map((power) => (
                <tr
                  key={power.id}
                  className="clickable-row"
                  onClick={() => navigate(`/powers-of-attorney/${power.id}`)}
                >
                  <th scope="row">
                    <Link to={`/powers-of-attorney/${power.id}`}>
                      <bdi>{power.internalSequence}</bdi>
                    </Link>
                  </th>
                  <td className="mono">
                    {power.officialNumber ? <bdi>{power.officialNumber}</bdi> : '—'}
                  </td>
                  <td className="cell-wrap">{power.clientNames.join('، ') || '—'}</td>
                  <td>
                    <Badge variant="secondary">
                      {power.archivedAt ? t('records.archived') : t('clients.active')}
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
