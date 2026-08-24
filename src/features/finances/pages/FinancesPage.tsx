import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ExpenseDto, ExpenseType, PaymentDto, PaymentMethod } from '../../../bridge/types';
import { Dialog } from '../../../components/ui/Dialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { useCase, useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useExpenses, usePayments, useSaveExpense, useSavePayment } from '../api/financesApi';

const methods: ReadonlyArray<[PaymentMethod, string]> = [
  ['CASH', 'نقدي'],
  ['BANK_TRANSFER', 'تحويل بنكي'],
  ['CHEQUE', 'شيك'],
  ['ELECTRONIC', 'دفع إلكتروني'],
  ['OTHER', 'أخرى'],
];
const expenseTypes: ReadonlyArray<[ExpenseType, string]> = [
  ['COURT_FEE', 'رسوم قضائية'],
  ['TRANSPORT', 'انتقالات'],
  ['OFFICE_SUPPLIES', 'مستلزمات مكتب'],
  ['EXPERT_FEE', 'أتعاب خبير'],
  ['OTHER', 'أخرى'],
];
const today = () => new Date().toISOString().slice(0, 10);
export const parseMoneyToMinor = (value: string): number | null => {
  const match = value
    .trim()
    .replace(',', '.')
    .match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};
const money = (amount: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount / 100);
export const paymentPayerOptions = (
  caseClients: ReadonlyArray<{ clientId: string; fullName: string }> | undefined,
) => caseClients?.map((client) => ({ id: client.clientId, fullName: client.fullName })) ?? [];

type Entry =
  { type: 'payment'; value?: PaymentDto } | { type: 'expense'; value?: ExpenseDto } | null;

export function FinancesPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'payment' | 'expense'>('payment');
  const [filterCaseId, setFilterCaseId] = useState(params.get('case') ?? '');
  const [filterClientId, setFilterClientId] = useState(params.get('client') ?? '');
  const [entry, setEntry] = useState<Entry>(null);
  const cases = useCaseList({});
  const clients = useClientList({});
  const selectedCase = useCase(filterCaseId);
  const payments = usePayments({
    caseId: filterCaseId || undefined,
    payerClientId: filterClientId || undefined,
  });
  const expenses = useExpenses({
    caseId: filterCaseId || undefined,
    clientId: filterClientId || undefined,
  });
  const savePayment = useSavePayment();
  const saveExpense = useSaveExpense();
  const payerOptions = paymentPayerOptions(selectedCase.data?.clients);
  const records = tab === 'payment' ? (payments.data ?? []) : (expenses.data ?? []);

  const closeEntry = () => setEntry(null);
  return (
    <section className="work-page finance-page">
      <PageHeader
        kicker="المالية"
        title="الدفعات والمصروفات"
        description="متابعة نقدية بسيطة بالجنيه المصري؛ لا يحول التطبيق هذا السجل إلى دفتر محاسبي."
        actions={
          <button type="button" onClick={() => setEntry({ type: tab })}>
            إضافة {tab === 'payment' ? 'دفعة' : 'مصروف'}
          </button>
        }
      />
      <Tabs
        label="سجل المالية"
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { id: 'payment', label: 'الدفعات' },
          { id: 'expense', label: 'المصروفات' },
        ]}
      />
      <div className="finance-filters">
        <label>
          القضية
          <select
            value={filterCaseId}
            onChange={(event) => {
              setFilterCaseId(event.target.value);
              setFilterClientId('');
            }}
          >
            <option value="">كل القضايا</option>
            {cases.data?.map((caseItem) => (
              <option value={caseItem.id} key={caseItem.id}>
                {caseItem.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل
          <select
            value={filterClientId}
            onChange={(event) => setFilterClientId(event.target.value)}
          >
            <option value="">كل الموكلين</option>
            {(tab === 'payment' && filterCaseId ? payerOptions : (clients.data ?? [])).map(
              (client) => (
                <option value={client.id} key={client.id}>
                  {client.fullName}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setFilterCaseId('');
            setFilterClientId('');
          }}
        >
          مسح التصفية
        </button>
      </div>
      <section className="work-register">
        <div className="card-title">
          <div>
            <h3>{tab === 'payment' ? 'سجل الدفعات' : 'سجل المصروفات'}</h3>
            <p className="muted">{records.length} سجل</p>
          </div>
        </div>
        {!records.length ? (
          <p className="empty-compact">لا توجد {tab === 'payment' ? 'دفعات' : 'مصروفات'} مطابقة.</p>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table finance-table">
              <caption>السجل المالي</caption>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>البيان</th>
                  <th>الارتباط</th>
                  <th>المبلغ</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const payment = tab === 'payment' ? (record as PaymentDto) : null;
                  const expense = tab === 'expense' ? (record as ExpenseDto) : null;
                  const caseName = cases.data?.find(
                    (caseItem) => caseItem.id === (payment?.caseId ?? expense?.caseId),
                  )?.internalNumber;
                  const clientName = clients.data?.find(
                    (client) => client.id === (payment?.payerClientId ?? expense?.clientId),
                  )?.fullName;
                  return (
                    <tr key={record.id}>
                      <td>
                        <bdi>{payment?.paymentDate ?? expense?.expenseDate}</bdi>
                      </td>
                      <td>
                        <span className={`transaction-badge ${payment ? 'income' : 'expense'}`}>
                          {payment
                            ? payment.paymentMethod
                              ? methods.find(([value]) => value === payment.paymentMethod)?.[1]
                              : 'دفعة'
                            : expenseTypes.find(([value]) => value === expense!.expenseType)?.[1]}
                        </span>
                        {record.notes && <small>{record.notes}</small>}
                      </td>
                      <td>
                        {caseName ?? '—'}
                        {clientName && ` · ${clientName}`}
                      </td>
                      <td className={payment ? 'money-positive' : 'money-negative'}>
                        <bdi>{money(record.amountMinor)}</bdi>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setEntry(
                              payment
                                ? { type: 'payment', value: payment }
                                : { type: 'expense', value: expense! },
                            )
                          }
                        >
                          تعديل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(entry)}
        onOpenChange={(open) => !open && closeEntry()}
        title={`${entry?.value ? 'تعديل' : 'إضافة'} ${entry?.type === 'payment' ? 'دفعة' : 'مصروف'}`}
      >
        {entry?.type === 'payment' ? (
          <PaymentForm
            initial={entry.value}
            cases={cases.data ?? []}
            onCancel={closeEntry}
            busy={savePayment.isPending}
            onSave={async (input) => {
              await savePayment.mutateAsync(input);
              closeEntry();
            }}
          />
        ) : entry?.type === 'expense' ? (
          <ExpenseForm
            initial={entry.value}
            cases={cases.data ?? []}
            clients={clients.data ?? []}
            onCancel={closeEntry}
            busy={saveExpense.isPending}
            onSave={async (input) => {
              await saveExpense.mutateAsync(input);
              closeEntry();
            }}
          />
        ) : null}
        {(savePayment.isError || saveExpense.isError) && (
          <p className="error" role="alert">
            تعذر حفظ السجل. بقيت بيانات النموذج للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
    </section>
  );
}

function PaymentForm({
  initial,
  cases,
  busy,
  onSave,
  onCancel,
}: {
  initial?: PaymentDto;
  cases: ReturnType<typeof useCaseList>['data'];
  busy: boolean;
  onSave: (input: Parameters<ReturnType<typeof useSavePayment>['mutateAsync']>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const [caseId, setCaseId] = useState(initial?.caseId ?? '');
  const caseDetail = useCase(caseId);
  const [payerClientId, setPayerClientId] = useState(initial?.payerClientId ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : '');
  const [date, setDate] = useState(initial?.paymentDate ?? today());
  const [method, setMethod] = useState<PaymentMethod | ''>(initial?.paymentMethod ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const amountMinor = parseMoneyToMinor(amount);
        if (!amountMinor || !caseId || !payerClientId)
          return setError('اختر قضية وموكلًا من موكلي القضية وأدخل مبلغًا صحيحًا.');
        await onSave({
          id: initial?.id,
          caseId,
          payerClientId,
          amountMinor,
          paymentDate: date,
          paymentMethod: method || undefined,
          notes: notes || undefined,
        });
      }}
    >
      <label>
        القضية
        <select
          required
          value={caseId}
          onChange={(event) => {
            setCaseId(event.target.value);
            setPayerClientId('');
          }}
        >
          <option value="">اختر القضية</option>
          {cases?.map((caseItem) => (
            <option key={caseItem.id} value={caseItem.id}>
              {caseItem.internalNumber}
            </option>
          ))}
        </select>
      </label>
      <label>
        الموكل الدافع
        <select
          required
          disabled={!caseId}
          value={payerClientId}
          onChange={(event) => setPayerClientId(event.target.value)}
        >
          <option value="">اختر موكل القضية</option>
          {caseDetail.data?.clients.map((client) => (
            <option key={client.clientId} value={client.clientId}>
              {client.fullName}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-two-columns">
        <label>
          المبلغ (ج.م)
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          تاريخ الدفعة
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <label>
        طريقة الدفع (اختيارية)
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod | '')}
        >
          <option value="">غير محددة</option>
          {methods.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        ملاحظات <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
        <button disabled={busy}>حفظ الدفعة</button>
      </div>
    </form>
  );
}

function ExpenseForm({
  initial,
  cases,
  clients,
  busy,
  onSave,
  onCancel,
}: {
  initial?: ExpenseDto;
  cases: ReturnType<typeof useCaseList>['data'];
  clients: ReturnType<typeof useClientList>['data'];
  busy: boolean;
  onSave: (input: Parameters<ReturnType<typeof useSaveExpense>['mutateAsync']>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const [caseId, setCaseId] = useState(initial?.caseId ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : '');
  const [date, setDate] = useState(initial?.expenseDate ?? today());
  const [type, setType] = useState<ExpenseType>(initial?.expenseType ?? 'COURT_FEE');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const amountMinor = parseMoneyToMinor(amount);
        if (!amountMinor) return setError('أدخل مبلغًا صحيحًا أكبر من صفر.');
        await onSave({
          id: initial?.id,
          caseId: caseId || undefined,
          clientId: clientId || undefined,
          amountMinor,
          expenseDate: date,
          expenseType: type,
          notes: notes || undefined,
        });
      }}
    >
      <p className="muted">يمكن ربط المصروف بقضية أو موكل، أو ترك كلا الرابطين فارغين.</p>
      <div className="settings-two-columns">
        <label>
          القضية
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">غير مرتبطة بقضية</option>
            {cases?.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">غير مرتبط بموكل</option>
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-two-columns">
        <label>
          المبلغ (ج.م)
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          التاريخ
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <label>
        نوع المصروف
        <select value={type} onChange={(event) => setType(event.target.value as ExpenseType)}>
          {expenseTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        ملاحظات <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
        <button disabled={busy}>حفظ المصروف</button>
      </div>
    </form>
  );
}
