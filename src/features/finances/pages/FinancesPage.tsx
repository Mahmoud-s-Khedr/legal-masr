import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  FinancialTransactionDto,
  FinancialTransactionType,
  PaymentMethod,
} from '../../../bridge/types';
import { Icon } from '../../../components/layout/Icon';
import { useCaseList } from '../../cases/api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import { useReverseTransaction, useSaveTransaction, useTransactions } from '../api/financesApi';

const transactionLabels: Record<FinancialTransactionType, string> = {
  FEE_PAYMENT: 'دفعة أتعاب',
  CASE_EXPENSE: 'مصروف قضية',
  REFUND: 'مبلغ مُردّ',
  OTHER_INCOME: 'إيراد آخر',
  OTHER_EXPENSE: 'مصروف آخر',
};
const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'نقدي',
  BANK_TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة',
  MOBILE_WALLET: 'محفظة إلكترونية',
  OTHER: 'أخرى',
};
const incomeTypes = new Set<FinancialTransactionType>(['FEE_PAYMENT', 'OTHER_INCOME']);
const expenseTypes = new Set<FinancialTransactionType>(['CASE_EXPENSE', 'OTHER_EXPENSE']);
const pad = (value: number) => String(value).padStart(2, '0');
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
export const parseMoneyToMinor = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [major, fraction = ''] = normalized.split('.');
  const result = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result > 0 ? result : null;
};
const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(value / 100);

function signedAmount(transaction: FinancialTransactionDto) {
  return incomeTypes.has(transaction.transactionType)
    ? transaction.amountMinor
    : -transaction.amountMinor;
}

export function FinancesPage() {
  const [searchParams] = useSearchParams();
  const linkedClientId = searchParams.get('client') ?? '';
  const linkedCaseId = searchParams.get('case') ?? '';
  const [formClientId, setFormClientId] = useState(linkedClientId);
  const [formCaseId, setFormCaseId] = useState(linkedCaseId);
  const [filterClientId, setFilterClientId] = useState(linkedClientId);
  const [filterCaseId, setFilterCaseId] = useState(linkedCaseId);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [type, setType] = useState<FinancialTransactionType>('FEE_PAYMENT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localToday());
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const clients = useClientList({});
  const cases = useCaseList({});
  const transactions = useTransactions({
    clientId: filterClientId || undefined,
    caseId: filterCaseId || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });
  const save = useSaveTransaction();
  const reverse = useReverseTransaction();
  const clientNames = useMemo(
    () => new Map(clients.data?.map((client) => [client.id, client.displayName])),
    [clients.data],
  );
  const caseNames = useMemo(
    () => new Map(cases.data?.map((item) => [item.id, item.caseNumber])),
    [cases.data],
  );
  const reversedOriginalIds = useMemo(
    () => new Set(transactions.data?.flatMap((item) => item.reversedTransactionId ?? []) ?? []),
    [transactions.data],
  );
  const totals = useMemo(
    () =>
      (transactions.data ?? []).reduce(
        (result, item) => {
          if (item.reversedTransactionId || reversedOriginalIds.has(item.id)) return result;
          if (incomeTypes.has(item.transactionType)) result.income += item.amountMinor;
          else if (expenseTypes.has(item.transactionType)) result.expenses += item.amountMinor;
          else result.refunds += item.amountMinor;
          result.net += signedAmount(item);
          return result;
        },
        { income: 0, expenses: 0, refunds: 0, net: 0 },
      ),
    [reversedOriginalIds, transactions.data],
  );
  const resetForm = () => {
    setEditing(null);
    setType('FEE_PAYMENT');
    setAmount('');
    setDate(localToday());
    setMethod('CASH');
    setDescription('');
    setFormError('');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountMinor = parseMoneyToMinor(amount);
    if (!formClientId) return setFormError('اختر الموكل المرتبط بالعملية.');
    if (!amountMinor)
      return setFormError('أدخل مبلغًا صحيحًا أكبر من صفر وبحد أقصى منزلتين عشريتين.');
    setFormError('');
    await save.mutateAsync({
      id: editing ?? undefined,
      clientId: formClientId,
      caseId: formCaseId || undefined,
      transactionType: type,
      amountMinor,
      transactionDate: date,
      paymentMethod: method,
      description: description || undefined,
    });
    resetForm();
  };
  const edit = (item: FinancialTransactionDto) => {
    setEditing(item.id);
    setFormClientId(item.clientId);
    setFormCaseId(item.caseId ?? '');
    setType(item.transactionType);
    setAmount((item.amountMinor / 100).toFixed(2));
    setDate(item.transactionDate);
    setMethod(item.paymentMethod ?? 'CASH');
    setDescription(item.description ?? '');
    setFormError('');
    document.querySelector('.finance-entry')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="work-page finance-page">
      <header className="page-heading print-heading">
        <div>
          <p className="kicker">المالية</p>
          <h2>الأتعاب والمصروفات</h2>
          <p>
            سجل بسيط بالجنيه المصري لمتابعة ما تم تحصيله وما تم إنفاقه، وليس نظامًا محاسبيًا أو
            ضريبيًا.
          </p>
        </div>
        <button className="secondary-button no-print" onClick={() => window.print()}>
          <Icon name="receipt" size={18} />
          طباعة الكشف
        </button>
      </header>

      <section className="finance-summary" aria-label="ملخص الفترة">
        <article>
          <span>المتحصلات</span>
          <strong>{money(totals.income)}</strong>
        </article>
        <article>
          <span>المبالغ المردودة</span>
          <strong>{money(totals.refunds)}</strong>
        </article>
        <article>
          <span>المصروفات</span>
          <strong>{money(totals.expenses)}</strong>
        </article>
        <article className="finance-net">
          <span>صافي الحركة</span>
          <strong>{money(totals.net)}</strong>
        </article>
      </section>

      <section className="finance-filters no-print" aria-label="تصفية السجل">
        <label>
          من تاريخ
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          إلى تاريخ
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label>
          الموكل
          <select
            value={filterClientId}
            onChange={(event) => {
              setFilterClientId(event.target.value);
              setFilterCaseId('');
            }}
          >
            <option value="">كل الموكلين</option>
            {clients.data?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          القضية
          <select value={filterCaseId} onChange={(event) => setFilterCaseId(event.target.value)}>
            <option value="">كل القضايا</option>
            {cases.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.caseNumber}
              </option>
            ))}
          </select>
        </label>
        {(fromDate || toDate || filterClientId || filterCaseId) && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setFilterClientId('');
              setFilterCaseId('');
            }}
          >
            مسح التصفية
          </button>
        )}
      </section>

      <form className="finance-entry no-print" onSubmit={submit}>
        <div className="register-heading">
          <div>
            <p className="kicker">{editing ? 'تعديل العملية' : 'عملية جديدة'}</p>
            <h3>{editing ? 'راجع البيانات ثم احفظ' : 'سجّل حركة مالية'}</h3>
          </div>
          {editing && (
            <button className="text-button" type="button" onClick={resetForm}>
              إلغاء التعديل
            </button>
          )}
        </div>
        <div className="finance-entry-grid">
          <label>
            الموكل
            <select
              required
              value={formClientId}
              onChange={(event) => setFormClientId(event.target.value)}
            >
              <option value="">اختر الموكل</option>
              {clients.data?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            القضية (اختياري)
            <select value={formCaseId} onChange={(event) => setFormCaseId(event.target.value)}>
              <option value="">بدون قضية</option>
              {cases.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.caseNumber}
                </option>
              ))}
            </select>
          </label>
          <label>
            النوع
            <select
              value={type}
              onChange={(event) => setType(event.target.value as FinancialTransactionType)}
            >
              {(Object.keys(transactionLabels) as FinancialTransactionType[]).map((item) => (
                <option value={item} key={item}>
                  {transactionLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            المبلغ (ج.م)
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              dir="ltr"
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
          <label>
            طريقة الدفع
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {(Object.keys(methodLabels) as PaymentMethod[]).map((item) => (
                <option value={item} key={item}>
                  {methodLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="finance-description">
            البيان
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="مثال: دفعة مقدمة عن الأتعاب"
            />
          </label>
        </div>
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        {save.isError && (
          <p className="error" role="alert">
            تعذر حفظ العملية. لم تتغير البيانات المدخلة.
          </p>
        )}
        <div className="form-actions">
          <button disabled={save.isPending}>
            {save.isPending ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديل' : 'تسجيل العملية'}
          </button>
        </div>
      </form>

      <section className="work-register finance-register">
        <div className="register-heading">
          <div>
            <p className="kicker">الكشف</p>
            <h3>الحركات المالية</h3>
          </div>
          <span className="count-pill">{transactions.data?.length ?? 0} عملية</span>
        </div>
        {transactions.isLoading ? (
          <p className="table-message">جارٍ تحميل السجل…</p>
        ) : !transactions.data?.length ? (
          <p className="table-message">لا توجد عمليات مالية ضمن الفترة المحددة.</p>
        ) : (
          <div className="data-table-scroll">
            <table className="data-table finance-table">
              <caption>كشف الحركات المالية</caption>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الموكل</th>
                  <th>القضية</th>
                  <th>النوع</th>
                  <th>البيان</th>
                  <th>المبلغ</th>
                  <th className="no-print">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {transactions.data.map((item) => {
                  const isReversal = Boolean(item.reversedTransactionId);
                  const isReversed = reversedOriginalIds.has(item.id);
                  return (
                    <tr key={item.id} className={isReversal || isReversed ? 'reversed-row' : ''}>
                      <td dir="ltr">{item.transactionDate}</td>
                      <td>{clientNames.get(item.clientId) ?? '—'}</td>
                      <td>{item.caseId ? (caseNames.get(item.caseId) ?? '—') : '—'}</td>
                      <td>
                        <span
                          className={`transaction-badge ${incomeTypes.has(item.transactionType) ? 'income' : 'expense'}`}
                        >
                          {transactionLabels[item.transactionType]}
                        </span>
                      </td>
                      <td>
                        {item.description ?? '—'}
                        {isReversal && <small>قيد عكس</small>}
                        {isReversed && <small>تم عكسها</small>}
                      </td>
                      <td
                        className={signedAmount(item) >= 0 ? 'money-positive' : 'money-negative'}
                        dir="ltr"
                      >
                        {signedAmount(item) >= 0 ? '+' : '−'} {money(Math.abs(item.amountMinor))}
                      </td>
                      <td className="finance-actions no-print">
                        {!isReversal && !isReversed && (
                          <>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => edit(item)}
                            >
                              تعديل
                            </button>
                            <button
                              className="text-button danger-button"
                              type="button"
                              disabled={reverse.isPending}
                              onClick={() => reverse.mutate({ id: item.id, date: localToday() })}
                            >
                              عكس
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {reverse.isError && (
          <p className="error no-print" role="alert">
            تعذر عكس العملية؛ قد تكون معكوسة بالفعل.
          </p>
        )}
      </section>
    </section>
  );
}
