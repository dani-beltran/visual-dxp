/** Select the first available browser language, falling back to English. */
export function detectBrowserLanguage(): 'en' | 'es' {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const locale of languages) {
    const language = locale?.split('-')[0].toLowerCase();
    if (language === 'en' || language === 'es') return language;
  }
  return 'en';
}
