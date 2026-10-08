import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { actionableErrorMessage } from '@/bridge/errors';
import { PowerOfAttorneyForm } from '../components/PowerOfAttorneyForm';
import { useSavePowerOfAttorney } from '../api/powersOfAttorneyApi';
export function NewPowerOfAttorneyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSavePowerOfAttorney();
  return (
    <section className="work-page">
      <PageHeader title={t('poa.add')} />
      <PowerOfAttorneyForm
        busy={save.isPending}
        onCancel={() => navigate('/powers-of-attorney')}
        onSubmit={async (input) => {
          const poa = await save.mutateAsync(input);
          navigate(`/powers-of-attorney/${poa.id}`);
        }}
      />
      {save.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {actionableErrorMessage(save.error, t('poa.saveError'))}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
