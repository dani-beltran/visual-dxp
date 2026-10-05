import { LoaderCircle, LogOut, Sparkles } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { ChatGPTAuthStore } from '../lib/chatgptAuth';
import { useBuilderI18n } from '../lib/i18nContext';
import '../styles/ai-settings.css';

export function AISettings({
  store,
  compact = false,
}: {
  store: ChatGPTAuthStore;
  compact?: boolean;
}) {
  const { t } = useBuilderI18n();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const busy = ['loading', 'signing-in', 'signing-out'].includes(state.status);
  return (
    <section
      className={`dxp-ai-settings${compact ? ' compact' : ''}`}
      aria-label={t('aiSettings.aiSettings')}
    >
      {!compact && (
        <>
          <span className="dxp-eyebrow">{t('aiSettings.yourAiConnection')}</span>
          <h2>
            <Sparkles size={22} />
            {t('chatgpt.title')}
          </h2>
        </>
      )}
      <div className="dxp-chatgpt-card">
        <div role="status" aria-live="polite">
          <strong>{state.account ? state.account.name : t('chatgpt.account')}</strong>
          <p>
            {state.status === 'signing-in'
              ? t('chatgpt.signingIn')
              : state.status === 'signing-out'
                ? t('chatgpt.signingOut')
                : state.status === 'loading'
                  ? t('chatgpt.loading')
                  : state.account
                    ? t('chatgpt.signedIn')
                    : t('chatgpt.signedOut')}
          </p>
        </div>
        {state.account ? (
          <button
            className="dxp-button"
            type="button"
            disabled={busy}
            onClick={() => void store.signOut()}
          >
            {busy ? <LoaderCircle size={16} /> : <LogOut size={16} />}
            {t('chatgpt.signOut')}
          </button>
        ) : (
          <button
            className="dxp-button dxp-chatgpt-sign-in"
            type="button"
            disabled={busy || !state.available}
            onClick={() => void store.signIn()}
          >
            {busy && <LoaderCircle size={16} />}
            {t('chatgpt.title')}
          </button>
        )}
        {!state.available && !busy && (
          <p className="dxp-ai-settings-note">{t('chatgpt.unavailable')}</p>
        )}
        {state.error && (
          <div role="alert" className="dxp-error">
            <p>{t('chatgpt.error')}</p>
            <button
              className="dxp-button"
              type="button"
              disabled={busy}
              onClick={() => void store.refresh()}
            >
              {t('chatgpt.retry')}
            </button>
          </div>
        )}
      </div>
      <p className="dxp-ai-settings-note">
        {compact ? t('chatgpt.environmentCompact') : t('chatgpt.environment')}
      </p>
    </section>
  );
}
