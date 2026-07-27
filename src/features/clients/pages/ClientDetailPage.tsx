import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import { useCaseList } from '../../cases/api/casesApi';
import { useArchiveClient, useClient, useRestoreClient, useUpdateClient } from '../api/clientsApi';
import { ClientForm } from '../forms/ClientForm';

export function ClientDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data: client, isLoading } = useClient(id);
  const { data: cases } = useCaseList({ clientId: id, includeArchived: true });
  const updateClient = useUpdateClient();
  const archiveClient = useArchiveClient();
  const restoreClient = useRestoreClient();

  if (isLoading) return <p>{t('clients.loading')}</p>;
  if (!client) return <p>{t('clients.detail.notFound')}</p>;

  return (
    <section className="entity-detail">
      <div className="entity-list-header">
        <h2>{client.displayName}</h2>
        {client.archivedAt ? (
          <button onClick={() => restoreClient.mutate(client.id)}>{t('clients.restore')}</button>
        ) : (
          <button onClick={() => archiveClient.mutate(client.id)}>{t('clients.archive')}</button>
        )}
      </div>

      <ClientForm
        defaultValues={{
          clientType: client.clientType,
          displayName: client.displayName,
          nationalId: client.nationalId ?? undefined,
          registrationNumber: client.registrationNumber ?? undefined,
          primaryPhone: client.primaryPhone ?? undefined,
          email: client.email ?? undefined,
          address: client.address ?? undefined,
          notes: client.notes ?? undefined,
        }}
        busy={updateClient.isPending}
        submitLabel={t('clients.save')}
        onSubmit={(values) =>
          updateClient.mutateAsync({ id: client.id, ...values }).then(() => undefined)
        }
      />
      {updateClient.isError && (
        <p className="error">{errorMessage(updateClient.error, t('app.defaultError'))}</p>
      )}

      <div className="panel">
        <h3>{t('clients.detail.casesTitle')}</h3>
        {!cases?.length ? (
          <p>{t('clients.detail.noCases')}</p>
        ) : (
          <ul className="entity-list-rows">
            {cases.map((caseSummary) => (
              <li key={caseSummary.id}>
                <Link to={`/cases/${caseSummary.id}`}>
                  {caseSummary.caseNumber}{' '}
                  <span className="badge">{t(`cases.status.${caseSummary.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
