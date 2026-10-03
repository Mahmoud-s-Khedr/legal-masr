import { useState } from 'react';
import type { CaseDto, CaseOpponentDto, CaseOpponentInput } from '../../../bridge/types';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { useAddOpponent, useRemoveOpponent, useUpdateOpponent } from '../api/casesApi';

export function CasePartiesPanel({ caseDto }: { caseDto: CaseDto }) {
  const [editing, setEditing] = useState<CaseOpponentDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<CaseOpponentDto | null>(null);
  const add = useAddOpponent();
  const update = useUpdateOpponent(caseDto.id);
  const remove = useRemoveOpponent(caseDto.id);
  return (
    <div className="panel">
      <div className="card-title">
        <h3>الخصوم</h3>
        <Button type="button" onClick={() => setEditing('new')}>
          إضافة خصم
        </Button>
      </div>
      {!caseDto.opponents.length ? (
        <p>لا يوجد خصوم مسجلون.</p>
      ) : (
        <ul className="entity-list-rows">
          {caseDto.opponents.map((opponent) => (
            <li key={opponent.id}>
              <strong>{opponent.fullName}</strong>
              {opponent.legalCapacity && <span> · {opponent.legalCapacity}</span>}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() => setEditing(opponent)}
                >
                  تعديل
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button danger-button"
                  onClick={() => setRemoving(opponent)}
                >
                  إزالة
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? 'إضافة خصم' : 'تعديل بيانات الخصم'}
      >
        {editing && (
          <OpponentForm
            initial={editing === 'new' ? undefined : editing}
            busy={add.isPending || update.isPending}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === 'new') await add.mutateAsync({ caseId: caseDto.id, ...input });
              else await update.mutateAsync({ id: editing.id, ...input });
              setEditing(null);
            }}
          />
        )}
        {(add.isError || update.isError) && (
          <p className="error" role="alert">
            تعذر حفظ الخصم. بقيت البيانات للمحاولة مرة أخرى.
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="إزالة الخصم"
        description="سيُزال الخصم من هذه القضية فقط."
        confirmLabel="إزالة"
        cancelLabel="إلغاء"
        destructive
        onConfirm={() =>
          removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
      {remove.isError && (
        <p className="error" role="alert">
          تعذرت إزالة الخصم. حاول مرة أخرى.
        </p>
      )}
    </div>
  );
}

function OpponentForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: CaseOpponentDto;
  busy: boolean;
  onSave: (input: Omit<CaseOpponentInput, 'caseId'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [legalCapacity, setLegalCapacity] = useState(initial?.legalCapacity ?? '');
  const [lawyerName, setLawyerName] = useState(initial?.lawyerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <form
      className="dialog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await onSave({
            fullName: fullName.trim(),
            legalCapacity: legalCapacity || undefined,
            lawyerName: lawyerName || undefined,
            phone: phone || undefined,
            address: address || undefined,
            notes: notes || undefined,
          });
        } catch {
          // The parent mutation exposes an in-dialog retry message.
        }
      }}
    >
      <label>
        اسم الخصم
        <Input
          required
          autoFocus
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label>
        الصفة
        <Input value={legalCapacity} onChange={(event) => setLegalCapacity(event.target.value)} />
      </label>
      <label>
        المحامي
        <Input value={lawyerName} onChange={(event) => setLawyerName(event.target.value)} />
      </label>
      <label>
        الهاتف
        <Input
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <label>
        العنوان
        <Input value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label>
        ملاحظات
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={busy}>حفظ الخصم</Button>
      </div>
    </form>
  );
}
