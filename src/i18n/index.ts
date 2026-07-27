import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar/common.json';
import en from './en/common.json';

const RTL_LANGUAGES = new Set(['ar']);

export function applyDocumentDirection(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

void i18next.use(initReactI18next).init({
  resources: { ar: { common: ar }, en: { common: en } },
  lng: 'ar',
  fallbackLng: 'ar',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

i18next.on('languageChanged', applyDocumentDirection);
applyDocumentDirection(i18next.language);

export default i18next;
