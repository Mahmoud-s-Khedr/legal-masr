import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClientList } from '../../clients/api/clientsApi';
import { useCaseList } from '../../cases/api/casesApi';
import { useCompleteTask, useReopenTask, useSaveTask, useTaskList } from '../api/tasksApi';

export function TasksPage() {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [filterPriority, setFilterPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | ''>(
    '',
  );
  const [status, setStatus] = useState<'OPEN' | 'COMPLETED' | 'CANCELLED' | ''>('');
  const [searchParams] = useSearchParams();
  const linkedCaseId = searchParams.get('case') ?? '';
  const linkedClientId = searchParams.get('client') ?? '';
  const [formCaseId, setFormCaseId] = useState(linkedCaseId);
  const [formClientId, setFormClientId] = useState(linkedClientId);
  const [filterCaseId, setFilterCaseId] = useState(linkedCaseId);
  const [filterClientId, setFilterClientId] = useState(linkedClientId);
  const clients = useClientList({});
  const cases = useCaseList({});
  const { data = [], isLoading } = useTaskList({
    caseId: filterCaseId || undefined,
    clientId: filterClientId || undefined,
    priority: filterPriority || undefined,
    status: status || undefined,
  });
  const save = useSaveTask();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const selectedTaskId = searchParams.get('task');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      save.mutate(
        {
          title,
          priority: newPriority,
          dueDate: dueDate || undefined,
          caseId: formCaseId || undefined,
          clientId: formClientId || undefined,
        },
        {
          onSuccess: () => {
            setTitle('');
            setDueDate('');
          },
        },
      );
  };
  const open = data.filter((task) => task.status === 'OPEN');
  const closed = data.filter((task) => task.status !== 'OPEN');
  return (
    <section className="work-page">
      <header className="page-heading">
        <div>
          <p className="kicker">المهام</p>
          <h2>مهامي اليومية</h2>
          <p>التقط المتابعة فورًا ثم أتمّها من نفس السجل، من دون إسنادها إلى أي مستخدم آخر.</p>
        </div>
      </header>
      <form className="quick-entry task-entry" onSubmit={submit}>
        <div>
          <label htmlFor="task-title">عنوان المهمة</label>
          <input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: مراجعة ملف الدعوى"
            required
          />
        </div>
        <div>
          <label htmlFor="task-date">تاريخ الاستحقاق</label>
          <input
            id="task-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        <label>
          الأولوية
          <select
            value={newPriority}
            onChange={(event) => setNewPriority(event.target.value as typeof newPriority)}
          >
            <option value="LOW">منخفضة</option>
            <option value="NORMAL">عادية</option>
            <option value="HIGH">عالية</option>
            <option value="URGENT">عاجلة</option>
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
          الموكل (اختياري)
          <select value={formClientId} onChange={(event) => setFormClientId(event.target.value)}>
            <option value="">بدون موكل مباشر</option>
            {clients.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <button>إضافة مهمة</button>
      </form>
      <div className="work-summary">
        <label>
          حالة العرض
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="">الكل</option>
            <option value="OPEN">مفتوحة</option>
            <option value="COMPLETED">مكتملة</option>
            <option value="CANCELLED">ملغاة</option>
          </select>
        </label>
        <label>
          الأولوية
          <select
            value={filterPriority}
            onChange={(event) => setFilterPriority(event.target.value as typeof filterPriority)}
          >
            <option value="">كل الأولويات</option>
            <option value="URGENT">عاجلة</option>
            <option value="HIGH">عالية</option>
            <option value="NORMAL">عادية</option>
            <option value="LOW">منخفضة</option>
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
        <label>
          الموكل
          <select
            value={filterClientId}
            onChange={(event) => setFilterClientId(event.target.value)}
          >
            <option value="">كل الموكلين</option>
            {clients.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <span>
          <strong>{open.length}</strong> مفتوحة
        </span>
        <span>
          <strong>{closed.length}</strong> مكتملة أو ملغاة
        </span>
      </div>
      {isLoading ? (
        <p className="table-message">جارٍ التحميل…</p>
      ) : (
        <section className="work-register">
          <div className="register-heading">
            <div>
              <p className="kicker">المتابعة الحالية</p>
              <h3>قائمة المهام</h3>
            </div>
          </div>
          {!data.length ? (
            <p className="table-message">لا توجد مهام بعد. أضف أول متابعة لليوم.</p>
          ) : (
            <ul className="record-list">
              {data.map((task) => (
                <li className={task.id === selectedTaskId ? 'selected-record' : ''} key={task.id}>
                  <div
                    className={`task-status ${task.status === 'OPEN' ? 'open' : 'done'}`}
                    aria-hidden="true"
                  />
                  <div className="record-copy">
                    <strong>{task.title}</strong>
                    <span>
                      {task.dueDate ?? 'بدون تاريخ استحقاق'} · {task.priority}
                      {task.caseId
                        ? ` · قضية ${cases.data?.find((item) => item.id === task.caseId)?.caseNumber ?? ''}`
                        : ''}
                    </span>
                  </div>
                  {task.status === 'OPEN' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => complete.mutate(task.id)}
                    >
                      إتمام
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => reopen.mutate(task.id)}
                    >
                      إعادة فتح
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {(save.isError || complete.isError || reopen.isError) && (
        <p className="error" role="alert">
          تعذر تحديث المهمة. لم تُحذف بياناتك المدخلة.
        </p>
      )}
    </section>
  );
}
