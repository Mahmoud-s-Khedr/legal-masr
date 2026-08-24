import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog } from '../../../components/ui/Dialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PowerOfAttorneyForm } from '../components/PowerOfAttorneyForm';
import { usePowerOfAttorneyList, useSavePowerOfAttorney } from '../api/powersOfAttorneyApi';

export function PowersOfAttorneyPage() {
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const powers = usePowerOfAttorneyList({ query: query || undefined, includeArchived });
  const save = useSavePowerOfAttorney();
  const navigate = useNavigate();
  return (
    <section className="work-page">
      <PageHeader
        kicker="التوكيلات"
        title="التوكيلات"
        description="اربط التوكيل بموكل واحد أو أكثر وسجّل المحامين المذكورين فيه."
        actions={
          <button type="button" onClick={() => setAdding(true)}>
            إضافة توكيل
          </button>
        }
      />
      <div className="entity-list-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث برقم التوكيل أو الموكل أو مكتب التوثيق"
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          إظهار المؤرشف
        </label>
      </div>
      {powers.isLoading ? (
        <p className="table-message">جارٍ تحميل التوكيلات…</p>
      ) : !powers.data?.length ? (
        <div className="empty-state-card">
          <strong>{query ? 'لا توجد توكيلات مطابقة' : 'لا توجد توكيلات بعد'}</strong>
          <span>أضف توكيلًا واربطه بالموكلين المرتبطين به.</span>
          {!query && (
            <button type="button" onClick={() => setAdding(true)}>
              إضافة توكيل
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
            <caption>التوكيلات</caption>
            <thead>
              <tr>
                <th>الرقم الداخلي</th>
                <th>رقم التوكيل</th>
                <th>الموكلون</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {powers.data.map((power) => (
                <tr key={power.id} onClick={() => navigate(`/powers-of-attorney/${power.id}`)}>
                  <th>
                    <Link to={`/powers-of-attorney/${power.id}`}>
                      <bdi>{power.internalSequence}</bdi>
                    </Link>
                  </th>
                  <td>
                    {power.officialNumber ? (
                      <bdi>
                        {power.officialNumber}
                        {power.issueYear ? ` / ${power.issueYear}` : ''}
                      </bdi>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{power.clientNames.join('، ') || '—'}</td>
                  <td>
                    {power.archivedAt ? (
                      <span className="badge">مؤرشف</span>
                    ) : (
                      <span className="status-dot">نشط</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={adding} onOpenChange={setAdding} title="إضافة توكيل">
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
            تعذر حفظ التوكيل. راجع الحقول وحاول مجددًا.
          </p>
        )}
      </Dialog>
    </section>
  );
}
