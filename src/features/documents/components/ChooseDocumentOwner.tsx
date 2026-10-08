import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityPicker, type EntityOption } from '../../../components/forms/EntityPicker';
import { Field } from '../../../components/forms/FormField';
import { FormDialog, FormDialogFooter } from '../../../components/forms/FormDialog';
import { Button } from '../../../components/ui/button';
import { useCaseList } from '../../cases/api/casesApi';
import { caseOption, clientOption } from '../../cases/components/caseOptions';
import { useClientList } from '../../clients/api/clientsApi';
import { usePowerOfAttorneyList } from '../../powersOfAttorney/api/powersOfAttorneyApi';

type OwnerKind = 'case' | 'client' | 'powerOfAttorney';

/**
 * «إضافة مستند» on the all-documents page. Every document belongs to a case, a client or a
 * power of attorney, so the lawyer picks that first and lands on its documents with the
 * add form open.
 */
export function ChooseDocumentOwner({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kind, setKind] = useState<OwnerKind>('case');
  const [ownerId, setOwnerId] = useState('');
  const cases = useCaseList({ includeArchived: false });
  const clients = useClientList({ includeArchived: false });
  const powers = usePowerOfAttorneyList({ includeArchived: false });
  const options: Record<OwnerKind, EntityOption[]> = {
    case: (cases.data ?? []).map(caseOption),
    client: (clients.data ?? []).map(clientOption),
    powerOfAttorney: (powers.data ?? []).map((item) => ({
      value: item.id,
      label: item.clientNames.length
        ? `${item.internalSequence} — ${item.clientNames.join('، ')}`
        : item.internalSequence,
      searchText: item.officialNumber ?? '',
    })),
  };
  const loading = {
    case: cases.isLoading,
    client: clients.isLoading,
    powerOfAttorney: powers.isLoading,
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('documents.chooseOwnerTitle')}>
      <form
        className="dialog-wide-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ownerId) return;
          onOpenChange(false);
          navigate(`/documents?${kind}=${encodeURIComponent(ownerId)}&add=1`);
        }}
      >
        <p className="muted">{t('documents.chooseOwnerHint')}</p>
        <div className="segmented" role="group" aria-label={t('documents.chooseOwnerKind')}>
          {(['case', 'client', 'powerOfAttorney'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={kind === value ? 'default' : 'outline'}
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setOwnerId('');
              }}
            >
              {t(`documents.ownerKinds.${value}`)}
            </Button>
          ))}
        </div>
        <Field label={t(`documents.ownerKinds.${kind}`)} required>
          <EntityPicker
            key={kind}
            items={options[kind]}
            value={ownerId}
            onValueChange={setOwnerId}
            loading={loading[kind]}
            placeholder={t('documents.chooseOwnerPlaceholder')}
            emptyText={t('documents.chooseOwnerEmpty')}
          />
        </Field>
        <FormDialogFooter>
          <Button type="submit" disabled={!ownerId}>
            {t('documents.chooseOwnerContinue')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
