import type { TFunction } from 'i18next';

/** An empty required field reads "required"; any other failure reads "invalid". */
export function fieldError(error: { type?: string } | undefined, t: TFunction) {
  if (!error) return undefined;
  return error.type === 'too_small' ? t('forms.required') : t('forms.invalid');
}
