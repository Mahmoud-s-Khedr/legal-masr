import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Select } from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { Table } from '../../../components/ui/table';
import { useCaseList } from '../api/casesApi';

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

  return (
    <section className="entity-list">
      <div className="entity-list-header">
        <div>
          <p className="kicker">ملفات العمل</p>
          <h2>{t('cases.title')}</h2>
          <p className="page-description">كل قضية مع موكليها وجلساتها ومهامها وحركتها المالية.</p>
        </div>
        <Button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</Button>
      </div>

      <div className="entity-list-toolbar">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث برقم القضية أو المحكمة أو الموكل"
        />
        <Select
          value={status}
          onValueChange={setStatus}
          aria-label="تصفية حسب الحالة"
          items={[
            { value: '', label: 'كل الحالات' },
            ...[
              'DRAFT',
              'ACTIVE',
              'SUSPENDED',
              'JUDGMENT_ISSUED',
              'APPEALED',
              'ENFORCEMENT',
              'CLOSED',
            ].map((value) => ({ value, label: t(`cases.status.${value}`) })),
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
        <p role="alert">تعذر تحميل السجلات. حاول مرة أخرى.</p>
      ) : !cases?.length ? (
        <Card className="empty-state-card">
          <strong>{query || status ? 'لا توجد قضايا مطابقة' : t('cases.empty')}</strong>
          <span>
            {query || status
              ? 'غيّر كلمات البحث أو حالة القضية.'
              : 'أنشئ أول قضية واربطها بموكل واحد على الأقل.'}
          </span>
          {!query && !status && (
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
                <th scope="col">{t('cases.columns.year')}</th>
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
                  <td>{caseSummary.officialYear ? <bdi>{caseSummary.officialYear}</bdi> : '—'}</td>
                  <td>{caseSummary.clientNames.join('، ') || '—'}</td>
                  <td>
                    <Badge className="badge">
                      {caseSummary.archivedAt
                        ? t('cases.archivedBadge')
                        : t(`cases.status.${caseSummary.status}`)}
                    </Badge>
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
