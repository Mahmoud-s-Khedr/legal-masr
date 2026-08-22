import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCaseList } from '../api/casesApi';

export function CaseListPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const navigate = useNavigate();
  const { data: cases, isLoading } = useCaseList({
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
        <button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</button>
      </div>

      <div className="entity-list-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث برقم القضية أو المحكمة أو الموكل"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="تصفية حسب الحالة"
        >
          <option value="">كل الحالات</option>
          {[
            'DRAFT',
            'ACTIVE',
            'SUSPENDED',
            'JUDGMENT_ISSUED',
            'APPEALED',
            'ENFORCEMENT',
            'CLOSED',
          ].map((value) => (
            <option key={value} value={value}>
              {t(`cases.status.${value}`)}
            </option>
          ))}
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          {t('cases.showArchived')}
        </label>
      </div>

      {isLoading ? (
        <p className="table-message">{t('cases.loading')}</p>
      ) : !cases?.length ? (
        <div className="empty-state-card">
          <strong>{query || status ? 'لا توجد قضايا مطابقة' : t('cases.empty')}</strong>
          <span>
            {query || status
              ? 'غيّر كلمات البحث أو حالة القضية.'
              : 'أنشئ أول قضية واربطها بموكل واحد على الأقل.'}
          </span>
          {!query && !status && (
            <button onClick={() => navigate('/cases/new')}>{t('cases.newButton')}</button>
          )}
        </div>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
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
                    <Link to={`/cases/${caseSummary.id}`}>{caseSummary.caseNumber}</Link>
                  </th>
                  <td>{caseSummary.judicialYear ?? '—'}</td>
                  <td>{caseSummary.primaryClientName ?? '—'}</td>
                  <td>
                    <span className="badge">
                      {caseSummary.archivedAt
                        ? t('cases.archivedBadge')
                        : t(`cases.status.${caseSummary.status}`)}
                    </span>
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
