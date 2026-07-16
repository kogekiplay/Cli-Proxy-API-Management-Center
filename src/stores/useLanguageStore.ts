/**
 * 语言状态管理
 * 从原项目 src/modules/language.js 迁移
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/types';
import { STORAGE_KEY_LANGUAGE } from '@/utils/constants';
import { setAppLanguage } from '@/i18n';
import { getInitialLanguage, isSupportedLanguage } from '@/utils/language';

interface LanguageState {
  language: Language;
  setLanguage: (language: string) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: getInitialLanguage(),

      setLanguage: (language) => {
        if (!isSupportedLanguage(language)) {
          return;
        }
        void setAppLanguage(language)
          .then(() => set({ language }))
          .catch(() => undefined);
      },
    }),
    {
      name: STORAGE_KEY_LANGUAGE,
      merge: (persistedState, currentState) => {
        const nextLanguage = (persistedState as Partial<LanguageState>)?.language;
        if (typeof nextLanguage === 'string' && isSupportedLanguage(nextLanguage)) {
          return {
            ...currentState,
            ...(persistedState as Partial<LanguageState>),
            language: nextLanguage,
          };
        }
        return currentState;
      },
    }
  )
);
