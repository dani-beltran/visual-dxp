import { Eye, EyeOff, Info, KeyRound, LockKeyhole } from 'lucide-react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AIProvider,
  allowsBrowserCredentials,
  resolveAIEndpoint,
} from '../lib/aiCredentials';
import type { AISettingsStore } from '../lib/aiSettings';
import { AIProviderIcon } from './AIProviderIcon';
import '../styles/ai-settings.css';

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
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const id = useId();
  const [error, setError] = useState('');
  const viewed = state.viewedProvider;
  const label = AI_PROVIDER_LABELS[state.activeProvider];
  function view(provider: AIProvider) {
    try {
      store.view(provider);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <section
      className={`dxp-ai-settings ${compact ? 'compact' : ''}`}
      aria-label={compact ? 'Assistant credentials' : 'AI settings'}
    >
      {!compact && (
        <>
          <span className="dxp-eyebrow">YOUR AI CONNECTION</span>
          <h2>
            <KeyRound size={22} /> AI Settings
          </h2>
        </>
      )}
      <p role="status">
        <strong>Active provider: {label}</strong> ·{' '}
        {state.status === 'locked'
          ? 'Locked — unlock to use AI'
          : state.status === 'unavailable'
            ? 'Unavailable — restore or remove browser settings'
            : state.status === 'server'
              ? 'No saved configuration'
              : 'Browser settings ready'}
      </p>
      <div className="dxp-ai-provider-tabs" role="tablist" aria-label="AI providers">
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
                  ? (index + 1) % 3
                  : event.key === 'ArrowLeft'
                    ? (index + 2) % 3
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
              <span className="dxp-ai-active-badge">Active</span>
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
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const state = snapshot.providers[provider];
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
  let origin = 'Invalid endpoint';
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
      setError(cause instanceof Error ? cause.message : 'Settings unavailable.');
    } finally {
      setApiKey('');
      setPassphrase('');
      setVisible(false);
      setBusy(false);
    }
  }
  return (
    <>
      {!secure && <p className="dxp-error">Browser credentials require an HTTPS AI server.</p>}
      <p>
        {state.status === 'locked'
          ? `${label} browser settings are locked. Unlock before using or activating them.`
          : state.status === 'unlocked'
            ? `${label} saved configuration is ready. Saved model: ${state.model}.`
            : state.status === 'server'
              ? `Configure ${label} below, then save and activate it.`
              : state.error}
      </p>
      {provider === 'local' && (
        <div
          className="dxp-ai-settings-info"
          role="note"
          aria-label="Self-Hosted setup information"
        >
          <Info size={18} aria-hidden="true" />
          <p>
            Enter the API base URL of your self-hosted, OpenAI-compatible model server. The URL must
            be reachable by the application backend and allowed by the administrator. A server
            hosted locally on your computer won’t work because the backend won’t be able to reach
            it. The selected model must support tool calls for workflow editing.
          </p>
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
              ? 'Unlocked. Use Activate saved configuration to select this provider.'
              : `${label} saved and activated.`,
          );
        }}
      >
        {state.status !== 'locked' && (
          <>
            {provider === 'local' && (
              <>
                <label htmlFor={`${id}-url`}>Self-Hosted API base URL</label>
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
              {provider === 'claude' ? 'Anthropic' : label} API key
              {provider === 'local' ? ' (optional)' : ''}
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
                    ? 'Enter a key to replace settings; use Activate for saved settings'
                    : undefined
                }
              />
              <button
                className="dxp-icon-button"
                type="button"
                aria-label={visible ? 'Hide API key' : 'Show API key'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <label htmlFor={`${id}-model`}>{label} model ID</label>
            <input
              id={`${id}-model`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter an available model ID"
            />
          </>
        )}
        {(state.status === 'locked' || provider !== 'local' || !!apiKey) && (
          <>
            <label htmlFor={`${id}-pass`}>
              {state.status === 'locked'
                ? 'Passphrase to unlock'
                : 'Encryption passphrase (at least 12 characters)'}
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
          <button
            type="submit"
            className="dxp-button dxp-button-primary"
            disabled={
              busy ||
              (state.status === 'locked'
                ? !passphrase
                : !model || (provider !== 'local' && !apiKey) || (!!apiKey && !passphrase))
            }
          >
            {state.status === 'locked' ? 'Unlock browser settings' : 'Save and activate'}
          </button>
          {state.status === 'unlocked' && snapshot.activeProvider !== provider && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() =>
                void action(
                  () => store.activate(provider),
                  `${label} activated using saved settings.`,
                )
              }
            >
              Activate saved configuration
            </button>
          )}
          {state.status === 'unlocked' && state.hasCredential && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() => void action(() => store.lockProvider(provider))}
            >
              <LockKeyhole size={14} /> Lock
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
                  `${label} configuration removed. Configure it again below when you’re ready.`,
                )
              }
            >
              Remove browser settings
            </button>
          )}
        </div>
      </form>
      {!compact && (
        <>
          <p>{AI_PRIVACY_TEXT}</p>
          <p className="dxp-ai-settings-note">
            Your browser normally keeps other websites from accessing your saved API key. While the
            key is unlocked, harmful code in this app or browser extensions with special permissions
            could still access it. Choose a strong passphrase you don’t use elsewhere, and keep it
            safe—we can’t recover it if you forget it.
          </p>
        </>
      )}
      {confirmation && (
        <div className="dxp-ai-origin-confirm" role="alert">
          <p>
            Saved destination: <strong>{state.origin}</strong>. Allow this configuration to be sent
            to <strong>{origin}</strong> for this unlocked session?
          </p>
          <button
            type="button"
            className="dxp-button"
            onClick={() => void action(() => store.confirmOrigin(endpoint, provider))}
          >
            Confirm new server origin
          </button>
        </div>
      )}
      {(error || state.error) && (
        <p className="dxp-error" role="alert">
          {error || state.error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
