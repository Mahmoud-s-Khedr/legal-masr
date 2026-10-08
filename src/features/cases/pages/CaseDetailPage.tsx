import { DraftForm } from '@/components/forms/DraftForm';
import { actionableErrorMessage } from '@/bridge/errors';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { feeDraftSchema } from '@/lib/formSchemas';
import { AmountInput } from '@/components/forms/AmountInput';
import { FieldGroup } from '@/components/ui/field';
import { Field } from '@/components/forms/FormField';
import { dateOnlyToLocalDate, localDateOnly } from '../../../lib/dateOnly';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { ExpenseDto, HearingDto, PaymentDto, TaskDto } from '../../../bridge/types';
import { Fact, RecordHeader } from '../../../components/layout/RecordHeader';
import { ConfirmDialog, FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';

import { useFormat } from '../../../i18n/LocalePresentation';
import { minorToInput, parseMoneyToMinor } from '../../../lib/money';
import { AttachmentPanel } from '../../documents/components/AttachmentPanel';
import {
  useCaseFinanceSummary,
  useExpenses,
  usePayments,
  useSaveExpense,
  useSaveFeeAgreement,
  useSavePayment,
} from '../../finances/api/financesApi';
import { DecisionForm, HearingForm } from '../../hearings/pages/AgendaPage';
import {
  useHearings,
  useRecordHearingDecision,
  useSaveHearing,
} from '../../hearings/api/hearingsApi';
import { TaskForm } from '../../tasks/pages/TasksPage';
import { useCompleteTask, useReopenTask, useSaveTask, useTaskList } from '../../tasks/api/tasksApi';
import { useCaseList } from '../api/casesApi';
import { useClientList } from '../../clients/api/clientsApi';
import {
  DeleteTransactionButton,
  ExpenseForm,
  PaymentForm,
} from '../../finances/pages/FinancesPage';
import { useArchiveCase, useCase, useRestoreCase, useUpdateCase } from '../api/casesApi';
import { CaseClientsPanel } from '../components/CaseClientsPanel';
import { CaseStatusBadge, OfficialReference } from '../components/CaseIdentity';
import { CasePartiesPanel } from '../components/CasePartiesPanel';
import { CaseEditForm } from '../forms/CaseEditForm';

export function CaseDetailPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { id = '' } = useParams();
  const [tab, setTab] = useState<
    'summary' | 'relationships' | 'hearings' | 'tasks' | 'attachments' | 'account'
  >('summary');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [caseFeedback, setCaseFeedback] = useState('');
  const [taskEditor, setTaskEditor] = useState<TaskDto | 'new' | null>(null);
  const [hearingEditor, setHearingEditor] = useState<HearingDto | 'new' | null>(null);
  const [hearingDecision, setHearingDecision] = useState<HearingDto | null>(null);
  const [transactionEditor, setTransactionEditor] = useState<
    | { type: 'payment'; value?: PaymentDto; inspect?: boolean }
    | { type: 'expense'; value?: ExpenseDto; inspect?: boolean }
    | null
  >(null);
  const feeForm = useForm<{ amount: string }>({
    resolver: zodResolver(feeDraftSchema),
    defaultValues: { amount: '' },
  });
  const fee = useWatch({ control: feeForm.control, name: 'amount' });
  const [feeError, setFeeError] = useState('');
  const item = useCase(id);
  const hearings = useHearings({ caseId: id });
  const tasks = useTaskList({ view: 'ALL', referenceDate: '9999-12-31', caseId: id });
  const account = useCaseFinanceSummary(id);
  useEffect(() => {
    if (account.data && !feeForm.formState.isDirty)
      feeForm.reset({
        amount: account.data.agreedFeeMinor ? minorToInput(account.data.agreedFeeMinor) : '',
      });
  }, [account.data, feeForm]);
  const payments = usePayments({ caseId: id });
  const expenses = useExpenses({ caseId: id });
  const cases = useCaseList({});
  const clients = useClientList({});
  const archive = useArchiveCase();
  const restore = useRestoreCase();
  const update = useUpdateCase();
  const saveFee = useSaveFeeAgreement();
  const savePayment = useSavePayment();
  const saveExpense = useSaveExpense();
  const saveTask = useSaveTask();
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const saveHearing = useSaveHearing();
  const recordDecision = useRecordHearingDecision();
  if (item.isLoading)
    return (
      <p className="page-status" role="status">
        {t('records.loading')}
      </p>
    );
  if (item.isError)
    return (
      <Alert variant="destructive" className="page-status error">
        <AlertDescription>{t('records.loadError')}</AlertDescription>
      </Alert>
    );
  if (!item.data) return <p className="page-status">{t('cases.detail.notFound')}</p>;
  const caseDto = item.data;
  const today = localDateOnly();
  const sortedHearings = [...(hearings.data ?? [])].sort((a, b) =>
    `${b.hearingDate}${b.hearingTime ?? ''}`.localeCompare(
      `${a.hearingDate}${a.hearingTime ?? ''}`,
    ),
  );
  const nextHearing = [...(hearings.data ?? [])]
    .filter((hearing) => hearing.status === 'SCHEDULED')
    .sort((a, b) =>
      `${a.hearingDate}${a.hearingTime ?? ''}`.localeCompare(
        `${b.hearingDate}${b.hearingTime ?? ''}`,
      ),
    )[0];
  const lastDecision = sortedHearings.find((hearing) => hearing.decisionText);
  const openTasks = (tasks.data ?? []).filter((task) => !task.completed);
  const sortedTasks = [...(tasks.data ?? [])].sort(
    (a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate),
  );
  const agreed = account.data?.agreedFeeMinor ?? 0;
  // An archived case is read-only until it is restored.
  const readOnly = Boolean(caseDto.archivedAt);
  const feeValue = fee;

  return (
    <section className="entity-detail detail-workspace">
      {restore.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t('records.statusChangeError')}</AlertDescription>
        </Alert>
      )}
      {caseDto.archivedAt && (
        <Alert>
          <AlertDescription>{t('cases.detail.archivedNotice')}</AlertDescription>
        </Alert>
      )}
      <RecordHeader
        icon="cases"
        kicker={t('cases.detail.kicker')}
        title={<bdi>{caseDto.internalNumber}</bdi>}
        badges={<CaseStatusBadge status={caseDto.status} archived={!!caseDto.archivedAt} />}
        meta={
          <>
            <span>
              {caseDto.officialNumber ? (
                <OfficialReference
                  number={caseDto.officialNumber}
                  year={caseDto.officialYear}
                  judicialYear={caseDto.judicialYear}
                />
              ) : (
                t('cases.detail.noOfficialNumber')
              )}
            </span>
            {caseDto.courtName && (
              <span>
                <bdi dir="auto">{caseDto.courtName}</bdi>
              </span>
            )}
            {caseDto.clients.length > 0 && (
              <span>
                <bdi dir="auto">{caseDto.clients.map((client) => client.fullName).join('، ')}</bdi>
              </span>
            )}
          </>
        }
        actions={
          <>
            {!caseDto.archivedAt && (
              <Button
                type="button"
                onClick={() => {
                  update.reset();
                  setEditOpen(true);
                }}
              >
                {t('records.edit')}
              </Button>
            )}
            {caseDto.archivedAt ? (
              <Button
                variant="secondary"

                disabled={restore.isPending}
                onClick={() => restore.mutate(id)}
              >
                {t('records.restore')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmArchive(true)}>
                {t('records.archive')}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => ((value) => setTab(value as typeof tab))(String(value))}
      >
        <TabsList activateOnFocus aria-label={t('cases.detail.sectionsLabel')} variant="line">
          {[
            { id: 'summary', label: t('cases.detail.tabs.summary') },
            {
              id: 'relationships',
              label: t('cases.detail.tabs.relationships'),
              count: caseDto.clients.length + caseDto.opponents.length,
            },
            {
              id: 'hearings',
              label: t('cases.detail.tabs.hearings'),
              count: hearings.data?.length ?? 0,
            },
            { id: 'tasks', label: t('cases.detail.tabs.tasks'), count: openTasks.length },
            { id: 'attachments', label: t('cases.detail.tabs.attachments') },
            { id: 'account', label: t('cases.detail.tabs.account') },
          ].map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {caseFeedback && (
        <p className="success" role="status">
          {caseFeedback}
        </p>
      )}
      {tab === 'summary' && (
        <div className="case-summary-layout">
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('cases.detail.dataTitle')}</h3>
              {!caseDto.archivedAt && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    update.reset();
                    setEditOpen(true);
                  }}
                >
                  {t('cases.detail.editData')}
                </Button>
              )}
            </div>
            <dl className="facts">
              <Fact label={t('cases.fields.caseNumber')}>
                <bdi>{caseDto.internalNumber}</bdi>
              </Fact>
              <Fact label={t('cases.fields.officialNumber')}>
                {caseDto.officialNumber && (
                  <OfficialReference
                    number={caseDto.officialNumber}
                    year={caseDto.officialYear}
                    judicialYear={caseDto.judicialYear}
                  />
                )}
              </Fact>
              <Fact label={t('cases.fields.caseType')}>{caseDto.caseType}</Fact>
              <Fact label={t('cases.fields.litigationDegree')}>
                {caseDto.litigationDegree && t(`cases.degrees.${caseDto.litigationDegree}`)}
              </Fact>
              <Fact label={t('cases.fields.courtName')}>{caseDto.courtName}</Fact>
              <Fact label={t('cases.fields.circuitName')}>{caseDto.circuitName}</Fact>
              <Fact label={t('cases.fields.filedOn')}>
                {caseDto.filedOn && format.date(caseDto.filedOn)}
              </Fact>
              <Fact label={t('cases.fields.closedOn')}>
                {caseDto.closedOn && format.date(caseDto.closedOn)}
              </Fact>
              <Fact label={t('cases.fields.summary')} wide>
                {caseDto.subject && <span className="prewrap">{caseDto.subject}</span>}
              </Fact>
              {caseDto.notes && (
                <Fact label={t('cases.fields.notes')} wide>
                  <span className="prewrap">{caseDto.notes}</span>
                </Fact>
              )}
            </dl>
          </section>
          <div className="case-side-summary">
            <section className="detail-card next-event-card">
              <div className="card-title">
                <h3>
                  {nextHearing && nextHearing.hearingDate < today
                    ? t('cases.detail.awaitingDecision')
                    : t('cases.detail.nextHearing')}
                </h3>
              </div>
              {nextHearing ? (
                <>
                  <time dateTime={nextHearing.hearingDate}>
                    {format.dateLong(nextHearing.hearingDate)}
                  </time>
                  <strong>
                    {nextHearing.hearingTime
                      ? format.time(nextHearing.hearingTime)
                      : t('dashboard.allDay')}
                  </strong>
                  <span dir="auto">
                    {[nextHearing.hearingType, nextHearing.location, nextHearing.circuitName]
                      .filter(Boolean)
                      .join(' · ') || t('agenda.hearing')}
                  </span>
                  {nextHearing.requiredDocuments && (
                    <small className="preparation-context" dir="auto">
                      {t('dashboard.preparation')}: {nextHearing.requiredDocuments}
                    </small>
                  )}
                  {!readOnly && (
                    <div className="card-actions">
                      {nextHearing.hearingDate <= today && (
                        <Button
                          type="button"
                          onClick={() => {
                            recordDecision.reset();
                            setHearingDecision(nextHearing);
                          }}
                        >
                          {t('agenda.recordDecision')}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          saveHearing.reset();
                          setHearingEditor(nextHearing);
                        }}
                      >
                        {t('agenda.editHearing')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="muted">{t('cases.detail.noNextHearing')}</p>
                  {!readOnly && (
                    <div className="card-actions">
                      <Button
                        type="button"
                        onClick={() => {
                          saveHearing.reset();
                          setHearingEditor('new');
                        }}
                      >
                        {t('agenda.add')}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {lastDecision && (
                <div className="case-summary-text">
                  <span>
                    {t('cases.detail.lastDecision', {
                      date: format.date(lastDecision.hearingDate),
                    })}
                  </span>
                  <p className="prewrap" dir="auto">
                    {lastDecision.decisionText}
                  </p>
                </div>
              )}
            </section>
            <section className="detail-card">
              <div className="card-title">
                <h3>{t('cases.detail.accountTitle')}</h3>
                <Button
                  type="button"
                  variant="ghost"

                  onClick={() => setTab('account')}
                >
                  {t('dashboard.viewAll')}
                </Button>
              </div>
              <dl className="facts facts-compact">
                <Fact label={t('cases.detail.agreed')}>
                  <bdi>{format.money(agreed)}</bdi>
                </Fact>
                <Fact label={t('cases.detail.received')}>
                  <bdi>{format.money(account.data?.receivedMinor ?? 0)}</bdi>
                </Fact>
                <Fact label={t('cases.detail.outstanding')}>
                  <bdi>{format.money(account.data?.outstandingMinor ?? 0)}</bdi>
                </Fact>
                <Fact label={t('cases.detail.openTasks')}>{format.number(openTasks.length)}</Fact>
              </dl>
            </section>
          </div>
        </div>
      )}
      {tab === 'relationships' && (
        <div className="detail-stack">
          <CaseClientsPanel caseDto={caseDto} readOnly={readOnly} />
          <CasePartiesPanel caseDto={caseDto} readOnly={readOnly} />
        </div>
      )}
      {tab === 'hearings' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('cases.detail.tabs.hearings')}</h3>
            {!readOnly && (
              <Button
                type="button"
                onClick={() => {
                  saveHearing.reset();
                  setHearingEditor('new');
                }}
              >
                {t('agenda.add')}
              </Button>
            )}
          </div>
          {!sortedHearings.length ? (
            <p className="empty-compact">{t('cases.detail.noHearings')}</p>
          ) : (
            <ul className="timeline-list">
              {sortedHearings.map((hearing) => (
                <li key={hearing.id}>
                  <time dateTime={hearing.hearingDate}>
                    {format.date(hearing.hearingDate)}
                    <small>
                      {hearing.hearingTime
                        ? format.time(hearing.hearingTime)
                        : format.weekday(dateOnlyToLocalDate(hearing.hearingDate), 'long')}
                    </small>
                  </time>
                  <div>
                    <div className="timeline-title">
                      <strong dir="auto">{hearing.hearingType ?? t('agenda.hearing')}</strong>
                      <Badge variant="secondary">{t(`agenda.status.${hearing.status}`)}</Badge>
                    </div>
                    {(hearing.location || hearing.circuitName) && (
                      <span dir="auto">
                        {[hearing.location, hearing.circuitName].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {hearing.decisionText && (
                      <p className="prewrap" dir="auto">
                        <strong>{t('agenda.fields.decisionText')}: </strong>
                        {hearing.decisionText}
                      </p>
                    )}
                    <div className="row-actions">
                      {hearing.status === 'SCHEDULED' && !readOnly && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              saveHearing.reset();
                              setHearingEditor(hearing);
                            }}
                          >
                            {t('agenda.editHearing')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              recordDecision.reset();
                              setHearingDecision(hearing);
                            }}
                          >
                            {t('agenda.recordDecision')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'tasks' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('cases.detail.tabs.tasks')}</h3>
            {!readOnly && (
              <Button
                type="button"
                onClick={() => {
                  saveTask.reset();
                  setTaskEditor('new');
                }}
              >
                {t('tasks.add')}
              </Button>
            )}
          </div>
          {!sortedTasks.length ? (
            <p className="empty-compact">{t('cases.detail.noTasks')}</p>
          ) : (
            <ul className="work-rows">
              {sortedTasks.map((task) => {
                const overdue = !task.completed && task.dueDate < today;
                return (
                  <li
                    key={task.id}
                    className={task.completed ? 'is-done' : overdue ? 'is-overdue' : undefined}
                  >
                    <Checkbox
                      checked={task.completed}
                      disabled={readOnly || completeTask.isPending || reopenTask.isPending}
                      onCheckedChange={() =>
                        (task.completed ? reopenTask : completeTask).mutate(task.id)
                      }
                      aria-label={t(task.completed ? 'tasks.reopenAria' : 'tasks.completeAria', {
                        title: task.title,
                      })}
                    />
                    <div>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          saveTask.reset();
                          setTaskEditor(task);
                        }}
                      >
                        <bdi>{task.title}</bdi>
                      </button>
                      <span>{format.date(task.dueDate)}</span>
                    </div>
                    {overdue && <span className="row-meta">{t('tasks.overdue')}</span>}
                    {task.completed && <span className="row-meta">{t('tasks.completed')}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {(completeTask.isError || reopenTask.isError) && !taskEditor && (
            <Alert variant="destructive">
              <AlertDescription>{t('tasks.statusError')}</AlertDescription>
            </Alert>
          )}
        </section>
      )}
      {tab === 'attachments' && (
        <AttachmentPanel
          owner={{ caseId: id }}
          title={t('cases.detail.attachmentsTitle')}
          allowAdd={!readOnly}
          readOnly={readOnly}
        />
      )}
      {tab === 'account' && (
        <div className="detail-stack">
          <div className="finance-summary">
            <article>
              <span>{t('cases.detail.agreed')}</span>
              <strong>
                <bdi>{format.money(agreed)}</bdi>
              </strong>
            </article>
            <article>
              <span>{t('cases.detail.received')}</span>
              <strong>
                <bdi>{format.money(account.data?.receivedMinor ?? 0)}</bdi>
              </strong>
            </article>
            <article className="finance-net">
              <span>{t('cases.detail.outstanding')}</span>
              <strong>
                <bdi>{format.money(account.data?.outstandingMinor ?? 0)}</bdi>
              </strong>
            </article>
            <article>
              <span>{t('cases.detail.expenses')}</span>
              <strong>
                <bdi>{format.money(account.data?.expensesMinor ?? 0)}</bdi>
              </strong>
            </article>
          </div>
          <section className="detail-card">
            <div className="card-title">
              <div>
                <h3>{t('cases.detail.feeTitle')}</h3>
                <p className="card-note">{t('cases.detail.feeHint')}</p>
              </div>
            </div>
            <DraftForm
              className="inline-form"
              noValidate
              onSubmit={feeForm.handleSubmit(async () => {
                const amount = parseMoneyToMinor(feeValue);
                if (!amount) return setFeeError(t('cases.detail.feeInvalid'));
                setFeeError('');
                await saveFee
                  .mutateAsync(
                    { caseId: id, amountMinor: amount },
                    { onSuccess: () => feeForm.reset({ amount: feeValue }) },
                  )
                  .catch(() => undefined);
              })}
            >
              <FieldGroup className="inline-form-row">
                <Field
                  label={<>{t('cases.detail.feeLabel')}</>}
                  error={feeForm.formState.errors.amount ? t('cases.detail.feeInvalid') : undefined}
                >
                  <AmountInput
                    {...feeForm.register('amount')}
                    value={feeValue}
                    aria-invalid={!!feeForm.formState.errors.amount}
                    onChange={(event) => {
                      feeForm.setValue('amount', event.target.value, { shouldDirty: true });
                      saveFee.reset();
                    }}
                  />
                </Field>
                <Button type="submit" disabled={readOnly || saveFee.isPending}>
                  {t('cases.detail.feeSave')}
                </Button>
              </FieldGroup>
            </DraftForm>
            {feeError && (
              <Alert variant="destructive">
                <AlertDescription>{feeError}</AlertDescription>
              </Alert>
            )}
            {saveFee.isError && (
              <Alert variant="destructive">
                <AlertDescription>{t('cases.detail.feeSaveError')}</AlertDescription>
              </Alert>
            )}
            {saveFee.isSuccess && (
              <p className="success" role="status">
                {t('cases.detail.feeSaved')}
              </p>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('cases.detail.paymentsTitle')}</h3>
              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => {
                    savePayment.reset();
                    saveFee.reset();
                    setTransactionEditor({ type: 'payment' });
                  }}
                >
                  {t('cases.detail.addPayment')}
                </Button>
              )}
            </div>
            {!payments.data?.length ? (
              <p className="muted">{t('cases.detail.noPayments')}</p>
            ) : (
              <ul className="ledger-rows">
                {payments.data.map((payment) => (
                  <li key={payment.id}>
                    <button
                      type="button"
                      className="ledger-row"
                      onClick={() =>
                        setTransactionEditor({ type: 'payment', value: payment, inspect: true })
                      }
                    >
                      <span>{format.date(payment.paymentDate)}</span>
                      <span dir="auto">
                        {caseDto.clients.find((client) => client.clientId === payment.payerClientId)
                          ?.fullName ?? '—'}
                      </span>
                      <strong className="money-positive">
                        <bdi>{format.money(payment.amountMinor)}</bdi>
                      </strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('cases.detail.expensesTitle')}</h3>
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    saveExpense.reset();
                    saveFee.reset();
                    setTransactionEditor({ type: 'expense' });
                  }}
                >
                  {t('cases.detail.addExpense')}
                </Button>
              )}
            </div>
            {!expenses.data?.length ? (
              <p className="muted">{t('cases.detail.noExpenses')}</p>
            ) : (
              <ul className="ledger-rows">
                {expenses.data.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      className="ledger-row"
                      onClick={() =>
                        setTransactionEditor({ type: 'expense', value: expense, inspect: true })
                      }
                    >
                      <span>{format.date(expense.expenseDate)}</span>
                      <span dir="auto">
                        {t(`finances.expenseTypes.${expense.expenseType}`)}
                        {expense.notes && ` · ${expense.notes}`}
                      </span>
                      <strong className="money-negative">
                        <bdi>{format.money(expense.amountMinor)}</bdi>
                      </strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t('cases.detail.archiveTitle')}
        description={t('cases.detail.archiveDescription')}
        confirmLabel={t('cases.detail.archiveTitle')}
        cancelLabel={t('common.cancel')}
        pending={archive.isPending}
        error={archive.isError ? t('records.archiveError') : undefined}
        onConfirm={() => archive.mutate(id, { onSuccess: () => setConfirmArchive(false) })}
      />
      <FormDialog open={editOpen} onOpenChange={setEditOpen} title={t('cases.detail.editTitle')}>
        <CaseEditForm
          caseDto={caseDto}
          busy={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            try {
              await update.mutateAsync({
                id,
                ...values,
                officialYear: Number.isNaN(values.officialYear) ? undefined : values.officialYear,
                judicialYear: Number.isNaN(values.judicialYear) ? undefined : values.judicialYear,
                clients: caseDto.clients.map((client) => ({
                  clientId: client.clientId,
                  legalCapacity: client.legalCapacity ?? undefined,
                  powerOfAttorneyId: client.powerOfAttorneyId ?? undefined,
                  notes: client.notes ?? undefined,
                })),
              });
              setEditOpen(false);
              setCaseFeedback(t('records.saved'));
            } catch {
              // Keep the dialog and its draft available for retry.
            }
          }}
        />
        {update.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionableErrorMessage(update.error, t('records.saveRetry'))}
            </AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(taskEditor)}
        onOpenChange={(open) => !open && setTaskEditor(null)}
        title={taskEditor === 'new' ? t('tasks.add') : t('tasks.details')}
      >
        {taskEditor && (
          <TaskForm
            initial={taskEditor === 'new' ? undefined : taskEditor}
            initialCaseId={taskEditor === 'new' ? id : undefined}
            cases={cases.data ?? []}
            clients={clients.data ?? []}
            busy={saveTask.isPending}
            toggling={completeTask.isPending || reopenTask.isPending}
            onToggleCompletion={
              taskEditor === 'new'
                ? undefined
                : () =>
                    (taskEditor.completed ? reopenTask : completeTask).mutate(taskEditor.id, {
                      onSuccess: (updated) => setTaskEditor(updated),
                    })
            }
            onCancel={() => setTaskEditor(null)}
            onSave={async (input) => {
              try {
                await saveTask.mutateAsync(input);
                setTaskEditor(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        )}
        {saveTask.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionableErrorMessage(saveTask.error, t('tasks.saveError'))}
            </AlertDescription>
          </Alert>
        )}
        {(completeTask.isError || reopenTask.isError) && (
          <Alert variant="destructive">
            <AlertDescription>{t('tasks.statusError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(hearingEditor)}
        onOpenChange={(open) => !open && setHearingEditor(null)}
        title={hearingEditor === 'new' ? t('agenda.add') : t('agenda.editHearing')}
      >
        {hearingEditor && (
          <HearingForm
            initial={hearingEditor === 'new' ? undefined : hearingEditor}
            initialCaseId={id}
            initialDate={hearingEditor === 'new' ? localDateOnly() : hearingEditor.hearingDate}
            busy={saveHearing.isPending}
            onCancel={() => setHearingEditor(null)}
            onSave={async (input) => {
              try {
                await saveHearing.mutateAsync(input);
                setHearingEditor(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        )}
        {saveHearing.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionableErrorMessage(saveHearing.error, t('agenda.saveError'))}
            </AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(hearingDecision)}
        onOpenChange={(open) => !open && setHearingDecision(null)}
        title={t('agenda.recordDecision')}
      >
        {hearingDecision && (
          <DecisionForm
            hearing={hearingDecision}
            busy={recordDecision.isPending}
            onCancel={() => setHearingDecision(null)}
            onSave={async (input) => {
              try {
                await recordDecision.mutateAsync(input);
                setHearingDecision(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        )}
        {recordDecision.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t('agenda.decisionError')}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <FormDialog
        open={Boolean(transactionEditor)}
        onOpenChange={(open) => !open && setTransactionEditor(null)}
        title={
          transactionEditor?.inspect
            ? t(`cases.detail.inspect.${transactionEditor.type}`)
            : t(
                `cases.detail.${transactionEditor?.value ? 'editEntry' : 'newEntry'}.${transactionEditor?.type ?? 'payment'}`,
              )
        }
      >
        {transactionEditor?.inspect && transactionEditor.value ? (
          <CaseTransactionInspection
            transaction={
              transactionEditor.type === 'payment'
                ? { type: 'payment', value: transactionEditor.value as PaymentDto, inspect: true }
                : { type: 'expense', value: transactionEditor.value as ExpenseDto, inspect: true }
            }
            caseNumber={caseDto.internalNumber}
            clientName={
              transactionEditor.type === 'payment'
                ? caseDto.clients.find(
                    (client) =>
                      client.clientId === (transactionEditor.value as PaymentDto).payerClientId,
                  )?.fullName
                : clients.data?.find(
                    (client) => client.id === (transactionEditor.value as ExpenseDto).clientId,
                  )?.fullName
            }
            onClose={() => setTransactionEditor(null)}
            onEdit={
              readOnly
                ? undefined
                : () => setTransactionEditor({ ...transactionEditor, inspect: false })
            }
          />
        ) : transactionEditor?.type === 'payment' ? (
          <PaymentForm
            initial={transactionEditor.value}
            initialCaseId={id}
            cases={cases.data ?? []}
            busy={savePayment.isPending}
            onCancel={() => setTransactionEditor(null)}
            onSave={async (input) => {
              try {
                await savePayment.mutateAsync(input);
                setTransactionEditor(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
            }}
          />
        ) : transactionEditor?.type === 'expense' ? (
          <ExpenseForm
            initial={transactionEditor.value}
            initialCaseId={id}
            cases={cases.data ?? []}
            clients={clients.data ?? []}
            busy={saveExpense.isPending}
            onCancel={() => setTransactionEditor(null)}
            onSave={async (input) => {
              try {
                await saveExpense.mutateAsync(input);
                setTransactionEditor(null);
              } catch {
                // The dialog displays the mutation error and preserves the draft.
              }
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

function CaseTransactionInspection({
  transaction,
  caseNumber,
  clientName,
  onClose,
  onEdit,
}: {
  transaction:
    | { type: 'payment'; value: PaymentDto; inspect: true }
    | { type: 'expense'; value: ExpenseDto; inspect: true };
  caseNumber: string;
  clientName?: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const date =
    transaction.type === 'payment' ? transaction.value.paymentDate : transaction.value.expenseDate;
  return (
    <div className="mt-4 grid gap-3.5">
      <dl className="detail-definition-grid">
        <div>
          <dt>{t('cases.detail.entryDate')}</dt>
          <dd>
            <bdi>{format.date(date)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('tasks.case')}</dt>
          <dd>
            <bdi>{caseNumber}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('tasks.client')}</dt>
          <dd>{clientName ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('cases.detail.entryAmount')}</dt>
          <dd>
            <bdi>{format.money(transaction.value.amountMinor)}</bdi>
          </dd>
        </div>
      </dl>
      <div>
        <strong>{t('common.notes')}</strong>
        <p>{transaction.value.notes ?? '—'}</p>
      </div>
      <FormDialogFooter>
        {onEdit && (
          <Button type="button" onClick={onEdit}>
            {t('cases.detail.editEntryButton')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('records.close')}
        </Button>
        {onEdit && <DeleteTransactionButton entry={transaction} onDeleted={onClose} />}
      </FormDialogFooter>
    </div>
  );
}
