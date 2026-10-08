import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { CaseStatus } from '../../../bridge/types';

export function CaseStatusBadge({ status, archived }: { status: CaseStatus; archived?: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary">
      {archived ? t('cases.archivedBadge') : t(`cases.status.${status}`)}
    </Badge>
  );
}

/** The court reference as Egyptian filings write it: «رقم 447 لسنة 2026». */
export function OfficialReference({
  number,
  year,
  judicialYear,
}: {
  number: string;
  year?: number | null;
  judicialYear?: number | null;
}) {
  const { t } = useTranslation();
  const isolated = '\u2068' + number + '\u2069';
  return (
    <span className="official-reference">
      {year && judicialYear
        ? t('cases.officialReferenceBoth', { number: isolated, year, judicialYear })
        : judicialYear
          ? t('cases.officialReferenceJudicial', { number: isolated, judicialYear })
          : year
            ? t('cases.officialReference', { number: isolated, year })
            : t('cases.officialNumberOnly', { number: isolated })}
    </span>
  );
}
