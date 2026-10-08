import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import type { AppError, ClientDuplicateCandidate } from '../../../bridge/types';
import { useClientList, useCreateClient } from '../api/clientsApi';
import { suggestNextNumber } from '../../../lib/nextNumber';
import { ClientForm } from '../forms/ClientForm';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/layout/PageHeader';
import type { ClientFormValues } from '../schemas/client.schema';

export function NewClientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createClient = useCreateClient();
  const existing = useClientList({ includeArchived: true });
  const [duplicates, setDuplicates] = useState<ClientDuplicateCandidate[] | null>(null);
  const [pendingValues, setPendingValues] = useState<ClientFormValues | null>(null);
  const submit = async (values: ClientFormValues, confirmDuplicate: boolean) => {
    setDuplicates(null);
    try {
      const created = await createClient.mutateAsync({ ...values, confirmDuplicate });
      navigate(created?.id ? `/clients/${created.id}` : '/clients');
    } catch (error) {
      const apiError = error as AppError;
      if (apiError?.code === 'CLIENT_PROBABLE_DUPLICATE') {
        setDuplicates((apiError.details as ClientDuplicateCandidate[]) ?? []);
        setPendingValues(values);
        return;
      }
      // The mutation error is displayed below and the entered values remain.
    }
  };

  return (
    <section className="record-editor">
      <PageHeader
        kicker={t('clients.editorKicker')}
        title={t('clients.newTitle')}
        description={t('clients.editorDescription')}
      />
      <div className="editor-surface">
        <ClientForm
          suggestedNumber={
            existing.data
              ? suggestNextNumber(existing.data.map((client) => client.internalNumber))
              : undefined
          }
          busy={createClient.isPending}
          submitLabel={t('clients.save')}
          onCancel={() => navigate('/clients')}
          onSubmit={(values) => submit(values, false)}
        />
        {createClient.isError && !duplicates && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage(createClient.error, t('app.defaultError'))}
            </AlertDescription>
          </Alert>
        )}
        {duplicates && (
          <div className="warning duplicate-warning" role="alert">
            <p>{t('clients.duplicateWarning')}</p>
            <ul>
              {duplicates.map((candidate) => (
                <li key={candidate.id}>
                  <Link to={`/clients/${candidate.id}`} target="_self">
                    <bdi>{candidate.fullName}</bdi>
                  </Link>
                  {candidate.primaryPhone && (
                    <span className="mono" dir="ltr">
                      {candidate.primaryPhone}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Button
              type="submit"
              disabled={createClient.isPending}
              onClick={() => pendingValues && void submit(pendingValues, true)}
            >
              {t('clients.confirmCreate')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
