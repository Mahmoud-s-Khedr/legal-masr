import i18n from '@/i18n';
import { formatNameList } from '@/lib/format';
import type { PowerOfAttorneySummary } from '@/bridge/types';
import type { EntityOption } from '@/components/forms/EntityPicker';

type PoaLabelSource = {
  internalSequence: string;
  officialNumber?: string | null;
  issueYear?: number | null;
};

const isolate = (value: string) => `\u2068${value}\u2069`;

/** «توكيل 1»: the number with the kind of record it belongs to. */
export function poaTitle(poa: Pick<PoaLabelSource, 'internalSequence'>): string {
  return i18n.t('poa.labelPrefix', { number: isolate(poa.internalSequence) });
}

/**
 * «توكيل 1 · رقم 12134 لسنة 2026». Display only: the stored internal number stays the plain
 * text the lawyer typed, and the prefix says what kind of record the number belongs to.
 */
export function poaLabel(poa: PoaLabelSource): string {
  const parts = [poaTitle(poa)];
  if (poa.officialNumber) {
    parts.push(
      poa.issueYear
        ? i18n.t('cases.officialReference', {
            number: isolate(poa.officialNumber),
            year: poa.issueYear,
          })
        : i18n.t('cases.officialNumberOnly', { number: isolate(poa.officialNumber) }),
    );
  }
  return parts.join(' \u00b7 ');
}

/** One power of attorney in a picker, searchable by internal and official number. */
export function poaOption(item: PowerOfAttorneySummary): EntityOption {
  const names = item.clientNames.length
    ? formatNameList(item.clientNames, i18n.resolvedLanguage === 'en' ? 'en' : 'ar')
    : '';
  return {
    value: item.id,
    disabled: Boolean(item.archivedAt),
    label: names ? `${poaLabel(item)} \u00b7 ${names}` : poaLabel(item),
    searchText: [item.internalSequence, item.officialNumber].filter(Boolean).join(' '),
  };
}
