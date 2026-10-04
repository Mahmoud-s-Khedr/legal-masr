import { useState } from 'react';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { asAppError, errorMessage } from '../../../bridge/errors';
import type {
  ClientDuplicateCandidate,
  PowerOfAttorneyDto,
  PowerOfAttorneyLawyerInput,
} from '../../../bridge/types';
import { useClientList, useCreateClient } from '../../clients/api/clientsApi';
import { ClientForm } from '../../clients/forms/ClientForm';
import type { ClientFormValues } from '../../clients/schemas/client.schema';

export function PowerOfAttorneyForm({
  powerOfAttorney,
  busy,
  onSubmit,
  onCancel,
}: {
  powerOfAttorney?: PowerOfAttorneyDto;
  busy: boolean;
  onSubmit: (input: {
    internalSequence: string;
    officialNumber?: string;
    issueYear?: number;
    issueDate?: string;
    notaryOffice?: string;
    notes?: string;
    clientIds: string[];
    lawyers: PowerOfAttorneyLawyerInput[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const clients = useClientList({});
  const [selectedClientIds, setSelectedClientIds] = useState(
    powerOfAttorney?.clients.map((client) => client.id) ?? [],
  );
  const [lawyers, setLawyers] = useState<PowerOfAttorneyLawyerInput[]>(
    powerOfAttorney?.lawyers.map((lawyer) => ({
      id: lawyer.id,
      fullName: lawyer.fullName,
      barNumber: lawyer.barNumber ?? undefined,
      notes: lawyer.notes ?? undefined,
    })) ?? [],
  );
  const [lawyerName, setLawyerName] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [lawyerNotes, setLawyerNotes] = useState('');
  const [issueDate, setIssueDate] = useState(powerOfAttorney?.issueDate ?? '');
  const [clientCreateOpen, setClientCreateOpen] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const date = String(data.get('issueDate') ?? '').trim();
        if (busy) return;
        try {
          await onSubmit({
            internalSequence: String(data.get('internalSequence') ?? '').trim(),
            officialNumber: String(data.get('officialNumber') ?? '').trim() || undefined,
            // Keep the legacy summary year in sync without asking the user for the same fact twice.
            issueYear: date ? Number(date.slice(0, 4)) : undefined,
            issueDate: date || undefined,
            notaryOffice: String(data.get('notaryOffice') ?? '').trim() || undefined,
            notes: String(data.get('notes') ?? '').trim() || undefined,
            clientIds: selectedClientIds,
            lawyers,
          });
        } catch {
          // The parent mutation displays the failure; keep all entered values.
        }
      }}
    >
      <div className="settings-two-columns">
        <label>
          الرقم الداخلي{' '}
          <Input
            required
            dir="ltr"
            name="internalSequence"
            defaultValue={powerOfAttorney?.internalSequence ?? ''}
          />
        </label>
        <label>
          رقم التوكيل{' '}
          <Input
            dir="ltr"
            name="officialNumber"
            defaultValue={powerOfAttorney?.officialNumber ?? ''}
          />
        </label>
        <label>
          تاريخ الإصدار{' '}
          <DatePicker
            name="issueDate"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
        </label>
      </div>
      <label>
        مكتب التوثيق{' '}
        <Input name="notaryOffice" defaultValue={powerOfAttorney?.notaryOffice ?? ''} />
      </label>
      <fieldset>
        <legend>الموكلون</legend>
        <Button
          type="button"
          variant="secondary"
          className="secondary-button compact-button"
          onClick={() => setClientCreateOpen(true)}
        >
          إضافة موكل جديد
        </Button>
        {!clients.data?.length ? (
          <p className="muted">اختر موكلًا موجودًا أو أضف موكلًا جديدًا لربطه بالتوكيل.</p>
        ) : (
          clients.data.map((client) => (
            <div className="checkbox-field" key={client.id}>
              <Checkbox
                aria-label={client.fullName}
                checked={selectedClientIds.includes(client.id)}
                onCheckedChange={(checked) =>
                  setSelectedClientIds((current) =>
                    checked ? [...current, client.id] : current.filter((id) => id !== client.id),
                  )
                }
              />
              {client.fullName} · <bdi>{client.internalNumber}</bdi>
            </div>
          ))
        )}
      </fieldset>
      <InlineClientCreateDialog
        open={clientCreateOpen}
        onOpenChange={setClientCreateOpen}
        onCreated={(clientId) =>
          setSelectedClientIds((current) =>
            current.includes(clientId) ? current : [...current, clientId],
          )
        }
      />
      <fieldset>
        <legend>المحامون المذكورون في التوكيل</legend>
        <div className="settings-two-columns">
          <label>
            الاسم{' '}
            <Input value={lawyerName} onChange={(event) => setLawyerName(event.target.value)} />
          </label>
          <label>
            رقم القيد{' '}
            <Input
              dir="ltr"
              value={barNumber}
              onChange={(event) => setBarNumber(event.target.value)}
            />
          </label>
        </div>
        <label>
          ملاحظات{' '}
          <Input value={lawyerNotes} onChange={(event) => setLawyerNotes(event.target.value)} />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="secondary-button compact-button"
          onClick={() => {
            if (!lawyerName.trim()) return;
            setLawyers((current) => [
              ...current,
              {
                fullName: lawyerName.trim(),
                barNumber: barNumber || undefined,
                notes: lawyerNotes || undefined,
              },
            ]);
            setLawyerName('');
            setBarNumber('');
            setLawyerNotes('');
          }}
        >
          إضافة محامٍ
        </Button>
        {lawyers.length > 0 && (
          <ul className="compact-records">
            {lawyers.map((lawyer, index) => (
              <li key={`${lawyer.id ?? 'new'}-${index}`}>
                <div className="record-copy">
                  <strong>{lawyer.fullName}</strong>
                  <span>
                    {lawyer.barNumber ? <bdi>{lawyer.barNumber}</bdi> : 'دون رقم قيد'}
                    {lawyer.notes && ` · ${lawyer.notes}`}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="text-button danger-button"
                  onClick={() =>
                    setLawyers((current) =>
                      current.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  إزالة
                </Button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <label>
        ملاحظات <Textarea name="notes" defaultValue={powerOfAttorney?.notes ?? ''} />
      </label>
      <div className="form-actions">
        <Button disabled={busy}>حفظ التوكيل</Button>
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

function InlineClientCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (clientId: string) => void;
}) {
  const createClient = useCreateClient();
  const [duplicates, setDuplicates] = useState<ClientDuplicateCandidate[] | null>(null);
  const [pendingValues, setPendingValues] = useState<ClientFormValues | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const close = () => {
    setDuplicates(null);
    setPendingValues(null);
    setCreateError(null);
    onOpenChange(false);
  };
  const submit = async (values: ClientFormValues, confirmDuplicate: boolean) => {
    setDuplicates(null);
    setCreateError(null);
    try {
      const client = await createClient.mutateAsync({ ...values, confirmDuplicate });
      onCreated(client.id);
      close();
    } catch (error) {
      const appError = asAppError(error);
      if (appError?.code === 'CLIENT_PROBABLE_DUPLICATE') {
        setDuplicates((appError.details as ClientDuplicateCandidate[]) ?? []);
        setPendingValues(values);
        return;
      }
      setCreateError(errorMessage(error, 'تعذر حفظ الموكل.'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      title="إضافة موكل جديد"
    >
      <ClientForm
        busy={createClient.isPending}
        submitLabel="حفظ الموكل وربطه بالتوكيل"
        onCancel={close}
        onSubmit={(values) => submit(values, false)}
      />
      {createError && (
        <p className="error" role="alert">
          {createError}
        </p>
      )}
      {duplicates && (
        <div className="warning" role="alert">
          <p>قد يكون هذا الموكل مسجلًا بالفعل.</p>
          <ul>
            {duplicates.map((candidate) => (
              <li key={candidate.id}>
                {candidate.fullName}
                {candidate.primaryPhone ? ` — ${candidate.primaryPhone}` : ''}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            disabled={createClient.isPending}
            onClick={() => pendingValues && submit(pendingValues, true)}
          >
            إنشاء الموكل وربطه بالتوكيل
          </Button>
        </div>
      )}
    </Dialog>
  );
}
