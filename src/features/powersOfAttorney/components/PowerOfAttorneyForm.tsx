import { useState } from 'react';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import type { PowerOfAttorneyDto, PowerOfAttorneyLawyerInput } from '../../../bridge/types';
import { useClientList } from '../../clients/api/clientsApi';

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

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const date = String(data.get('issueDate') ?? '').trim();
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
        {!clients.data?.length ? (
          <p className="muted">أضف موكلًا أولًا لربطه بالتوكيل.</p>
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
