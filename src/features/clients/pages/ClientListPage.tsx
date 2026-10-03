import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';
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
  const { data: clients, isLoading } = useClientList({
    query: query || undefined,
    includeArchived,
  });

  return (
    <section className="entity-list">
      <div className="entity-list-header">
        <div>
          <p className="kicker">سجل العملاء</p>
          <h2>{t('clients.title')}</h2>
          <p className="page-description">
            ابحث بسرعة، وافتح ملف الموكل بكل قضاياه ومستنداته وحسابه.
          </p>
        </div>
        <Button onClick={() => navigate('/clients/new')}>{t('clients.newButton')}</Button>
      </div>

      <div className="entity-list-toolbar">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('clients.searchPlaceholder')}
        />
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          {t('clients.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="table-message h-24" aria-label={t('clients.loading')} />
      ) : !clients?.length ? (
        <Card className="empty-state-card">
          <strong>{query ? 'لا توجد نتائج مطابقة' : t('clients.empty')}</strong>
          <span>
            {query
              ? 'جرّب جزءًا من الاسم أو رقم الهاتف.'
              : 'أضف أول موكل لبدء تنظيم القضايا والمتابعات.'}
          </span>
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
                    <Link to={`/clients/${client.id}`}>{client.fullName}</Link>
                  </th>
                  <td>
                    <bdi>{client.internalNumber}</bdi>
                  </td>
                  <td>{client.primaryPhone ? <bdi>{client.primaryPhone}</bdi> : '—'}</td>
                  <td>
                    {client.archivedAt ? (
                      <Badge className="badge">{t('clients.archivedBadge')}</Badge>
                    ) : (
                      <span className="status-dot">{t('clients.active')}</span>
                    )}
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
