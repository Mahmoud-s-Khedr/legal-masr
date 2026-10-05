import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { AttachmentPanel } from '../components/AttachmentPanel';

export function AttachmentsPage() {
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
        kicker="المستندات"
        title={scoped ? 'مرفقات السجل' : 'كل المستندات'}
        description={
          scoped
            ? 'الملفات المرتبطة بهذا السجل. يُنسخ كل ملف إلى مساحة التطبيق ويدخل في النسخ الاحتياطي.'
            : 'كل الملفات المحفوظة في مكتبك مع السجل الذي تخصه. لإضافة مستند افتح ملف الموكل أو القضية أو التوكيل.'
        }
      />
      <AttachmentPanel
        owner={owner}
        title={scoped ? 'ملفات هذا السجل' : 'المستندات المحفوظة'}
        allowAdd={scoped}
        showOwner={!scoped}
      />
    </section>
  );
}
