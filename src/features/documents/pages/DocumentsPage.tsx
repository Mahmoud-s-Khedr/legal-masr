import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { AttachmentPanel } from '../components/AttachmentPanel';

export function AttachmentsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const owner = {
    caseId: params.get('case') ?? undefined,
    clientId: params.get('client') ?? undefined,
    powerOfAttorneyId: params.get('powerOfAttorney') ?? undefined,
  };
  const scoped = Boolean(owner.caseId || owner.clientId || owner.powerOfAttorneyId);
  return (
    <section className="work-page">
      <PageHeader
        kicker={t('nav.groups.records')}
        title={scoped ? t('documents.pageScoped') : t('documents.pageAll')}
        description={scoped ? t('documents.pageScopedHint') : t('documents.pageAllHint')}
      />
      <AttachmentPanel
        owner={owner}
        title={scoped ? t('documents.panelScoped') : t('documents.panelAll')}
        allowAdd={scoped}
        showOwner={!scoped}
      />
    </section>
  );
}
