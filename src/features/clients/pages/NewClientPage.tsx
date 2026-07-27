import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import type { AppError, ClientDuplicateCandidate } from '../../../bridge/types';
import { useCreateClient } from '../api/clientsApi';
import { ClientForm } from '../forms/ClientForm';
import type { ClientFormValues } from '../schemas/client.schema';

export function NewClientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createClient = useCreateClient();
  const [duplicates, setDuplicates] = useState<ClientDuplicateCandidate[] | null>(null);
  const [pendingValues, setPendingValues] = useState<ClientFormValues | null>(null);
  const submit = async (values: ClientFormValues, confirmDuplicate: boolean) => {
    setDuplicates(null);
    try {
      await createClient.mutateAsync({ ...values, confirmDuplicate });
      navigate('/clients');
    } catch (error) {
      const apiError = error as AppError;
      if (apiError?.code === 'CLIENT_PROBABLE_DUPLICATE') {
        setDuplicates((apiError.details as ClientDuplicateCandidate[]) ?? []);
        setPendingValues(values);
        return;
      }
      throw error;
    }
  };

  return (
    <section className="record-editor">
      <div className="page-heading">
        <div>
          <p className="kicker">{t('clients.editorKicker')}</p>
          <h2>{t('clients.newButton')}</h2>
          <p>{t('clients.editorDescription')}</p>
        </div>
      </div>
      <div className="editor-surface">
        <ClientForm
          busy={createClient.isPending}
          submitLabel={t('clients.save')}
          onCancel={() => navigate('/clients')}
          onSubmit={(values) => submit(values, false)}
        />
        {createClient.isError && !duplicates && (
          <p className="error" role="alert">
            {errorMessage(createClient.error, t('app.defaultError'))}
          </p>
        )}
        {duplicates && (
          <div className="warning" role="alert">
            <p>{t('clients.duplicateWarning')}</p>
            <ul>
              {duplicates.map((candidate) => (
                <li key={candidate.id}>
                  {candidate.displayName}
                  {candidate.primaryPhone ? ` — ${candidate.primaryPhone}` : ''}
                </li>
              ))}
            </ul>
            <button onClick={() => pendingValues && submit(pendingValues, true)}>
              {t('clients.confirmCreate')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
