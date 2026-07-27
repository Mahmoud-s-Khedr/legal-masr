import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../../bridge/errors';
import { useArchiveCase, useCase, useRestoreCase, useUpdateCase } from '../api/casesApi';
import { CaseClientsPanel } from '../components/CaseClientsPanel';
import { CasePartiesPanel } from '../components/CasePartiesPanel';
import { CaseEditForm } from '../forms/CaseEditForm';

export function CaseDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data: caseDto, isLoading } = useCase(id);
  const updateCase = useUpdateCase();
  const archiveCase = useArchiveCase();
  const restoreCase = useRestoreCase();

  if (isLoading) return <p>{t('cases.loading')}</p>;
  if (!caseDto) return <p>{t('cases.detail.notFound')}</p>;

  return (
    <section className="entity-detail">
      <div className="entity-list-header">
        <h2>{caseDto.caseNumber}</h2>
        {caseDto.archivedAt ? (
          <button onClick={() => restoreCase.mutate(caseDto.id)}>{t('cases.restore')}</button>
        ) : (
          <button onClick={() => archiveCase.mutate(caseDto.id)}>{t('cases.archive')}</button>
        )}
      </div>

      <CaseEditForm
        caseDto={caseDto}
        busy={updateCase.isPending}
        onSubmit={async (values) => {
          await updateCase.mutateAsync({
            id: caseDto.id,
            ...values,
            judicialYear: Number.isNaN(values.judicialYear) ? undefined : values.judicialYear,
          });
        }}
      />
      {updateCase.isError && (
        <p className="error">{errorMessage(updateCase.error, t('app.defaultError'))}</p>
      )}

      <CaseClientsPanel caseDto={caseDto} />
      <CasePartiesPanel caseDto={caseDto} />
    </section>
  );
}
