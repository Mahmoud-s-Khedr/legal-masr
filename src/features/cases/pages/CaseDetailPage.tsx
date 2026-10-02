import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ExpenseDto, HearingDto, PaymentDto, TaskDto } from '../../../bridge/types';
import { Dialog } from '../../../components/ui/Dialog';
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
import { ExpenseForm, parseMoneyToMinor, PaymentForm } from '../../finances/pages/FinancesPage';
import { useArchiveCase, useCase, useRestoreCase, useUpdateCase } from '../api/casesApi';
import { CaseClientsPanel } from '../components/CaseClientsPanel';
import { CasePartiesPanel } from '../components/CasePartiesPanel';
import { CaseEditForm } from '../forms/CaseEditForm';

const money = (amount: number) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount / 100);
export function CaseDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<
    'summary' | 'relationships' | 'hearings' | 'tasks' | 'attachments' | 'account'
  >('summary');
  const [editOpen, setEditOpen] = useState(false);
  const [caseFeedback, setCaseFeedback] = useState('');
  const [taskEditor, setTaskEditor] = useState<TaskDto | 'new' | null>(null);
  const [hearingEditor, setHearingEditor] = useState<HearingDto | 'new' | null>(null);
  const [hearingDecision, setHearingDecision] = useState<HearingDto | null>(null);
  const [transactionEditor, setTransactionEditor] = useState<
    | { type: 'payment'; value?: PaymentDto; inspect?: boolean }
    | { type: 'expense'; value?: ExpenseDto; inspect?: boolean }
    | null
  >(null);
  const [fee, setFee] = useState('');
  const item = useCase(id);
  const hearings = useHearings({ caseId: id });
  const tasks = useTaskList({ view: 'ALL', referenceDate: '9999-12-31', caseId: id });
  const account = useCaseFinanceSummary(id);
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
  if (item.isLoading) return <p>جارٍ التحميل…</p>;
  if (!item.data) return <p>القضية غير موجودة.</p>;
  const caseDto = item.data;
  const nextHearing = hearings.data?.find((hearing) => hearing.status === 'SCHEDULED');
  return (
    <section className="entity-detail">
      <header className="detail-hero">
        <div>
          <p className="kicker">قضية</p>
          <h2>
            <bdi>{caseDto.internalNumber}</bdi>
          </h2>
          <p>
            {caseDto.officialNumber ? (
              <bdi>{`${caseDto.officialNumber}${caseDto.officialYear ? ` / ${caseDto.officialYear}` : ''}`}</bdi>
            ) : (
              'لا يوجد رقم رسمي'
            )}
          </p>
        </div>
        <div className="detail-actions">
          <button type="button" onClick={() => setEditOpen(true)}>
            تعديل
          </button>
          {caseDto.archivedAt ? (
            <button onClick={() => restore.mutate(id)}>استعادة</button>
          ) : (
            <button className="secondary-button" onClick={() => archive.mutate(id)}>
              أرشفة
            </button>
          )}
        </div>
      </header>
      <nav className="detail-tabs">
        {(['summary', 'relationships', 'hearings', 'tasks', 'attachments', 'account'] as const).map(
          (value) => (
            <button
              key={value}
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              {
                {
                  summary: 'الملخص',
                  relationships: 'الأطراف',
                  hearings: 'الجلسات',
                  tasks: 'المهام',
                  attachments: 'المرفقات',
                  account: 'الحساب',
                }[value]
              }
            </button>
          ),
        )}
      </nav>
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <h3>بيانات القضية</h3>
            <dl>
              <dt>المحكمة</dt>
              <dd>{caseDto.courtName ?? '—'}</dd>
              <dt>الموضوع</dt>
              <dd>{caseDto.subject ?? '—'}</dd>
              <dt>الجلسة القادمة</dt>
              <dd>
                {nextHearing ? (
                  <bdi>{`${nextHearing.hearingDate} ${nextHearing.hearingTime ?? ''}`}</bdi>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
          </section>
        </div>
      )}
      {caseFeedback && (
        <p className="success" role="status">
          {caseFeedback}
        </p>
      )}
      {tab === 'relationships' && (
        <>
          <CaseClientsPanel caseDto={caseDto} />
          <CasePartiesPanel caseDto={caseDto} />
        </>
      )}
      {tab === 'hearings' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>الجلسات</h3>
            <button type="button" onClick={() => setHearingEditor('new')}>
              إضافة جلسة
            </button>
          </div>
          <ul>
            {hearings.data?.map((hearing) => (
              <li key={hearing.id}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHearingEditor(hearing)}
                >
                  <bdi>{hearing.hearingDate}</bdi> · {hearing.hearingType ?? 'جلسة'} ·{' '}
                  {hearing.status}
                </button>
                {hearing.status === 'SCHEDULED' && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setHearingDecision(hearing)}
                  >
                    تسجيل القرار
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'tasks' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>المهام</h3>
            <button type="button" onClick={() => setTaskEditor('new')}>
              إضافة مهمة
            </button>
          </div>
          <ul>
            {tasks.data?.map((task) => (
              <li key={task.id}>
                {task.completed ? '✓' : '○'}{' '}
                <button type="button" className="text-button" onClick={() => setTaskEditor(task)}>
                  {task.title}
                </button>{' '}
                · <bdi>{task.dueDate}</bdi>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'attachments' && <AttachmentPanel owner={{ caseId: id }} title="مرفقات القضية" />}
      {tab === 'account' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>الحساب</h3>
            <div>
              <button type="button" onClick={() => setTransactionEditor({ type: 'payment' })}>
                إضافة دفعة
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setTransactionEditor({ type: 'expense' })}
              >
                إضافة مصروف
              </button>
            </div>
          </div>
          <p>
            المتفق عليه: <bdi>{money(account.data?.agreedFeeMinor ?? 0)}</bdi> · المحصل:{' '}
            <bdi>{money(account.data?.receivedMinor ?? 0)}</bdi> · المتبقي:{' '}
            <bdi>{money(account.data?.outstandingMinor ?? 0)}</bdi> · المصروفات:{' '}
            <bdi>{money(account.data?.expensesMinor ?? 0)}</bdi>
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const amount = parseMoneyToMinor(fee);
              if (amount) saveFee.mutate({ caseId: id, amountMinor: amount });
            }}
          >
            <label>
              قيمة اتفاق الأتعاب (ج.م)
              <input
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <button>حفظ اتفاق الأتعاب</button>
          </form>
          <h4>الدفعات</h4>
          <ul className="entity-list-rows">
            {payments.data?.map((payment) => (
              <li key={payment.id}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setTransactionEditor({ type: 'payment', value: payment, inspect: true })
                  }
                >
                  <bdi>{payment.paymentDate}</bdi> · <bdi>{money(payment.amountMinor)}</bdi>
                </button>
              </li>
            ))}
          </ul>
          <h4>المصروفات</h4>
          <ul className="entity-list-rows">
            {expenses.data?.map((expense) => (
              <li key={expense.id}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setTransactionEditor({ type: 'expense', value: expense, inspect: true })
                  }
                >
                  <bdi>{expense.expenseDate}</bdi> · <bdi>{money(expense.amountMinor)}</bdi>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل بيانات القضية">
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
                clients: caseDto.clients.map((client) => ({
                  clientId: client.clientId,
                  legalCapacity: client.legalCapacity ?? undefined,
                  powerOfAttorneyId: client.powerOfAttorneyId ?? undefined,
                  notes: client.notes ?? undefined,
                })),
              });
              setEditOpen(false);
              setCaseFeedback('تم حفظ تعديلات القضية.');
            } catch {
              // Keep the dialog and its draft available for retry.
            }
          }}
        />
        {update.isError && (
          <p className="error" role="alert">
            تعذر حفظ تعديلات القضية. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(taskEditor)}
        onOpenChange={(open) => !open && setTaskEditor(null)}
        title={taskEditor === 'new' ? 'إضافة مهمة' : 'تفاصيل المهمة'}
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
                : () => (taskEditor.completed ? reopenTask : completeTask).mutate(taskEditor.id)
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
          <p className="error" role="alert">
            تعذر حفظ المهمة. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
        {(completeTask.isError || reopenTask.isError) && (
          <p className="error" role="alert">
            تعذر تغيير حالة المهمة. حاول مرة أخرى.
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(hearingEditor)}
        onOpenChange={(open) => !open && setHearingEditor(null)}
        title={hearingEditor === 'new' ? 'إضافة جلسة' : 'تعديل الجلسة'}
      >
        {hearingEditor && (
          <HearingForm
            initial={hearingEditor === 'new' ? undefined : hearingEditor}
            initialCaseId={id}
            initialDate={
              hearingEditor === 'new'
                ? new Date().toISOString().slice(0, 10)
                : hearingEditor.hearingDate
            }
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
          <p className="error" role="alert">
            تعذر حفظ الجلسة.
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(hearingDecision)}
        onOpenChange={(open) => !open && setHearingDecision(null)}
        title="تسجيل قرار الجلسة"
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
          <p className="error" role="alert">
            تعذر تسجيل القرار أو الجلسة التالية.
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(transactionEditor)}
        onOpenChange={(open) => !open && setTransactionEditor(null)}
        title={
          transactionEditor?.inspect
            ? `تفاصيل ${transactionEditor.type === 'payment' ? 'الدفعة' : 'المصروف'}`
            : `${transactionEditor?.value ? 'تعديل' : 'إضافة'} ${transactionEditor?.type === 'payment' ? 'دفعة' : 'مصروف'}`
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
            onEdit={() => setTransactionEditor({ ...transactionEditor, inspect: false })}
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
          <p className="error" role="alert">
            تعذر حفظ السجل المالي. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
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
  onEdit: () => void;
}) {
  const date =
    transaction.type === 'payment' ? transaction.value.paymentDate : transaction.value.expenseDate;
  return (
    <div className="dialog-form">
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
            <bdi>{caseNumber}</bdi>
          </dd>
        </div>
        <div>
          <dt>الموكل</dt>
          <dd>{clientName ?? '—'}</dd>
        </div>
        <div>
          <dt>المبلغ</dt>
          <dd>
            <bdi>{money(transaction.value.amountMinor)}</bdi>
          </dd>
        </div>
      </dl>
      <div>
        <strong>ملاحظات</strong>
        <p>{transaction.value.notes ?? '—'}</p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          إغلاق
        </button>
        <button type="button" onClick={onEdit}>
          تعديل السجل
        </button>
      </div>
    </div>
  );
}
