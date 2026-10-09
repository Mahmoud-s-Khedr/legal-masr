import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { buttonVariants } from '../components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <section>
      <PageHeader title={t('app.notFound.title')} description={t('app.notFound.description')} />
      <Link className={buttonVariants()} to="/">
        {t('app.notFound.returnToToday')}
      </Link>
    </section>
  );
}
