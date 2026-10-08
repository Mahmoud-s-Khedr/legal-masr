import type { CaseSummary, ClientSummary } from '@/bridge/types';
import type { EntityOption } from '@/components/forms/EntityPicker';

/** One case in a picker: «2026/15 — أحمد محمود علي», searchable by court and court number too. */
export function caseOption(item: CaseSummary): EntityOption {
  return {
    value: item.id,
    label: item.clientNames.length
      ? `${item.internalNumber} — ${item.clientNames.join('، ')}`
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
