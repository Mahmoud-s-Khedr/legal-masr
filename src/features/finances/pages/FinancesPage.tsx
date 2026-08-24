import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ExpenseType, PaymentMethod } from '../../../bridge/types';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useExpenses, usePayments, useSaveExpense, useSavePayment } from '../api/financesApi';

const methods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ELECTRONIC', 'OTHER'];
const expenseTypes: ExpenseType[] = [
  'COURT_FEE',
  'TRANSPORT',
  'OFFICE_SUPPLIES',
  'EXPERT_FEE',
  'OTHER',
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

export function FinancesPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'payment' | 'expense'>('payment');
  const [caseId, setCaseId] = useState(params.get('case') ?? '');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [expenseType, setExpenseType] = useState<ExpenseType>('COURT_FEE');
  const cases = useCaseList({});
  const clients = useClientList({});
  const payments = usePayments({
    caseId: caseId || undefined,
    payerClientId: clientId || undefined,
  });
  const expenses = useExpenses({ caseId: caseId || undefined, clientId: clientId || undefined });
  const savePayment = useSavePayment();
  const saveExpense = useSaveExpense();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const amountMinor = parseMoneyToMinor(amount);
    if (!amountMinor) return;
    if (tab === 'payment') {
      if (!caseId || !clientId) return;
      savePayment.mutate({
        caseId,
        payerClientId: clientId,
        amountMinor,
        paymentDate: date,
        paymentMethod: method,
        notes: notes || undefined,
      });
    } else
      saveExpense.mutate({
        caseId: caseId || undefined,
        clientId: clientId || undefined,
        amountMinor,
        expenseDate: date,
        expenseType,
        notes: notes || undefined,
      });
  };
  return (
    <section className="work-page finance-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المالية</p>
          <h2>الدفعات والمصروفات</h2>
          <p>سجل نقدي بسيط بالجنيه المصري، وليس نظامًا محاسبيًا.</p>
        </div>
      </header>
      <div className="segmented">
        <button className={tab === 'payment' ? 'active' : ''} onClick={() => setTab('payment')}>
          دفعة
        </button>
        <button className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')}>
          مصروف
        </button>
      </div>
      <form className="finance-entry" onSubmit={submit}>
        <label>
          القضية
          <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">غير مرتبطة بقضية</option>
            {cases.data?.map((item) => (
              <option value={item.id} key={item.id}>
                {item.internalNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          الموكل
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">غير مرتبط بموكل</option>
            {clients.data?.map((item) => (
              <option value={item.id} key={item.id}>
                {item.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          المبلغ
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
        {tab === 'payment' ? (
          <label>
            طريقة الدفع
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {methods.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            نوع المصروف
            <select
              value={expenseType}
              onChange={(event) => setExpenseType(event.target.value as ExpenseType)}
            >
              {expenseTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          ملاحظات
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button disabled={savePayment.isPending || saveExpense.isPending}>حفظ</button>
      </form>
      <section className="work-register">
        <h3>السجل</h3>
        <ul className="record-list">
          {(tab === 'payment' ? (payments.data ?? []) : (expenses.data ?? [])).map((entry) => (
            <li key={entry.id}>
              <time>{'paymentDate' in entry ? entry.paymentDate : entry.expenseDate}</time>
              <strong>{'paymentMethod' in entry ? 'دفعة' : entry.expenseType}</strong>
              <span>{money(entry.amountMinor)}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
