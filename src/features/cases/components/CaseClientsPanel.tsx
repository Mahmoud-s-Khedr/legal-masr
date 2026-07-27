import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../../../bridge/errors';
import type { CaseDto } from '../../../bridge/types';
import { useClientList } from '../../clients/api/clientsApi';
import { useAttachClient, useDetachClient, useSetPrimaryClient } from '../api/casesApi';

export function CaseClientsPanel({ caseDto }: { caseDto: CaseDto }) {
  const { t } = useTranslation();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [error, setError] = useState('');
  const { data: allClients } = useClientList({ includeArchived: false });
  const attachClient = useAttachClient();
  const detachClient = useDetachClient();
  const setPrimaryClient = useSetPrimaryClient();

  const attachedIds = new Set(caseDto.clients.map((c) => c.clientId));
  const attachableClients = (allClients ?? []).filter((client) => !attachedIds.has(client.id));

  const withErrorHandling = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, t('app.defaultError')));
    }
  };

  return (
    <div className="panel">
      <h3>{t('cases.clientsPanel.title')}</h3>
      <ul className="entity-list-rows">
        {caseDto.clients.map((client) => (
          <li key={client.clientId}>
            {client.displayName}
            {client.isPrimary && (
              <span className="badge">{t('cases.clientsPanel.primaryBadge')}</span>
            )}
            {!client.isPrimary && (
              <button
                className="text-button"
                onClick={() =>
                  withErrorHandling(() =>
                    setPrimaryClient.mutateAsync({ caseId: caseDto.id, clientId: client.clientId }),
                  )
                }
              >
                {t('cases.clientsPanel.setPrimary')}
              </button>
            )}
            <button
              className="text-button"
              onClick={() =>
                withErrorHandling(() =>
                  detachClient.mutateAsync({ caseId: caseDto.id, clientId: client.clientId }),
                )
              }
            >
              {t('cases.clientsPanel.detach')}
            </button>
          </li>
        ))}
      </ul>
      {attachableClients.length > 0 && (
        <div className="form-actions">
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="" disabled>
              {t('cases.clientsPanel.attach')}
            </option>
            {attachableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedClientId}
            onClick={() =>
              withErrorHandling(async () => {
                await attachClient.mutateAsync({
                  caseId: caseDto.id,
                  clientId: selectedClientId,
                  makePrimary: false,
                });
                setSelectedClientId('');
              })
            }
          >
            {t('cases.clientsPanel.attach')}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
