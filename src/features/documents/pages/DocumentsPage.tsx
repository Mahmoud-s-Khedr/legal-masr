import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/button';
import { AttachmentPanel } from '../components/AttachmentPanel';
import { ChooseDocumentOwner } from '../components/ChooseDocumentOwner';

export function AttachmentsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [choosingOwner, setChoosingOwner] = useState(false);
  const owner = {
    caseId: params.get('case') ?? undefined,
    clientId: params.get('client') ?? undefined,
    powerOfAttorneyId: params.get('powerOfAttorney') ?? undefined,
  };
  const scoped = Boolean(owner.caseId || owner.clientId || owner.powerOfAttorneyId);
  // ?add=1 (from «إضافة مستند» on the all-documents page) opens the add form once.
  const addIntent = scoped && params.get('add') === '1';
  useEffect(() => {
    if (!addIntent) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('add');
        return next;
      },
      { replace: true },
    );
  }, [addIntent, setParams]);
  return (
    <section className="work-page">
      <PageHeader
        kicker={t('nav.groups.records')}
        title={scoped ? t('documents.pageScoped') : t('documents.pageAll')}
        description={scoped ? t('documents.pageScopedHint') : t('documents.pageAllHint')}
        actions={
          scoped ? undefined : (
            <Button type="button" onClick={() => setChoosingOwner(true)}>
              {t('documents.add')}
            </Button>
          )
        }
      />
      <AttachmentPanel
        owner={owner}
        title={scoped ? t('documents.panelScoped') : t('documents.panelAll')}
        allowAdd={scoped}
        startAdding={addIntent}
        showOwner={!scoped}
      />
      {!scoped && choosingOwner && <ChooseDocumentOwner open onOpenChange={setChoosingOwner} />}
    </section>
  );
}
