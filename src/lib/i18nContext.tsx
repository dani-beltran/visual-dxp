import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type BuilderI18n, createBuilderTranslator, translateEnglish } from './i18n';

const BuilderI18nContext = createContext({
  locale: 'en',
  direction: 'ltr' as 'ltr' | 'rtl',
  t: translateEnglish,
});

export function BuilderI18nProvider({
  i18n,
  children,
}: {
  i18n?: BuilderI18n;
  children: ReactNode;
}) {
  const locale = i18n?.locale ?? 'en';
  const direction = i18n?.direction ?? 'ltr';
  const messages = i18n?.messages;
  const value = useMemo(
    () => ({ locale, direction, t: createBuilderTranslator(messages) }),
    [locale, direction, messages],
  );
  return <BuilderI18nContext.Provider value={value}>{children}</BuilderI18nContext.Provider>;
}

export function useBuilderI18n() {
  return useContext(BuilderI18nContext);
}
