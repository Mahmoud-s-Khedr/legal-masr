import { useState } from 'react';
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

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const number = String(data.get('issueYear') ?? '').trim();
        await onSubmit({
          internalSequence: String(data.get('internalSequence') ?? '').trim(),
          officialNumber: String(data.get('officialNumber') ?? '').trim() || undefined,
          issueYear: number ? Number(number) : undefined,
          issueDate: String(data.get('issueDate') ?? '') || undefined,
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
          <input
            required
            dir="ltr"
            name="internalSequence"
            defaultValue={powerOfAttorney?.internalSequence ?? ''}
          />
        </label>
        <label>
          رقم التوكيل{' '}
          <input
            dir="ltr"
            name="officialNumber"
            defaultValue={powerOfAttorney?.officialNumber ?? ''}
          />
        </label>
        <label>
          سنة الإصدار{' '}
          <input
            type="number"
            min="1900"
            max="9999"
            dir="ltr"
            name="issueYear"
            defaultValue={powerOfAttorney?.issueYear ?? ''}
          />
        </label>
        <label>
          تاريخ الإصدار{' '}
          <input type="date" name="issueDate" defaultValue={powerOfAttorney?.issueDate ?? ''} />
        </label>
      </div>
      <label>
        مكتب التوثيق{' '}
        <input name="notaryOffice" defaultValue={powerOfAttorney?.notaryOffice ?? ''} />
      </label>
      <fieldset>
        <legend>الموكلون</legend>
        {!clients.data?.length ? (
          <p className="muted">أضف موكلًا أولًا لربطه بالتوكيل.</p>
        ) : (
          clients.data.map((client) => (
            <label className="checkbox-field" key={client.id}>
              <input
                type="checkbox"
                checked={selectedClientIds.includes(client.id)}
                onChange={(event) =>
                  setSelectedClientIds((current) =>
                    event.target.checked
                      ? [...current, client.id]
                      : current.filter((id) => id !== client.id),
                  )
                }
              />
              {client.fullName} · <bdi>{client.internalNumber}</bdi>
            </label>
          ))
        )}
      </fieldset>
      <fieldset>
        <legend>المحامون المذكورون في التوكيل</legend>
        <div className="settings-two-columns">
          <label>
            الاسم{' '}
            <input value={lawyerName} onChange={(event) => setLawyerName(event.target.value)} />
          </label>
          <label>
            رقم القيد{' '}
            <input
              dir="ltr"
              value={barNumber}
              onChange={(event) => setBarNumber(event.target.value)}
            />
          </label>
        </div>
        <label>
          ملاحظات{' '}
          <input value={lawyerNotes} onChange={(event) => setLawyerNotes(event.target.value)} />
        </label>
        <button
          type="button"
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
        </button>
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
                <button
                  type="button"
                  className="text-button danger-button"
                  onClick={() =>
                    setLawyers((current) =>
                      current.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  إزالة
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <label>
        ملاحظات <textarea name="notes" defaultValue={powerOfAttorney?.notes ?? ''} />
      </label>
      <div className="form-actions">
        <button disabled={busy}>حفظ التوكيل</button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
