import { useSearchParams } from 'react-router-dom';
import { AttachmentPanel } from '../components/AttachmentPanel';

export function AttachmentsPage() {
  const [params] = useSearchParams();
  return (
    <section className="work-page">
      <header className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="kicker">المرفقات</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">المرفقات المُدارة</h1>
        <p className="mt-1 text-muted-foreground">يُنسخ كل ملف إلى مساحة التطبيق المحلية ويُضمّن في النسخ الاحتياطية؛ لا توجد معاينة غير متاحة داخل التطبيق.</p>
      </header>
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
