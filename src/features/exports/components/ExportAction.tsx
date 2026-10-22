import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { actionableErrorMessage, isCancelled } from '@/bridge/errors';
import { ConfirmDialog } from '@/components/forms/FormDialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSingleFlight } from '@/lib/useSingleFlight';
import { useCreateExport, useRevealExport } from '../api/exportsApi';

export function ExportAction({
  caseId,
  disabled = false,
}: {
  caseId?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const create = useCreateExport(caseId);
  const reveal = useRevealExport();
  const once = useSingleFlight();
  const [confirming, setConfirming] = useState(false);
  const failure = create.isError && !isCancelled(create.error);
  return (
    <div className="detail-stack">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || create.isPending || reveal.isPending}
        onClick={() => {
          create.reset();
          reveal.reset();
          setConfirming(true);
        }}
      >
        {t(caseId ? 'exports.caseAction' : 'exports.allAction')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !create.isPending && setConfirming(open)}
        title={t('exports.warningTitle')}
        description={t(caseId ? 'exports.caseWarning' : 'exports.allWarning')}
        confirmLabel={create.isPending ? t('exports.creating') : t('exports.confirm')}
        cancelLabel={t('common.cancel')}
        pending={create.isPending}
        error={failure ? actionableErrorMessage(create.error, t('exports.failed')) : undefined}
        onConfirm={() =>
          once((done) =>
            create.mutate(undefined, {
              onSuccess: () => setConfirming(false),
              onError: (error) => {
                if (isCancelled(error)) setConfirming(false);
              },
              onSettled: done,
            }),
          )
        }
      />
      {create.isSuccess && (
        <>
          <p role="status">
            {t('exports.success')} <bdi dir="auto">{create.data.folderName}</bdi>
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={reveal.isPending}
            onClick={() => once((done) => reveal.mutate(create.data.token, { onSettled: done }))}
          >
            {t('exports.reveal')}
          </Button>
        </>
      )}
      {reveal.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {actionableErrorMessage(reveal.error, t('exports.revealFailed'))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
