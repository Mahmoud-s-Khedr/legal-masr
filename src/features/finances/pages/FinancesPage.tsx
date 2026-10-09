import { fieldError } from '@/lib/fieldError';
import { DraftForm } from '@/components/forms/DraftForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { paymentDraftSchema, expenseDraftSchema } from '@/lib/formSchemas';
import { useState } from 'react';
import { minorToInput, parseMoneyToMinor } from '../../../lib/money';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import type { ExpenseDto, ExpenseType, PaymentDto, PaymentMethod } from '../../../bridge/types';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Button } from '../../../components/ui/button';
import { FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '../../../components/ui/select';
import { RecordTable } from '@/components/forms/RecordTable';
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

const methods: readonly PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'ELECTRONIC',
  'OTHER',
];
const expenseTypes: readonly ExpenseType[] = [
  'COURT_FEE',
  'TRANSPORT',
  'OFFICE_SUPPLIES',
  'EXPERT_FEE',
  'OTHER',
];
const today = () => localDateOnly();
export { parseMoneyToMinor };
export const paymentPayerOptions = (
  caseClients: ReadonlyArray<{ clientId: string; fullName: string }> | undefined,
) => caseClients?.map((client) => ({ id: client.clientId, fullName: client.fullName })) ?? [];

type Entry =
  | { type: 'payment'; value?: PaymentDto; mode: 'edit' | 'inspect' }
  | { type: 'expense'; value?: ExpenseDto; mode: 'edit' | 'inspect' }
  | null;

export function FinancesPage() {
  const { t } = useTranslation();
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
        kicker={t('finances.kicker')}
        title={t('finances.title')}
        description={t('finances.description')}
        actions={
          <Button type="button" onClick={() => setEntry({ type: tab, mode: 'edit' })}>
            {t(`finances.add.${tab}`)}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => ((value) => setTab(value as typeof tab))(String(value))}
      >
        <TabsList activateOnFocus aria-label={t('finances.tabsLabel')} variant={'default'}>
          {[
            { id: 'payment', label: t('finances.payments') },
            { id: 'expense', label: t('finances.expenses') },
          ].map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="finance-filters">
        <label>
          {t('finances.case')}
          <EntityPicker
            value={filterCaseId}
            onValueChange={(value) => {
              setFilterCaseId(value ?? '');
              setFilterClientId('');
            }}
            items={[
              { value: '', label: t('tasks.allCases') },
              ...(cases.data ?? []).map((item) => ({
                value: item.id,
                label: item.clientNames.length
                  ? `${item.internalNumber} — ${format.list(item.clientNames)}`
                  : item.internalNumber,
              })),
            ]}
            placeholder={t('tasks.allCases')}
          />
        </label>
        <label>
          {t('finances.client')}
          <EntityPicker
            value={filterClientId}
            onValueChange={(value) => setFilterClientId(value ?? '')}
            items={[
              { value: '', label: t('tasks.allClients') },
              ...(tab === 'payment' && filterCaseId ? payerOptions : (clients.data ?? [])).map(
                (item) => ({ value: item.id, label: item.fullName }),
              ),
            ]}
            placeholder={t('tasks.allClients')}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setFilterCaseId('');
            setFilterClientId('');
          }}
        >
          {t('tasks.clearFilters')}
        </Button>
      </div>
      {filterCaseId && caseAccount.data && (
        <div className="finance-summary" aria-label={t('finances.caseAccount')}>
          <article>
            <span>{t('cases.detail.agreed')}</span>
            <strong>
              <bdi>{format.money(caseAccount.data.agreedFeeMinor)}</bdi>
            </strong>
          </article>
          <article>
            <span>{t('cases.detail.received')}</span>
            <strong>
              <bdi>{format.money(caseAccount.data.receivedMinor)}</bdi>
            </strong>
          </article>
          <article className="finance-net">
            <span>{t('cases.detail.outstanding')}</span>
            <strong>
              <bdi>{format.money(caseAccount.data.outstandingMinor)}</bdi>
            </strong>
          </article>
          <article>
            <span>{t('cases.detail.expenses')}</span>
            <strong>
              <bdi>{format.money(caseAccount.data.expensesMinor)}</bdi>
            </strong>
          </article>
        </div>
      )}
      <section className="work-register">
        <div className="card-title">
          <div>
            <h3>{t(`finances.register.${tab}`)}</h3>
            <p className="muted">
              {t('finances.totalLine', {
                count: records.length,
                total: format.money(records.reduce((sum, record) => sum + record.amountMinor, 0)),
              })}
            </p>
          </div>
        </div>
        {(tab === 'payment' ? payments.isError : expenses.isError) ? (
          <Alert variant="destructive">
            <AlertDescription>{t('finances.loadError')}</AlertDescription>
          </Alert>
        ) : !records.length ? (
          <p className="empty-compact">{t(`finances.empty.${tab}`)}</p>
        ) : (
          <div className="data-table-scroll">
            <RecordTable className="data-table finance-table">
              <caption>{t('finances.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('finances.columns.date')}</th>
                  <th scope="col">{t('finances.columns.type')}</th>
                  <th scope="col">{t('finances.columns.link')}</th>
                  <th scope="col">{t('finances.columns.amount')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('finances.columns.actions')}</span>
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

                          aria-label={t(`finances.viewAria.${payment ? 'payment' : 'expense'}`, {
                            date: format.dateLong(
                              payment?.paymentDate ?? expense?.expenseDate ?? '',
                            ),
                          })}
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
                        <Badge variant="secondary">
                          {payment
                            ? payment.paymentMethod
                              ? t(`finances.methods.${payment.paymentMethod}`)
                              : t('finances.paymentFallback')
                            : t(`finances.expenseTypes.${expense!.expenseType}`)}
                        </Badge>
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

                          onClick={() => {
                            setEntry(
                              payment
                                ? { type: 'payment', value: payment, mode: 'edit' }
                                : { type: 'expense', value: expense!, mode: 'edit' },
                            );
                          }}
                        >
                          {t('records.edit')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </RecordTable>
          </div>
        )}
      </section>
      <FormDialog
        open={Boolean(entry)}
        onOpenChange={(open) => !open && closeEntry()}
        title={
          entry?.mode === 'inspect'
            ? t(`cases.detail.inspect.${entry.type}`)
            : t(
                `cases.detail.${entry?.value ? 'editEntry' : 'newEntry'}.${entry?.type ?? 'payment'}`,
              )
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
          <Alert variant="destructive">
            <AlertDescription>{t('cases.detail.entrySaveError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
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
  const { t } = useTranslation();
  const format = useFormat();
  const isPayment = entry.type === 'payment';
  const record = entry.value;
  const date = isPayment ? (record as PaymentDto).paymentDate : (record as ExpenseDto).expenseDate;
  return (
    <div className="mt-4 grid gap-3.5 transaction-inspection">
      <dl className="detail-definition-grid">
        <div>
          <dt>{t('cases.detail.entryDate')}</dt>
          <dd>
            <bdi>{format.date(date)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('finances.case')}</dt>
          <dd>
            <bdi>{caseName ?? '—'}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('finances.client')}</dt>
          <dd>{clientName ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('cases.detail.entryAmount')}</dt>
          <dd>
            <bdi>{format.money(record.amountMinor)}</bdi>
          </dd>
        </div>
      </dl>
      <div>
        <strong>{t('common.notes')}</strong>
        <p>{record.notes ?? '—'}</p>
      </div>
      <FormDialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('records.close')}
        </Button>
        <Button type="button" onClick={onEdit}>
          {t('cases.detail.editEntryButton')}
        </Button>
      </FormDialogFooter>
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
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof paymentDraftSchema>>({
    resolver: zodResolver(paymentDraftSchema),
    defaultValues: {
      caseId: initial?.caseId ?? initialCaseId ?? '',
      payerClientId: initial?.payerClientId ?? '',
      amount: initial ? minorToInput(initial.amountMinor) : '',
      date: initial?.paymentDate ?? today(),
      method: initial?.paymentMethod ?? '',
      notes: initial?.notes ?? '',
    },
  });

  const caseId = useWatch({ control: form.control, name: 'caseId' });
  const setCaseId = (value: string) =>
    form.setValue('caseId', value, { shouldValidate: form.formState.isSubmitted });
  const caseDetail = useCase(caseId);
  const payerClientId = useWatch({ control: form.control, name: 'payerClientId' });
  const setPayerClientId = (value: string) =>
    form.setValue('payerClientId', value, { shouldValidate: form.formState.isSubmitted });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const setAmount = (value: string) =>
    form.setValue('amount', value, { shouldValidate: form.formState.isSubmitted });
  const date = useWatch({ control: form.control, name: 'date' });
  const setDate = (value: string) =>
    form.setValue('date', value, { shouldValidate: form.formState.isSubmitted });
  const method = useWatch({ control: form.control, name: 'method' });
  const setMethod = (value: PaymentMethod | '') =>
    form.setValue('method', value, { shouldValidate: form.formState.isSubmitted });
  const notes = useWatch({ control: form.control, name: 'notes' });
  const setNotes = (value: string) =>
    form.setValue('notes', value, { shouldValidate: form.formState.isSubmitted });
  const [error, setError] = useState('');
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async () => {
        const amountMinor = parseMoneyToMinor(amount);
        if (!amountMinor || !caseId || !payerClientId)
          return setError(t('finances.paymentInvalid'));
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
      })}
    >
      <FieldGroup>
        <Field
          label={<>{t('finances.case')}</>}
          required
          error={fieldError(form.formState.errors.caseId, t)}
        >
          <EntityPicker
            ref={(node) => form.register('caseId').ref(node)}
            required
            value={caseId}
            onValueChange={(value) => {
              setCaseId(value ?? '');
              setPayerClientId('');
            }}
            items={(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber }))}
            placeholder={t('agenda.fields.casePlaceholder')}
          />
        </Field>
        <Field
          label={<>{t('finances.payer')}</>}
          required
          error={fieldError(form.formState.errors.payerClientId, t)}
        >
          <EntityPicker
            ref={(node) => form.register('payerClientId').ref(node)}
            required
            disabled={!caseId}
            value={payerClientId}
            onValueChange={(value) => setPayerClientId(value ?? '')}
            items={(caseDetail.data?.clients ?? []).map((item) => ({
              value: item.clientId,
              label: item.fullName,
            }))}
            placeholder={t('finances.payerPlaceholder')}
          />
        </Field>
        <div className="settings-two-columns">
          <Field
            label={<>{t('finances.amount')}</>}
            required
            error={fieldError(form.formState.errors.amount, t)}
          >
            <Input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              ref={(node) => form.register('amount').ref(node)}
              aria-invalid={!!form.formState.errors.amount}
            />
          </Field>
          <Field
            label={<>{t('finances.paymentDate')}</>}
            required
            error={fieldError(form.formState.errors.date, t)}
          >
            <DatePicker
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              ref={(node) => form.register('date').ref(node)}
              aria-invalid={!!form.formState.errors.date}
            />
          </Field>
        </div>
        <Field
          label={<>{t('finances.method')}</>}
          error={form.formState.errors.method ? t('forms.invalid') : undefined}
        >
          <Select
            value={method}
            onValueChange={(value) => setMethod(value as PaymentMethod | '')}
            items={[
              { value: '', label: t('forms.notSpecified') },
              ...methods.map((value) => ({ value, label: t(`finances.methods.${value}`) })),
            ]}
          >
            <SelectTrigger>
              <SelectValue placeholder={undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[
                  { value: '', label: t('forms.notSpecified') },
                  ...methods.map((value) => ({ value, label: t(`finances.methods.${value}`) })),
                ].map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={<>{t('common.notes')}</>}
          error={form.formState.errors.notes ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            ref={(node) => form.register('notes').ref(node)}
            aria-invalid={!!form.formState.errors.notes}
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormDialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('finances.savePayment')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
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
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof expenseDraftSchema>>({
    resolver: zodResolver(expenseDraftSchema),
    defaultValues: {
      caseId: initial?.caseId ?? initialCaseId ?? '',
      clientId: initial?.clientId ?? '',
      amount: initial ? minorToInput(initial.amountMinor) : '',
      date: initial?.expenseDate ?? today(),
      type: initial?.expenseType ?? 'COURT_FEE',
      notes: initial?.notes ?? '',
    },
  });

  const caseId = useWatch({ control: form.control, name: 'caseId' });
  const setCaseId = (value: string) =>
    form.setValue('caseId', value, { shouldValidate: form.formState.isSubmitted });
  const clientId = useWatch({ control: form.control, name: 'clientId' });
  const setClientId = (value: string) =>
    form.setValue('clientId', value, { shouldValidate: form.formState.isSubmitted });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const setAmount = (value: string) =>
    form.setValue('amount', value, { shouldValidate: form.formState.isSubmitted });
  const date = useWatch({ control: form.control, name: 'date' });
  const setDate = (value: string) =>
    form.setValue('date', value, { shouldValidate: form.formState.isSubmitted });
  const type = useWatch({ control: form.control, name: 'type' });
  const setType = (value: ExpenseType) =>
    form.setValue('type', value, { shouldValidate: form.formState.isSubmitted });
  const notes = useWatch({ control: form.control, name: 'notes' });
  const setNotes = (value: string) =>
    form.setValue('notes', value, { shouldValidate: form.formState.isSubmitted });
  const [error, setError] = useState('');
  return (
    <DraftForm
      className="mt-4 grid gap-3.5"
      onSubmit={form.handleSubmit(async () => {
        const amountMinor = parseMoneyToMinor(amount);
        if (!amountMinor) return setError(t('finances.amountInvalid'));
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
      })}
    >
      <FieldGroup>
        <p className="muted">{t('finances.expenseHint')}</p>
        <div className="settings-two-columns">
          <Field
            label={<>{t('finances.case')}</>}
            error={fieldError(form.formState.errors.caseId, t)}
          >
            <EntityPicker
              value={caseId}
              onValueChange={(value) => setCaseId(value ?? '')}
              items={[
                { value: '', label: t('tasks.noCase') },
                ...(cases ?? []).map((item) => ({ value: item.id, label: item.internalNumber })),
              ]}
              placeholder={undefined}
            />
          </Field>
          <Field
            label={<>{t('finances.client')}</>}
            error={form.formState.errors.clientId ? t('forms.invalid') : undefined}
          >
            <EntityPicker
              value={clientId}
              onValueChange={(value) => setClientId(value ?? '')}
              items={[
                { value: '', label: t('tasks.noClient') },
                ...(clients ?? []).map((item) => ({ value: item.id, label: item.fullName })),
              ]}
              placeholder={undefined}
            />
          </Field>
        </div>
        <div className="settings-two-columns">
          <Field
            label={<>{t('finances.amount')}</>}
            required
            error={fieldError(form.formState.errors.amount, t)}
          >
            <Input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              ref={(node) => form.register('amount').ref(node)}
              aria-invalid={!!form.formState.errors.amount}
            />
          </Field>
          <Field
            label={<>{t('finances.expenseDate')}</>}
            required
            error={fieldError(form.formState.errors.date, t)}
          >
            <DatePicker
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              ref={(node) => form.register('date').ref(node)}
              aria-invalid={!!form.formState.errors.date}
            />
          </Field>
        </div>
        <Field
          label={<>{t('finances.expenseType')}</>}
          error={form.formState.errors.type ? t('forms.invalid') : undefined}
        >
          <Select
            value={type}
            onValueChange={(value) => setType(value as ExpenseType)}
            items={expenseTypes.map((value) => ({
              value,
              label: t(`finances.expenseTypes.${value}`),
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {expenseTypes
                  .map((value) => ({
                    value,
                    label: t(`finances.expenseTypes.${value}`),
                  }))
                  .map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={<>{t('common.notes')}</>}
          error={form.formState.errors.notes ? t('forms.invalid') : undefined}
        >
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            ref={(node) => form.register('notes').ref(node)}
            aria-invalid={!!form.formState.errors.notes}
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormDialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('finances.saveExpense')}
          </Button>
        </FormDialogFooter>
      </FieldGroup>
    </DraftForm>
  );
}
