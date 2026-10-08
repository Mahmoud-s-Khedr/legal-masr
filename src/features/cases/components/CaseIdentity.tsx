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
export function OfficialReference({ number, year }: { number: string; year?: number | null }) {
  const { t } = useTranslation();
  return (
    <span className="official-reference">
      {year
        ? t('cases.officialReference', { number: '\u2068' + number + '\u2069', year })
        : t('cases.officialNumberOnly', { number: '\u2068' + number + '\u2069' })}
    </span>
  );
}
