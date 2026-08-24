import { useState } from 'react';
import type { CaseDto } from '../../../bridge/types';
import { useAddOpponent, useRemoveOpponent } from '../api/casesApi';

export function CasePartiesPanel({ caseDto }: { caseDto: CaseDto }) {
  const [fullName, setFullName] = useState('');
  const [legalCapacity, setLegalCapacity] = useState('');
  const add = useAddOpponent();
  const remove = useRemoveOpponent(caseDto.id);
  return (
    <div className="panel">
      <h3>الخصوم</h3>
      {!caseDto.opponents.length ? (
        <p>لا يوجد خصوم مسجلون.</p>
      ) : (
        <ul className="entity-list-rows">
          {caseDto.opponents.map((opponent) => (
            <li key={opponent.id}>
              <strong>{opponent.fullName}</strong>
              {opponent.legalCapacity && <span> · {opponent.legalCapacity}</span>}
              <button className="text-button" onClick={() => remove.mutate(opponent.id)}>
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (fullName.trim())
            add.mutate({ caseId: caseDto.id, fullName, legalCapacity: legalCapacity || undefined });
        }}
      >
        <label>
          اسم الخصم
          <input required value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label>
          الصفة
          <input value={legalCapacity} onChange={(event) => setLegalCapacity(event.target.value)} />
        </label>
        <button disabled={add.isPending}>إضافة خصم</button>
      </form>
      {add.isError && <p className="error">تعذر حفظ الخصم.</p>}
    </div>
  );
}
