import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { Table } from '../../../components/ui/table';
import { useCaseList } from '../api/casesApi';
import { PageHeader } from '../../../components/layout/PageHeader';
import { CASE_STATUSES } from '../schemas/case.schema';
import { CaseStatusBadge, OfficialReference } from '../components/CaseIdentity';

export function CaseListPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const {
    data: cases,
    isLoading,
    isError,
  } = useCaseList({
    query: query || undefined,
    status: status ? (status as Parameters<typeof useCaseList>[0]['status']) : undefined,
    includeArchived,
  });

  const filtered = Boolean(query || status);
  return (
    <section className="entity-list">
      <PageHeader
        kicker={t('cases.kicker')}
        title={t('cases.title')}
        description={t('cases.description')}
        actions={<Button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</Button>}
      />

      <div className="entity-list-toolbar">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('cases.searchPlaceholder')}
          aria-label={t('cases.searchPlaceholder')}
        />
        <Select
          className="toolbar-select"
          value={status}
          onValueChange={setStatus}
          aria-label={t('cases.statusFilter')}
          placeholder={t('cases.allStatuses')}
          items={[
            { value: '', label: t('cases.allStatuses') },
            ...CASE_STATUSES.map((value) => ({ value, label: t(`cases.status.${value}`) })),
          ]}
        />
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          {t('cases.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="table-message h-24" aria-label={t('cases.loading')} />
      ) : isError ? (
        <p className="error" role="alert">
          {t('app.loadError')}
        </p>
      ) : !cases?.length ? (
        <Card className="empty-state-card">
          <strong>{filtered ? t('cases.noResults') : t('cases.empty')}</strong>
          <span>{filtered ? t('cases.noResultsHint') : t('cases.emptyHint')}</span>
          {!filtered && (
            <Button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</Button>
          )}
        </Card>
      ) : (
        <div className="data-table-scroll">
          <Table className="data-table">
            <caption>{t('cases.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('cases.columns.number')}</th>
                <th scope="col">{t('cases.columns.official')}</th>
                <th scope="col">{t('cases.columns.client')}</th>
                <th scope="col">{t('cases.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((caseSummary) => (
                <tr key={caseSummary.id}>
                  <th scope="row">
                    <Link to={`/cases/${caseSummary.id}`}>
                      <bdi>{caseSummary.internalNumber}</bdi>
                    </Link>
                  </th>
                  <td>
                    {caseSummary.officialNumber ? (
                      <OfficialReference
                        number={caseSummary.officialNumber}
                        year={caseSummary.officialYear}
                      />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td className="cell-wrap">{caseSummary.clientNames.join('، ') || '—'}</td>
                  <td>
                    <CaseStatusBadge
                      status={caseSummary.status}
                      archived={Boolean(caseSummary.archivedAt)}
                    />
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
