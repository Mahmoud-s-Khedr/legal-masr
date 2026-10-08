import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { bridge } from '../../../bridge/commands';
import { errorMessage, isCancelled } from '../../../bridge/errors';
import { CopyButton } from '../../../components/forms/CopyButton';
import { Icon } from '../../../components/layout/Icon';
import { Button } from '../../../components/ui/button';
import { groupRecoveryKey } from '../../../lib/recoveryKey';

/**
 * A recovery key on screen, with the three ways people actually keep one: copy it, print
 * it, or save it as a file on a flash drive. Printing shows only this card.
 */
export function RecoveryKeyCard({ recoveryKey }: { recoveryKey: string }) {
  const { t } = useTranslation();
  const grouped = groupRecoveryKey(recoveryKey);
  const save = useMutation({ gcTime: 0, mutationFn: () => bridge.saveRecoveryKey(recoveryKey) });
  const print = useMutation({ gcTime: 0, mutationFn: bridge.print });
  const failure = [save.error, print.error].find((error) => error && !isCancelled(error));

  return (
    <div className="recovery-key-sheet print-focus">
      <p className="print-only recovery-key-print-title">{t('gate.recoveryKeyPrintTitle')}</p>
      <code className="recovery-key" dir="ltr" aria-label={t('gate.fields.recoveryKey')}>
        {grouped}
      </code>
      <p className="print-only">{t('gate.recoveryKeyPrintNote')}</p>
      <div className="recovery-key-actions no-print">
        <CopyButton text={grouped} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={print.isPending}
          onClick={() => {
            save.reset();
            print.mutate();
          }}
        >
          <Icon name="printer" size={16} />
          {t('gate.recoveryKeyPrint')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={save.isPending}
          onClick={() => {
            print.reset();
            save.mutate();
          }}
        >
          <Icon name="save" size={16} />
          {save.isPending ? t('gate.recoveryKeySaving') : t('gate.recoveryKeySave')}
        </Button>
      </div>
      {save.isSuccess && (
        <p className="success no-print" role="status">
          {t('gate.recoveryKeySaved')}
        </p>
      )}
      {failure ? (
        <Alert variant="destructive" className="no-print">
          <AlertDescription>{errorMessage(failure, t('app.defaultError'))}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
