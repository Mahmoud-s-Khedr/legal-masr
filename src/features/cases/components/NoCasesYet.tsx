import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormDialogFooter } from '@/components/forms/FormDialog';
import { Button } from '@/components/ui/button';

/** Shown instead of a hearing or payment form while there is no case to attach it to. */
export function NoCasesYet({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 grid gap-3.5" role="status">
      <p>
        <strong>{t('agenda.noCasesTitle')}</strong> {t('agenda.noCasesHint')}
      </p>
      <FormDialogFooter>
        <Button nativeButton={false} render={<Link to="/cases/new" />} onClick={onCancel}>
          {t('dashboard.addCase')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </FormDialogFooter>
    </div>
  );
}
