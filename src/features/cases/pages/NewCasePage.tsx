import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import { useClientList } from '../../clients/api/clientsApi';
import { useCreateCase } from '../api/casesApi';
import { CaseCreateForm } from '../forms/CaseCreateForm';

export function NewCasePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: clients } = useClientList({ includeArchived: false });
  const createCase = useCreateCase();
  return (
    <section className="record-editor">
      <div className="page-heading">
        <div>
          <p className="kicker">{t('cases.editorKicker')}</p>
          <h2>{t('cases.newButton')}</h2>
          <p>{t('cases.editorDescription')}</p>
        </div>
      </div>
      <div className="editor-surface">
        <CaseCreateForm
          clients={clients ?? []}
          busy={createCase.isPending}
          onCancel={() => navigate('/cases')}
          onSubmit={async (values) => {
            await createCase.mutateAsync({
              ...values,
              judicialYear: Number.isNaN(values.judicialYear) ? undefined : values.judicialYear,
            });
            navigate('/cases');
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
