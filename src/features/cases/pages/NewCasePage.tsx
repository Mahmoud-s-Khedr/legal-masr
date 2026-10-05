import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { errorMessage } from '../../../bridge/errors';
import { useClientList } from '../../clients/api/clientsApi';
import { useCreateCase } from '../api/casesApi';
import { CaseCreateForm } from '../forms/CaseCreateForm';

export function NewCasePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialClientId = params.get('client');
  const { data: clients, isLoading, isError } = useClientList({ includeArchived: false });
  const createCase = useCreateCase();
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
          <p className="error" role="alert">
            {t('cases.form.clientsLoadError')}
          </p>
        )}
        <CaseCreateForm
          clients={clients ?? []}
          initialClientIds={initialClientId ? [initialClientId] : []}
          busy={createCase.isPending || isLoading || isError}
          onCancel={() => navigate('/cases')}
          onSubmit={async (values) => {
            const created = await createCase.mutateAsync({
              ...values,
              officialYear: Number.isNaN(values.officialYear) ? undefined : values.officialYear,
              clients: values.clientIds.map((clientId) => ({ clientId })),
            });
            navigate(created?.id ? `/cases/${created.id}` : '/cases');
          }}
        />
        {createCase.isError && (
          <p className="error" role="alert">
            {errorMessage(createCase.error, t('app.defaultError'))}
          </p>
        )}
      </div>
    </section>
  );
}
