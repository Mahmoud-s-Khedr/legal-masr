import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { actionableErrorMessage, isCancelled } from '@/bridge/errors';
import { useSaveSupportBundle } from '../api/settingsApi';

const included = ['system', 'settings', 'schema', 'codes', 'logs', 'readme'] as const;

export function SupportBundleSection() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const save = useSaveSupportBundle();
  const pending = save.isPending;
  return (
    <section className="settings-section">
      <div className="section-heading">
        <div>
          <h3>{t('settings.supportBundle.title')}</h3>
          <p>{t('settings.supportBundle.localOnly')}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          save.reset();
          setOpen(true);
        }}
      >
        {t('settings.supportBundle.create')}
      </Button>
      {save.isSuccess && <p role="status">{t('settings.supportBundle.success')}</p>}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogContent
          dir={i18n.dir()}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          aria-busy={pending}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.supportBundle.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.supportBundle.intro')}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc ps-5">
            {included.map((key) => (
              <li key={key}>{t(`settings.supportBundle.includes.${key}`)}</li>
            ))}
          </ul>
          <p>{t('settings.supportBundle.excludes')}</p>
          <p>{t('settings.supportBundle.localOnly')}</p>
          <p>{t('settings.supportBundle.freshFile')}</p>
          {save.isError && !isCancelled(save.error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {actionableErrorMessage(save.error, t('settings.supportBundle.error'))}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter className="sm:justify-start">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                save.mutate(t('settings.supportBundle.pickerFilter'), {
                  onSuccess: () => setOpen(false),
                })
              }
            >
              {t(
                pending
                  ? 'settings.supportBundle.saving'
                  : 'settings.supportBundle.chooseDestination',
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
