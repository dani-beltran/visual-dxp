import '../../styles/base.css';
import '../../styles/shared.css';
import { Eye, EyeOff, Info, KeyRound, LockKeyhole } from 'lucide-react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AIProvider,
  allowsBrowserCredentials,
  resolveAIEndpoint,
} from '../../lib/aiCredentials';
import type { AISettingsStore } from '../../lib/aiSettings';
import { formatBuilderError } from '../../lib/i18n';
import { useBuilderI18n } from '../../lib/i18nContext';
import { AIProviderIcon } from '../AIProviderIcon/AIProviderIcon';
import './AISettings.css';

export const AI_PRIVACY_TEXT =
  'Your API key is stored encrypted in this browser’s localStorage. When you use the AI assistant, it is sent to the configured application AI server over HTTPS, which contacts the selected provider without saving it. It is never included in your published site or workflow exports.';

export function AISettings({
  store,
  endpoint,
  compact = false,
}: {
  store: AISettingsStore;
  endpoint: string;
  compact?: boolean;
}) {
  const { t, direction } = useBuilderI18n();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const id = useId();
  const [error, setError] = useState('');
  const viewed = state.viewedProvider;
  const label = state.activeProvider ? AI_PROVIDER_LABELS[state.activeProvider] : null;
  function view(provider: AIProvider) {
    try {
      store.view(provider);
      setError('');
    } catch (cause) {
      setError(formatBuilderError(cause, t));
    }
  }
  return (
    <section
      className={`dxp-ai-settings ${compact ? 'compact' : ''}`}
      aria-label={compact ? t('aiSettings.assistantCredentials') : t('aiSettings.aiSettings')}
    >
      {!compact && (
        <>
          <span className="dxp-eyebrow">{t('aiSettings.yourAiConnection')}</span>
          <h2>
            <KeyRound size={22} /> {t('aiSettings.aiSettings2')}
          </h2>
        </>
      )}
      <p role="status">
        <strong>
          {label ? t('aiSettings.activeProvider', { label }) : t('aiSettings.noActiveProvider')}
        </strong>{' '}
        ·{' '}
        {state.status === 'locked'
          ? t('aiSettings.lockedUnlockToUseAi')
          : state.status === 'unavailable'
            ? t('aiSettings.unavailableRestoreOrRemoveBrowserSettings')
            : state.status === 'server'
              ? t('aiSettings.noSavedConfiguration')
              : t('aiSettings.browserSettingsReady')}
      </p>
      <div className="dxp-ai-provider-tabs" role="tablist" aria-label={t('aiSettings.aiProviders')}>
        {AI_PROVIDERS.map((provider, index) => (
          <button
            key={provider}
            id={`${id}-${provider}`}
            role="tab"
            type="button"
            aria-selected={viewed === provider}
            aria-controls={`${id}-panel-${provider}`}
            tabIndex={viewed === provider ? 0 : -1}
            onClick={() => view(provider)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + (direction === 'ltr' ? 1 : 2)) % 3
                  : event.key === 'ArrowLeft'
                    ? (index + (direction === 'ltr' ? 2 : 1)) % 3
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 2
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              view(AI_PROVIDERS[next]);
              document.getElementById(`${id}-${AI_PROVIDERS[next]}`)?.focus();
            }}
          >
            <AIProviderIcon provider={provider} />
            <span>{AI_PROVIDER_LABELS[provider]}</span>
            {state.activeProvider === provider && (
              <span className="dxp-ai-active-badge">{t('aiSettings.active')}</span>
            )}
          </button>
        ))}
      </div>
      {AI_PROVIDERS.map((provider) => (
        <div
          key={provider}
          role="tabpanel"
          id={`${id}-panel-${provider}`}
          aria-labelledby={`${id}-${provider}`}
          hidden={viewed !== provider}
        >
          {viewed === provider && (
            <ProviderForm
              key={provider}
              provider={provider}
              store={store}
              endpoint={endpoint}
              compact={compact}
            />
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="dxp-error">
          {error}
        </p>
      )}
    </section>
  );
}

function ProviderForm({
  provider,
  store,
  endpoint,
  compact,
}: {
  provider: AIProvider;
  store: AISettingsStore;
  endpoint: string;
  compact: boolean;
}) {
  const { t } = useBuilderI18n();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const state = snapshot.providers[provider];
  const stateError = state.errorKey ? t(state.errorKey) : state.error;
  const label = AI_PROVIDER_LABELS[provider];
  const id = useId();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(
    state.model ||
      (provider === 'openai' ? process.env.NEXT_PUBLIC_OPENAI_MODEL?.trim() || '' : ''),
  );
  const [baseURL, setBaseURL] = useState(state.baseURL || '');
  const [passphrase, setPassphrase] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear unsaved secrets when another view or tab locks/replaces this configuration.
  useEffect(() => {
    setApiKey('');
    setPassphrase('');
    setVisible(false);
  }, [state.status]);
  useEffect(() => {
    setModel(
      state.model ||
        (provider === 'openai' ? process.env.NEXT_PUBLIC_OPENAI_MODEL?.trim() || '' : ''),
    );
    setBaseURL(state.baseURL || '');
  }, [state.model, state.baseURL, provider]);
  let origin = t('aiSettings.invalidEndpoint');
  let confirmation = false;
  let secure = false;
  try {
    const url = resolveAIEndpoint(endpoint);
    origin = url.origin;
    secure = allowsBrowserCredentials(url);
    confirmation = store.needsConfirmation(endpoint, provider);
  } catch {
    /* Render configuration status. */
  }
  async function action(work: () => void | Promise<void>, message = '') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await work();
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? formatBuilderError(cause, t) : t('aiSettings.settingsUnavailable'),
      );
    } finally {
      setApiKey('');
      setPassphrase('');
      setVisible(false);
      setBusy(false);
    }
  }
  return (
    <>
      {!secure && (
        <p className="dxp-error">{t('aiSettings.browserCredentialsRequireAnHttpsAiServer')}</p>
      )}
      <p>
        {state.status === 'locked'
          ? t('aiSettings.labelBrowserSettingsAreLockedUnlockBeforeUsingOrActivatingThem', {
              label: String(label),
            })
          : state.status === 'unlocked'
            ? t('aiSettings.labelSavedConfigurationIsReadySavedModelModel', {
                label: String(label),
                model: String(state.model),
              })
            : state.status === 'server'
              ? t('aiSettings.configureLabelBelowThenSaveAndActivateIt', { label: String(label) })
              : stateError}
      </p>
      {provider === 'local' && (
        <div
          className="dxp-ai-settings-info"
          role="note"
          aria-label={t('aiSettings.selfHostedSetupInformation')}
        >
          <Info size={18} aria-hidden="true" />
          <p>{t('aiSettings.enterTheApiBaseUrlOfYourSelfHostedOpenaiCompatibleModel')}</p>
        </div>
      )}
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          void action(
            () =>
              state.status === 'locked'
                ? store.unlock(passphrase, provider)
                : store.saveProvider(
                    provider,
                    { apiKey, model, ...(provider === 'local' ? { baseURL } : {}) },
                    passphrase,
                    endpoint,
                  ),
            state.status === 'locked'
              ? t('aiSettings.unlockedUseActivateSavedConfigurationToSelectThisProvider')
              : t('aiSettings.labelSavedAndActivated', { label: String(label) }),
          );
        }}
      >
        {state.status !== 'locked' && (
          <>
            {provider === 'local' && (
              <>
                <label htmlFor={`${id}-url`}>{t('aiSettings.selfHostedApiBaseUrl')}</label>
                <input
                  id={`${id}-url`}
                  value={baseURL}
                  placeholder="https://models.example.com/v1"
                  onChange={(e) => setBaseURL(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                />
              </>
            )}
            <label htmlFor={`${id}-key`}>
              {t('aiSettings.apiKeyLabel', {
                provider: provider === 'claude' ? 'Anthropic' : label,
                optional: provider === 'local',
              })}
            </label>
            <div className="dxp-ai-key-input">
              <input
                id={`${id}-key`}
                type={visible ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  state.hasCredential
                    ? t('aiSettings.enterAKeyToReplaceSettingsUseActivateForSavedSettings')
                    : undefined
                }
              />
              <button
                className="dxp-icon-button"
                type="button"
                aria-label={visible ? t('aiSettings.hideApiKey') : t('aiSettings.showApiKey')}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <label htmlFor={`${id}-model`}>{t('aiSettings.modelLabel', { provider: label })}</label>
            <input
              id={`${id}-model`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('aiSettings.enterAnAvailableModelId')}
            />
          </>
        )}
        {(state.status === 'locked' || provider !== 'local' || !!apiKey) && (
          <>
            <label htmlFor={`${id}-pass`}>
              {state.status === 'locked'
                ? t('aiSettings.passphraseToUnlock')
                : t('aiSettings.encryptionPassphraseAtLeast12Characters')}
            </label>
            <input
              id={`${id}-pass`}
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </>
        )}
        <div className="dxp-ai-settings-actions">
          <button type="submit" className="dxp-button dxp-button-primary" disabled={busy}>
            {state.status === 'locked'
              ? t('aiSettings.unlockBrowserSettings')
              : t('aiSettings.saveAndActivate')}
          </button>
          {state.status === 'unlocked' && snapshot.activeProvider !== provider && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() =>
                void action(
                  () => store.activate(provider),
                  t('aiSettings.labelActivatedUsingSavedSettings', { label: String(label) }),
                )
              }
            >
              {t('aiSettings.activateSavedConfiguration')}
            </button>
          )}
          {state.status === 'unlocked' && state.hasCredential && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() => void action(() => store.lockProvider(provider))}
            >
              <LockKeyhole size={14} /> {t('aiSettings.lock')}
            </button>
          )}
          {state.status !== 'server' && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() =>
                void action(
                  () => store.remove(provider),
                  t('aiSettings.labelConfigurationRemovedConfigureItAgainBelowWhenYouReReady', {
                    label: String(label),
                  }),
                )
              }
            >
              {t('aiSettings.removeBrowserSettings')}
            </button>
          )}
        </div>
        {(error || state.error) && (
          <p className="dxp-error" role="alert">
            {error || stateError}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </form>
      {!compact && (
        <>
          <p>{t('aiSettings.privacy')}</p>
          <p className="dxp-ai-settings-note">
            {t('aiSettings.yourBrowserNormallyKeepsOtherWebsitesFromAccessingYourSavedApiKey')}
          </p>
        </>
      )}
      {confirmation && (
        <div className="dxp-ai-origin-confirm" role="alert">
          <p>
            {t('aiSettings.confirmDestination', { previous: state.origin || '', next: origin })}
          </p>
          <button
            type="button"
            className="dxp-button"
            onClick={() => void action(() => store.confirmOrigin(endpoint, provider))}
          >
            {t('aiSettings.confirmNewServerOrigin')}
          </button>
        </div>
      )}
    </>
  );
}
