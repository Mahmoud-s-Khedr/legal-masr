import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { FormDialog } from '@/components/forms/FormDialog';
import { Button } from '@/components/ui/button';
import { asAppError, errorMessage } from '@/bridge/errors';
import type { ClientDuplicateCandidate } from '@/bridge/types';
import { useCreateClient } from '../api/clientsApi';
import { ClientForm } from '../forms/ClientForm';
import type { ClientFormValues } from '../schemas/client.schema';
export function InlineClientCreateDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  initialName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (clientId: string) => void;
}) {
  const { t } = useTranslation();
  const createClient = useCreateClient();
  const [duplicates, setDuplicates] = useState<ClientDuplicateCandidate[] | null>(null);
  const [pendingValues, setPendingValues] = useState<ClientFormValues | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const close = () => {
    setDuplicates(null);
    setPendingValues(null);
    setCreateError(null);
    onOpenChange(false);
  };
  const submit = async (values: ClientFormValues, confirmDuplicate: boolean) => {
    setDuplicates(null);
    setCreateError(null);
    try {
      const client = await createClient.mutateAsync({ ...values, confirmDuplicate });
      onCreated(client.id);
      close();
    } catch (error) {
      const appError = asAppError(error);
      if (appError?.code === 'CLIENT_PROBABLE_DUPLICATE') {
        setDuplicates((appError.details as ClientDuplicateCandidate[]) ?? []);
        setPendingValues(values);
        return;
      }
      setCreateError(errorMessage(error, t('poa.clientSaveError')));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      title={t('cases.form.addClientLink')}
    >
      <ClientForm
        defaultValues={{ fullName: initialName }}
        busy={createClient.isPending}
        submitLabel={t('poa.saveClientAndLink')}
        onCancel={close}
        onSubmit={(values) => submit(values, false)}
      />
      {createError && (
        <Alert variant="destructive">
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      )}
      {duplicates && (
        <div className="warning" role="alert">
          <p>{t('clients.duplicateWarning')}</p>
          <ul>
            {duplicates.map((candidate) => (
              <li key={candidate.id}>
                {candidate.fullName}
                {candidate.primaryPhone ? ` — ${candidate.primaryPhone}` : ''}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            disabled={createClient.isPending}
            onClick={() => pendingValues && submit(pendingValues, true)}
          >
            {t('poa.createClientAnyway')}
          </Button>
        </div>
      )}
    </FormDialog>
  );
}
