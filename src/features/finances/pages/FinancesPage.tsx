import { useState } from 'react';
import { useClientList } from '../../clients/api/clientsApi';
import { useCaseList } from '../../cases/api/casesApi';
import { useReverseTransaction, useSaveTransaction, useTransactions } from '../api/financesApi';
import type { FinancialTransactionType, PaymentMethod } from '../../../bridge/types';
const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(value / 100);
const today = new Date().toISOString().slice(0, 10);
export function FinancesPage() {
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [type, setType] = useState<FinancialTransactionType>('FEE_PAYMENT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [description, setDescription] = useState('');
  const clients = useClientList({});
  const cases = useCaseList({});
  const transactions = useTransactions({});
  const save = useSaveTransaction();
  const reverse = useReverseTransaction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = Math.round(Number(amount) * 100);
    if (!clientId || !Number.isFinite(minor) || minor <= 0) return;
    save.mutate({
      clientId,
      caseId: caseId || undefined,
      transactionType: type,
      amountMinor: minor,
      transactionDate: date,
      paymentMethod: method,
      description: description || undefined,
    });
    setAmount('');
    setDescription('');
  };
  return (
    <section className="work-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المالية</p>
          <h2>سجل أتعاب ومصروفات القضايا</h2>
          <p>سجل تشغيلي بالجنيه المصري، وليس فاتورة ضريبية أو نظام محاسبة رسمي.</p>
        </div>
        <button className="secondary-button" onClick={() => window.print()}>
          طباعة الكشف
        </button>
      </header>
      <form className="document-intake" onSubmit={submit}>
        <label>
          الموكل
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">اختر الموكل</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          القضية (اختياري)
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">بدون قضية</option>
            {cases.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          النوع
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FinancialTransactionType)}
          >
            {['FEE_PAYMENT', 'CASE_EXPENSE', 'REFUND', 'OTHER_INCOME', 'OTHER_EXPENSE'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          المبلغ (ج.م)
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          التاريخ
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          طريقة الدفع
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {['CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_WALLET', 'OTHER'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          الوصف
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button disabled={save.isPending}>
          {save.isPending ? 'جارٍ الحفظ…' : 'تسجيل العملية'}
        </button>
        {save.isError && <p className="error">تعذر حفظ العملية المالية.</p>}
      </form>
      <section className="work-register">
        <div className="register-heading">
          <div>
            <p className="kicker">السجل</p>
            <h3>العمليات</h3>
          </div>
        </div>
        {transactions.isLoading ? (
          <p>جارٍ التحميل…</p>
        ) : !transactions.data?.length ? (
          <p className="table-message">لا توجد عمليات مالية بعد.</p>
        ) : (
          <ul className="record-list">
            {transactions.data.map((t) => (
              <li key={t.id}>
                <div className="record-copy">
                  <strong>
                    {t.transactionType} · {money(t.amountMinor)}
                  </strong>
                  <span>
                    {t.transactionDate}
                    {t.description ? ` · ${t.description}` : ''}
                    {t.reversedTransactionId ? ' · عملية عكس' : ''}
                  </span>
                </div>
                {!t.reversedTransactionId && (
                  <button
                    className="text-button danger-button"
                    onClick={() => reverse.mutate({ id: t.id, date: today })}
                  >
                    عكس العملية
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
