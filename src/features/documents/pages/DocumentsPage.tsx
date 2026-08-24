import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { AttachmentPanel } from '../components/AttachmentPanel';

export function AttachmentsPage() {
  const [params] = useSearchParams();
  return (
    <section className="work-page">
      <PageHeader
        kicker="المرفقات"
        title="المرفقات المُدارة"
        description="يُنسخ كل ملف إلى مساحة التطبيق المحلية ويُضمّن في النسخ الاحتياطية؛ لا توجد معاينة غير متاحة داخل التطبيق."
      />
      <AttachmentPanel
        owner={{
          caseId: params.get('case') ?? undefined,
          clientId: params.get('client') ?? undefined,
          powerOfAttorneyId: params.get('powerOfAttorney') ?? undefined,
        }}
        title="ملفات هذا السجل"
      />
    </section>
  );
}
