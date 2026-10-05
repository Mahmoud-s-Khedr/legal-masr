import { useState } from 'react';
import { parseMoneyToMinor } from '../../../lib/money';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import type { ExpenseDto, ExpenseType, PaymentDto, PaymentMethod } from '../../../bridge/types';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/Tabs';
import { Select } from '../../../components/ui/select';
import { Table } from '../../../components/ui/table';
import { Textarea } from '../../../components/ui/textarea';
import { useCase, useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import {
  useCaseFinanceSummary,
  useExpenses,
  usePayments,
  useSaveExpense,
  useSavePayment,
} from '../api/financesApi';
import { localDateOnly } from '../../../lib/dateOnly';

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
const today = () => localDateOnly();
export { parseMoneyToMinor };
const money = (amount: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount / 100);
export const paymentPayerOptions = (
  caseClients: ReadonlyArray<{ clientId: string; fullName: string }> | undefined,
) => caseClients?.map((client) => ({ id: client.clientId, fullName: client.fullName })) ?? [];

type Entry =
  | { type: 'payment'; value?: PaymentDto; mode: 'edit' | 'inspect' }
  | { type: 'expense'; value?: ExpenseDto; mode: 'edit' | 'inspect' }
  | null;

export function FinancesPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'payment' | 'expense'>('payment');
  const [filterCaseId, setFilterCaseId] = useState(params.get('case') ?? '');
  const [filterClientId, setFilterClientId] = useState(params.get('client') ?? '');
  const [entry, setEntry] = useState<Entry>(null);
  const cases = useCaseList({});
  const clients = useClientList({});
  const selectedCase = useCase(filterCaseId);
  const caseAccount = useCaseFinanceSummary(filterCaseId);
  const format = useFormat();
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
        description="سجّل ما تحصّله من موكليك وما تنفقه على قضاياهم بالجنيه المصري."
        actions={
          <Button type="button" onClick={() => setEntry({ type: tab, mode: 'edit' })}>
            إضافة {tab === 'payment' ? 'دفعة' : 'مصروف'}
          </Button>
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
          <Select
            value={filterCaseId}
            placeholder="كل القضايا"
            onValueChange={(value) => {
              setFilterCaseId(value);
              setFilterClientId('');
            }}
            items={[
              { value: '', label: 'كل القضايا' },
              ...(cases.data ?? []).map((item) => ({
                value: item.id,
                label: item.clientNames.length
                  ? `${item.internalNumber} — ${item.clientNames.join('، ')}`
                  : item.internalNumber,
              })),
            ]}
          />
        </label>
        <label>
          الموكل
          <Select
            value={filterClientId}
            onValueChange={setFilterClientId}
            placeholder="كل الموكلين"
            items={[
              { value: '', label: 'كل الموكلين' },
              ...(tab === 'payment' && filterCaseId ? payerOptions : (clients.data ?? [])).map(
                (item) => ({ value: item.id, label: item.fullName }),
              ),
            ]}
          />
        </label>
        <Button
          type="button"
          className="secondary-button"
          onClick={() => {
            setFilterCaseId('');
            setFilterClientId('');
          }}
        >
          مسح التصفية
        </Button>
      </div>
      {filterCaseId && caseAccount.data && (
        <div className="finance-summary" aria-label="حساب القضية المحددة">
          <article>
            <span>الأتعاب المتفق عليها</span>
            <strong>
              <bdi>{format.money(caseAccount.data.agreedFeeMinor)}</bdi>
            </strong>
          </article>
          <article>
            <span>المحصل</span>
            <strong>
              <bdi>{format.money(caseAccount.data.receivedMinor)}</bdi>
            </strong>
          </article>
          <article className="finance-net">
            <span>المتبقي</span>
            <strong>
              <bdi>{format.money(caseAccount.data.outstandingMinor)}</bdi>
            </strong>
          </article>
          <article>
            <span>المصروفات</span>
            <strong>
              <bdi>{format.money(caseAccount.data.expensesMinor)}</bdi>
            </strong>
          </article>
        </div>
      )}
      <section className="work-register">
        <div className="card-title">
          <div>
            <h3>{tab === 'payment' ? 'سجل الدفعات' : 'سجل المصروفات'}</h3>
            <p className="muted">
              {records.length} سجل · الإجمالي{' '}
              <bdi>
                {format.money(records.reduce((sum, record) => sum + record.amountMinor, 0))}
              </bdi>
            </p>
          </div>
        </div>
        {(tab === 'payment' ? payments.isError : expenses.isError) ? (
          <p className="error" role="alert">
            تعذر تحميل السجل المالي. حاول مرة أخرى.
          </p>
        ) : !records.length ? (
          <p className="empty-compact">لا توجد {tab === 'payment' ? 'دفعات' : 'مصروفات'} مطابقة.</p>
        ) : (
          <div className="data-table-scroll">
            <Table className="data-table finance-table">
              <caption>السجل المالي</caption>
              <thead>
                <tr>
                  <th scope="col">التاريخ</th>
                  <th scope="col">البيان</th>
                  <th scope="col">القضية والموكل</th>
                  <th scope="col">المبلغ</th>
                  <th scope="col">
                    <span className="sr-only">إجراءات</span>
                  </th>
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
                    <tr key={record.id} className="transaction-row">
                      <td>
                        <Button
                          variant="ghost"
                          type="button"
                          className="text-button"
                          aria-label={`عرض ${payment ? 'الدفعة' : 'المصروف'} بتاريخ ${format.dateLong(payment?.paymentDate ?? expense?.expenseDate ?? '')}`}
                          onClick={() =>
                            setEntry(
                              payment
                                ? { type: 'payment', value: payment, mode: 'inspect' }
                                : { type: 'expense', value: expense!, mode: 'inspect' },
                            )
                          }
                        >
                          <bdi>
                            {format.date(payment?.paymentDate ?? expense?.expenseDate ?? '')}
                          </bdi>
                        </Button>
                      </td>
                      <td>
                        <span className={`transaction-badge ${payment ? 'income' : 'expense'}`}>
                          {payment
                            ? payment.paymentMethod
                              ? methods.find(([value]) => value === payment.paymentMethod)?.[1]
                              : 'دفعة'
                            : expenseTypes.find(([value]) => value === expense!.expenseType)?.[1]}
                        </span>
                        {record.notes && <small dir="auto">{record.notes}</small>}
                      </td>
                      <td className="cell-wrap">
                        <bdi>{caseName ?? '—'}</bdi>
                        {clientName && <span className="cell-muted"> · {clientName}</span>}
                      </td>
                      <td className={payment ? 'money-positive' : 'money-negative'}>
                        <bdi>{format.money(record.amountMinor)}</bdi>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setEntry(
                              payment
                                ? { type: 'payment', value: payment, mode: 'edit' }
                                : { type: 'expense', value: expense!, mode: 'edit' },
                            );
                          }}
                        >
                          تعديل
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(entry)}
        onOpenChange={(open) => !open && closeEntry()}
        title={
          entry?.mode === 'inspect'
            ? `تفاصيل ${entry.type === 'payment' ? 'الدفعة' : 'المصروف'}`
            : `${entry?.value ? 'تعديل' : 'إضافة'} ${entry?.type === 'payment' ? 'دفعة' : 'مصروف'}`
        }
      >
        {entry?.mode === 'inspect' && entry.value ? (
          <TransactionInspection
            entry={
              entry.type === 'payment'
                ? { type: 'payment', value: entry.value as PaymentDto }
                : { type: 'expense', value: entry.value as ExpenseDto }
            }
            caseName={cases.data?.find((item) => item.id === entry.value?.caseId)?.internalNumber}
            clientName={
              clients.data?.find(
                (item) =>
                  item.id ===
                  (entry.type === 'payment' ? entry.value?.payerClientId : entry.value?.clientId),
              )?.fullName
            }
            onEdit={() => setEntry({ ...entry, mode: 'edit' })}
            onClose={closeEntry}
          />
        ) : entry?.type === 'payment' ? (
          <PaymentForm
            initial={entry.value}
            initialCaseId={filterCaseId || undefined}
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
            initialCaseId={filterCaseId || undefined}
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

function TransactionInspection({
  entry,
  caseName,
  clientName,
  onEdit,
  onClose,
}: {
  entry: { type: 'payment'; value: PaymentDto } | { type: 'expense'; value: ExpenseDto };
  caseName?: string;
  clientName?: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const isPayment = entry.type === 'payment';
  const record = entry.value;
  const date = isPayment ? (record as PaymentDto).paymentDate : (record as ExpenseDto).expenseDate;
  return (
    <div className="dialog-form transaction-inspection">
      <dl className="detail-definition-grid">
        <div>
          <dt>التاريخ</dt>
          <dd>
            <bdi>{date}</bdi>
          </dd>
        </div>
        <div>
          <dt>القضية</dt>
          <dd>
            <bdi>{caseName ?? '—'}</bdi>
          </dd>
        </div>
        <div>
          <dt>الموكل</dt>
          <dd>{clientName ?? '—'}</dd>
        </div>
        <div>
          <dt>المبلغ</dt>
          <dd>
            <bdi>{money(record.amountMinor)}</bdi>
          </dd>
        </div>
      </dl>
      <div>
        <strong>ملاحظات</strong>
        <p>{record.notes ?? '—'}</p>
      </div>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onClose}>
          إغلاق
        </Button>
        <Button type="button" onClick={onEdit}>
          تعديل السجل
        </Button>
      </div>
    </div>
  );
}

export function PaymentForm({
  initial,
  initialCaseId,
  cases,
  busy,
  onSave,
  onCancel,
}: {
  initial?: PaymentDto;
  initialCaseId?: string;
  cases: ReturnType<typeof useCaseList>['data'];
  busy: boolean;
  onSave: (input: Parameters<ReturnType<typeof useSavePayment>['mutateAsync']>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const [caseId, setCaseId] = useState(initial?.caseId ?? initialCaseId ?? '');
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
        try {
          await onSave({
            id: initial?.id,
            caseId,
            payerClientId,
            amountMinor,
            paymentDate: date,
            paymentMethod: method || undefined,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      }}
    >
      <label>
        القضية
        <Select
          required
          value={caseId}
          onValueChange={(value) => {
            setCaseId(value);
            setPayerClientId('');
          }}
          placeholder="اختر القضية"
          items={(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber }))}
        />
      </label>
      <label>
        الموكل الدافع
        <Select
          required
          disabled={!caseId}
          value={payerClientId}
          onValueChange={setPayerClientId}
          placeholder="اختر موكل القضية"
          items={(caseDetail.data?.clients ?? []).map((item) => ({
            value: item.clientId,
            label: item.fullName,
          }))}
        />
      </label>
      <div className="settings-two-columns">
        <label>
          المبلغ (ج.م)
          <Input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          تاريخ الدفعة
          <DatePicker required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      <label>
        طريقة الدفع (اختيارية)
        <Select
          value={method}
          onValueChange={(value) => setMethod(value as PaymentMethod | '')}
          items={[
            { value: '', label: 'غير محددة' },
            ...methods.map(([value, label]) => ({ value, label })),
          ]}
        />
      </label>
      <label>
        ملاحظات <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>حفظ الدفعة</Button>
      </div>
    </form>
  );
}

export function ExpenseForm({
  initial,
  initialCaseId,
  cases,
  clients,
  busy,
  onSave,
  onCancel,
}: {
  initial?: ExpenseDto;
  initialCaseId?: string;
  cases: ReturnType<typeof useCaseList>['data'];
  clients: ReturnType<typeof useClientList>['data'];
  busy: boolean;
  onSave: (input: Parameters<ReturnType<typeof useSaveExpense>['mutateAsync']>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const [caseId, setCaseId] = useState(initial?.caseId ?? initialCaseId ?? '');
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
        try {
          await onSave({
            id: initial?.id,
            caseId: caseId || undefined,
            clientId: clientId || undefined,
            amountMinor,
            expenseDate: date,
            expenseType: type,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      }}
    >
      <p className="muted">يمكن ربط المصروف بقضية أو موكل، أو ترك كلا الرابطين فارغين.</p>
      <div className="settings-two-columns">
        <label>
          القضية
          <Select
            value={caseId}
            onValueChange={setCaseId}
            items={[
              { value: '', label: 'غير مرتبطة بقضية' },
              ...(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
            ]}
          />
        </label>
        <label>
          الموكل
          <Select
            value={clientId}
            onValueChange={setClientId}
            items={[
              { value: '', label: 'غير مرتبط بموكل' },
              ...(clients ?? []).map((item) => ({ value: item.id, label: item.fullName })),
            ]}
          />
        </label>
      </div>
      <div className="settings-two-columns">
        <label>
          المبلغ (ج.م)
          <Input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          التاريخ
          <DatePicker required value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      <label>
        نوع المصروف
        <Select
          value={type}
          onValueChange={(value) => setType(value as ExpenseType)}
          items={expenseTypes.map(([value, label]) => ({ value, label }))}
        />
      </label>
      <label>
        ملاحظات <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>حفظ المصروف</Button>
      </div>
    </form>
  );
}
