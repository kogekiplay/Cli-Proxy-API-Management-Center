/**
 * i18next 国际化配置
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import { getInitialLanguage } from '@/utils/language';
import type { Language } from '@/types';

const localeLoaders: Record<Language, () => Promise<Record<string, unknown>>> = {
  'zh-CN': async () => zhCN,
  'zh-TW': async () => (await import('./locales/zh-TW.json')).default,
  en: async () => (await import('./locales/en.json')).default,
  ru: async () => (await import('./locales/ru.json')).default,
};

const initialization = i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false, // React 已经转义
  },
  react: {
    useSuspense: false,
  },
});

export async function setAppLanguage(language: Language): Promise<void> {
  await initialization;
  if (!i18n.hasResourceBundle(language, 'translation')) {
    const resources = await localeLoaders[language]();
    i18n.addResourceBundle(language, 'translation', resources, true, true);
  }
  await i18n.changeLanguage(language);
}

export async function initializeI18n(): Promise<void> {
  try {
    await setAppLanguage(getInitialLanguage());
  } catch {
    await initialization;
    await i18n.changeLanguage('zh-CN');
  }
}

export default i18n;
