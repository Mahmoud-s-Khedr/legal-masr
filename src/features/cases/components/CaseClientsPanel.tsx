import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { CaseDto } from '../../../bridge/types';

export function CaseClientsPanel({ caseDto }: { caseDto: CaseDto }) {
  const { t } = useTranslation();
  return (
    <section className="detail-card">
      <div className="card-title">
        <h3>{t('cases.clientsPanel.title')}</h3>
      </div>
      <ul className="compact-records">
        {caseDto.clients.map((client) => (
          <li key={client.clientId}>
            <div className="record-copy">
              <Link to={`/clients/${client.clientId}`} dir="auto">
                <bdi>{client.fullName}</bdi>
              </Link>
              <span>
                <bdi className="mono">{client.internalNumber}</bdi>
                {' · '}
                {client.legalCapacity ?? t('cases.clientsPanel.noCapacity')}
              </span>
            </div>
            {client.powerOfAttorneyId ? (
              <Link
                className="status-badge tone-active"
                to={`/powers-of-attorney/${client.powerOfAttorneyId}`}
              >
                {t('cases.clientsPanel.poaLinked')}
              </Link>
            ) : (
              <span className="status-badge tone-warning">{t('cases.clientsPanel.noPoa')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
