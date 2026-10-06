import '../../styles/base.css';
import '../../styles/shared.css';
import { Moon, Settings2, Sun } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { appMessages } from '../../app/locales/appMessages';
import { Select } from '../Select/Select';
import './AppPreferences.css';

interface AppPreferencesProps {
  selectedLanguage: string;
  hostLanguage: string;
  theme: 'light' | 'dark';
  copy: Pick<
    typeof appMessages.en,
    'preferences' | 'darkMode' | 'lightMode' | 'switchToLight' | 'switchToDark'
  >;
  onLanguageChange: (language: string) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export function AppPreferences({
  selectedLanguage,
  hostLanguage,
  theme,
  copy,
  onLanguageChange,
  onThemeChange,
}: AppPreferencesProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const preferencesButtonRef = useRef<HTMLButtonElement>(null);
  const preferencesId = useId();
  useEffect(() => {
    if (!preferencesOpen) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !preferencesRef.current?.contains(event.target)) {
        setPreferencesOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPreferencesOpen(false);
      preferencesButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [preferencesOpen]);
  return (
    <div className="dxp-preferences" ref={preferencesRef}>
      <button
        ref={preferencesButtonRef}
        type="button"
        className="dxp-button dxp-preferences-trigger"
        aria-expanded={preferencesOpen}
        aria-controls={preferencesId}
        onClick={() => setPreferencesOpen((open) => !open)}
      >
        <Settings2 size={14} /> {copy.preferences}
      </button>
      <fieldset
        id={preferencesId}
        className="dxp-header-actions"
        aria-label={copy.preferences}
        data-open={preferencesOpen}
      >
        <label className="dxp-language-selector" htmlFor={`${preferencesId}-language`}>
          <Select
            id={`${preferencesId}-language`}
            className="dxp-button"
            value={selectedLanguage}
            onChange={(event) => onLanguageChange(event.target.value)}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="es" lang="es">
              Español
            </option>
            {hostLanguage !== 'en' && hostLanguage.split('-')[0].toLowerCase() !== 'es' && (
              <option value={hostLanguage}>{hostLanguage}</option>
            )}
          </Select>
        </label>
        <button
          type="button"
          className="dxp-button"
          aria-label={copy.darkMode}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? copy.switchToLight : copy.switchToDark}
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? copy.lightMode : copy.darkMode}
        </button>
      </fieldset>
    </div>
  );
}
