import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';

import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';

import { Skeleton } from '../../../components/ui/skeleton';
import { RecordTable } from '@/components/forms/RecordTable';
import { useCaseList } from '../api/casesApi';
import { PageHeader } from '../../../components/layout/PageHeader';
import { CASE_STATUSES } from '../schemas/case.schema';
import { CaseStatusBadge, OfficialReference } from '../components/CaseIdentity';
import { useFormat } from '../../../i18n/LocalePresentation';
import { localDateOnly } from '../../../lib/dateOnly';

export function CaseListPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const format = useFormat();
  const today = localDateOnly();
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
          value={status}
          onValueChange={(value) => setStatus(value ?? '')}
          items={[
            { value: '', label: t('cases.allStatuses') },
            ...CASE_STATUSES.map((value) => ({ value, label: t(`cases.status.${value}`) })),
          ]}
        >
          <SelectTrigger aria-label={t('cases.statusFilter')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[
                { value: '', label: t('cases.allStatuses') },
                ...CASE_STATUSES.map((value) => ({ value, label: t(`cases.status.${value}`) })),
              ].map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          {t('cases.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="table-message h-24" aria-label={t('cases.loading')} />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('app.loadError')}</AlertDescription>
        </Alert>
      ) : !cases?.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{filtered ? t('cases.noResults') : t('cases.empty')}</EmptyTitle>
            <EmptyDescription>
              {filtered ? t('cases.noResultsHint') : t('cases.emptyHint')}
            </EmptyDescription>
            {!filtered && (
              <Button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</Button>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="data-table-scroll">
          <RecordTable className="data-table">
            <caption>{t('cases.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('cases.columns.number')}</th>
                <th scope="col">{t('cases.columns.official')}</th>
                <th scope="col">{t('cases.columns.client')}</th>
                <th scope="col">{t('cases.columns.court')}</th>
                <th scope="col">{t('cases.columns.nextHearing')}</th>
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
                        judicialYear={caseSummary.judicialYear}
                      />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td className="cell-wrap">{format.list(caseSummary.clientNames) || '—'}</td>
                  <td className="cell-wrap cell-narrow">
                    {caseSummary.courtName ? (
                      <bdi dir="auto">{caseSummary.courtName}</bdi>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    {caseSummary.nextHearingDate ? (
                      <span
                        className={
                          caseSummary.nextHearingDate < today ? 'pending-decision' : undefined
                        }
                      >
                        <bdi>{format.date(caseSummary.nextHearingDate)}</bdi>
                        {caseSummary.nextHearingDate < today && (
                          <small>{t('cases.pendingDecision')}</small>
                        )}
                      </span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <CaseStatusBadge
                      status={caseSummary.status}
                      archived={Boolean(caseSummary.archivedAt)}
                    />
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
