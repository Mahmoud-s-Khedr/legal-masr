import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog } from '../../../components/ui/Dialog';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { Table } from '../../../components/ui/table';
import { PowerOfAttorneyForm } from '../components/PowerOfAttorneyForm';
import { usePowerOfAttorneyList, useSavePowerOfAttorney } from '../api/powersOfAttorneyApi';

export function PowersOfAttorneyPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const powers = usePowerOfAttorneyList({ query: query || undefined, includeArchived });
  const save = useSavePowerOfAttorney();
  const navigate = useNavigate();
  return (
    <section className="entity-list">
      <PageHeader
        kicker={t('poa.listKicker')}
        title={t('poa.title')}
        description={t('poa.description')}
        actions={
          <Button type="button" onClick={() => setAdding(true)}>
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
        <p className="error" role="alert">
          {t('poa.loadError')}
        </p>
      ) : !powers.data?.length ? (
        <Card className="empty-state-card">
          <strong>{query ? t('poa.noResults') : t('poa.empty')}</strong>
          <span>{query ? t('poa.noResultsHint') : t('poa.emptyHint')}</span>
          {!query && (
            <Button type="button" onClick={() => setAdding(true)}>
              {t('poa.add')}
            </Button>
          )}
        </Card>
      ) : (
        <div className="data-table-scroll">
          <Table className="data-table">
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
                    <span
                      className={`status-badge ${power.archivedAt ? 'tone-muted' : 'tone-active'}`}
                    >
                      {power.archivedAt ? t('records.archived') : t('clients.active')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <Dialog open={adding} onOpenChange={setAdding} title={t('poa.add')}>
        <PowerOfAttorneyForm
          busy={save.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const power = await save.mutateAsync(input);
            setAdding(false);
            navigate(`/powers-of-attorney/${power.id}`);
          }}
        />
        {save.isError && (
          <p className="error" role="alert">
            {t('poa.saveError')}
          </p>
        )}
      </Dialog>
    </section>
  );
}
