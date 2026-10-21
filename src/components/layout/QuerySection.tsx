import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

type SectionQuery = {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/** A missing or failed read is never presented as a successful empty/zero result. */
export function QuerySection({
  query,
  label,
  children,
}: {
  query: SectionQuery;
  label: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isPending || (query.isError && query.isFetching))
    return (
      <div role="status" aria-label={t('records.sectionLoading', { section: label })}>
        <Skeleton className="h-8 w-full" />
        <span className="sr-only">{t('records.sectionLoading', { section: label })}</span>
      </div>
    );
  if (query.isError || query.data === undefined)
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{t('records.sectionLoadError', { section: label })}</p>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('app.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  return children;
}
