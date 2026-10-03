import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog } from '../../../components/ui/Dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Skeleton } from '../../../components/ui/skeleton';
import { Table } from '../../../components/ui/table';
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
      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">التوكيلات</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">التوكيلات</h1>
          <p className="mt-1 text-muted-foreground">اربط التوكيل بموكل واحد أو أكثر وسجّل المحامين المذكورين فيه.</p>
        </div>
        <Button type="button" onClick={() => setAdding(true)}>
          إضافة توكيل
        </Button>
      </header>
      <div className="entity-list-toolbar">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث برقم التوكيل أو الموكل أو مكتب التوثيق"
        />
        <label className="checkbox-field">
          <Checkbox checked={includeArchived} onCheckedChange={setIncludeArchived} />
          إظهار المؤرشف
        </label>
      </div>
      {powers.isLoading ? (
        <Skeleton className="table-message h-24" aria-label="جارٍ تحميل التوكيلات…" />
      ) : !powers.data?.length ? (
        <Card className="empty-state-card">
          <strong>{query ? 'لا توجد توكيلات مطابقة' : 'لا توجد توكيلات بعد'}</strong>
          <span>أضف توكيلًا واربطه بالموكلين المرتبطين به.</span>
          {!query && (
            <Button type="button" onClick={() => setAdding(true)}>
              إضافة توكيل
            </Button>
          )}
        </Card>
      ) : (
        <div className="data-table-scroll">
          <Table className="data-table">
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
                  <td>{power.officialNumber ? <bdi>{power.officialNumber}</bdi> : '—'}</td>
                  <td>{power.clientNames.join('، ') || '—'}</td>
                  <td>
                    {power.archivedAt ? (
                      <Badge className="badge">مؤرشف</Badge>
                    ) : (
                      <span className="status-dot">نشط</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
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
