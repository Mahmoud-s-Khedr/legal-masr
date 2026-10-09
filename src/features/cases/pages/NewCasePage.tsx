import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { errorMessage } from '../../../bridge/errors';
import { useClientList } from '../../clients/api/clientsApi';
import { useCaseList, useCreateCase } from '../api/casesApi';
import { suggestNextNumber } from '../../../lib/nextNumber';
import { CaseCreateForm } from '../forms/CaseCreateForm';

export function NewCasePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialClientId = params.get('client');
  const { data: clients, isLoading, isError } = useClientList({ includeArchived: false });
  const createCase = useCreateCase();
  const existing = useCaseList({ includeArchived: true });
  return (
    <section className="record-editor">
      <PageHeader
        kicker={t('cases.editorKicker')}
        title={t('cases.newTitle')}
        description={t('cases.editorDescription')}
      />
      <div className="editor-surface">
        {isLoading && <p role="status">{t('cases.form.loadingClients')}</p>}
        {isError && (
          <Alert variant="destructive">
            <AlertDescription>{t('cases.form.clientsLoadError')}</AlertDescription>
          </Alert>
        )}
        <CaseCreateForm
          clients={clients ?? []}
          initialClientIds={initialClientId ? [initialClientId] : []}
          suggestedNumber={
            existing.data
              ? suggestNextNumber(existing.data.map((item) => item.internalNumber))
              : undefined
          }
          busy={createCase.isPending || isLoading || isError}
          onCancel={() => navigate('/cases')}
          onSubmit={async (values) => {
            const created = await createCase.mutateAsync({
              ...values,
              officialYear: Number.isNaN(values.officialYear) ? undefined : values.officialYear,
              judicialYear: Number.isNaN(values.judicialYear) ? undefined : values.judicialYear,
              clients: values.clientIds.map((clientId) => ({ clientId })),
            });
            navigate(created?.id ? `/cases/${created.id}` : '/cases');
          }}
        />
        {createCase.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage(createCase.error, t('app.defaultError'))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}
