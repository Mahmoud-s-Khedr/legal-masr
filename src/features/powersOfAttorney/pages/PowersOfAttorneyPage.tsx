import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/PageHeader';

/** The route is intentionally present now so the frozen shell has no dead navigation. */
export function PowersOfAttorneyPage() {
  const { t } = useTranslation();
  return (
    <section className="work-page">
      <PageHeader
        kicker={t('powersOfAttorney.kicker')}
        title={t('powersOfAttorney.title')}
        description={t('powersOfAttorney.description')}
      />
      <div className="empty-state-card">
        <strong>{t('powersOfAttorney.emptyTitle')}</strong>
        <span>{t('powersOfAttorney.emptyDescription')}</span>
      </div>
    </section>
  );
}
