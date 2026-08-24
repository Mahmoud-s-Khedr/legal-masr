import type { CaseDto } from '../../../bridge/types';

export function CaseClientsPanel({ caseDto }: { caseDto: CaseDto }) {
  return (
    <div className="panel">
      <h3>موكلو القضية</h3>
      <ul className="entity-list-rows">
        {caseDto.clients.map((client) => (
          <li key={client.clientId}>
            <strong>{client.fullName}</strong>{' '}
            <span className="muted">{client.internalNumber}</span>
            {client.legalCapacity && <span> · {client.legalCapacity}</span>}
            {client.powerOfAttorneyId && <span className="badge">توكيل مرتبط</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
