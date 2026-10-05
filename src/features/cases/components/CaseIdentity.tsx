import { useTranslation } from 'react-i18next';
import type { CaseStatus } from '../../../bridge/types';

const STATUS_TONE: Record<CaseStatus, string> = {
  ACTIVE: 'tone-active',
  SUSPENDED: 'tone-warning',
  CLOSED: 'tone-muted',
};

export function CaseStatusBadge({ status, archived }: { status: CaseStatus; archived?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`status-badge ${archived ? 'tone-muted' : STATUS_TONE[status]}`}>
      {archived ? t('cases.archivedBadge') : t(`cases.status.${status}`)}
    </span>
  );
}

/** The court reference as Egyptian filings write it: «رقم 447 لسنة 2026». */
export function OfficialReference({ number, year }: { number: string; year?: number | null }) {
  const { t } = useTranslation();
  return (
    <span className="official-reference">
      {year
        ? t('cases.officialReference', { number: '⁨' + number + '⁩', year })
        : t('cases.officialNumberOnly', { number: '⁨' + number + '⁩' })}
    </span>
  );
}
