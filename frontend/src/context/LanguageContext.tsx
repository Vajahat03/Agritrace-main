'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { dictionaries, TranslationDictionary } from '../locales/dictionaries';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
  translateCommodity: (canonicalId: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('agritrace_lang') as Language;
    if (saved && dictionaries[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('agritrace_lang', lang);
  };

  const t = dictionaries[language] || dictionaries.en;

  const translateCommodity = (canonicalId: string): string => {
    const upper = canonicalId.toUpperCase();
    return t.commodities[upper] || canonicalId;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateCommodity }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
