import i18n from '@/i18n';
import { formatNameList } from '@/lib/format';
import type { CaseSummary, ClientSummary } from '@/bridge/types';
import type { EntityOption } from '@/components/forms/EntityPicker';

/** One case in a picker: «2026/15 — أحمد محمود علي», searchable by court and court number too. */
export function caseOption(item: CaseSummary): EntityOption {
  return {
    value: item.id,
    disabled: Boolean(item.archivedAt),
    label: item.clientNames.length
      ? `${item.internalNumber} — ${formatNameList(item.clientNames, i18n.resolvedLanguage === 'en' ? 'en' : 'ar')}`
      : item.internalNumber,
    searchText: [item.officialNumber, item.courtName].filter(Boolean).join(' '),
  };
}

/** One client in a picker, searchable by file number and phone too. */
export function clientOption(item: ClientSummary): EntityOption {
  return {
    value: item.id,
    label: item.fullName,
    searchText: `${item.internalNumber} ${item.primaryPhone ?? ''}`,
  };
}
