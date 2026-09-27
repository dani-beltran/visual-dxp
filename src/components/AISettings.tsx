import { Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { resolveAIEndpoint } from '../lib/aiCredentials';
import type { AISettingsStore } from '../lib/aiSettings';
import '../styles/ai-settings.css';

export const AI_PRIVACY_TEXT =
  'Your API key is stored encrypted in this browser’s localStorage. When you use the AI assistant, it is sent over HTTPS to the configured AI server, which uses it to contact OpenAI without saving it. It is never included in your published site or workflow exports.';

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
  const [apiKey, setApiKey] = useState('');
  const defaultModel = process.env.NEXT_PUBLIC_OPENAI_MODEL?.trim() || '';  
  const [model, setModel] = useState(() => state.model || defaultModel);
  const [passphrase, setPassphrase] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (state.status !== 'unlocked') {
      setApiKey('');
      setPassphrase('');
      setVisible(false);
    }
  }, [state.status]);
  let origin = 'Invalid endpoint';
  let confirmation = false;
  let secure = false;
  try {
    const destination = resolveAIEndpoint(endpoint);
    origin = destination.origin;
    secure = destination.protocol === 'https:';
    confirmation = store.needsConfirmation(endpoint);
  } catch {
    /* Render a safe configuration error. */
  }
  const clear = () => {
    setApiKey('');
    setPassphrase('');
    setVisible(false);
  };
  async function action(work: () => void | Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings are unavailable. Try again.');
    } finally {
      clear();
      setBusy(false);
    }
  }
  if (compact && state.status === 'server') return null;
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
      {!compact && (
        <>
          <p role="status">
            <strong>
              {state.status === 'server'
                ? 'Server defaults active'
                : state.status === 'unlocked'
                  ? 'Browser settings active'
                  : state.status === 'locked'
                    ? 'Browser settings locked · unlock to use AI'
                    : 'Browser settings unavailable · AI blocked'}
            </strong>
            {state.model && <> · {state.model}</>}
          </p>
          <p className="dxp-ai-destination">
            Configured AI server: <strong>{origin}</strong>
          </p>
          {!secure && <p className="dxp-error">Browser credentials require an HTTPS AI server.</p>}
        </>
      )}
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          void action(() =>
            compact || state.status === 'locked'
              ? store.unlock(passphrase)
              : store.save(apiKey.trim(), model.trim(), passphrase, endpoint),
          );
        }}
      >
        {!compact && state.status !== 'locked' && (
          <>
            <label htmlFor={`${id}-key`}>OpenAI API key</label>
            <div className="dxp-ai-key-input">
              <input
                id={`${id}-key`}
                type={visible ? 'text' : 'password'}
                placeholder={
                  state.status === 'unlocked'
                    ? 'Key unlocked · enter a key to replace saved settings'
                    : undefined
                }
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
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
            <label htmlFor={`${id}-model`}>OpenAI model ID</label>
            <input
              id={`${id}-model`}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Enter an account-accessible model ID"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </>
        )}
        {(state.status === 'locked' || !compact) && (
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
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </>
        )}
        <div className="dxp-ai-settings-actions">
          {state.status === 'locked' ? (
            <button
              type="submit"
              className="dxp-button dxp-button-primary"
              disabled={busy || !passphrase}
            >
              Unlock browser settings
            </button>
          ) : (
            !compact && (
              <button
                type="submit"
                className="dxp-button dxp-button-primary"
                disabled={busy || !apiKey || !model || !passphrase}
              >
                Save browser settings
              </button>
            )
          )}
          {state.status === 'unlocked' && (
            <button
              type="button"
              className="dxp-button"
              onClick={() => {
                clear();
                store.lock();
              }}
            >
              <LockKeyhole size={14} /> Lock
            </button>
          )}
          {state.status !== 'server' && (
            <button
              type="button"
              className="dxp-button"
              disabled={busy}
              onClick={() => void action(store.remove)}
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
            Origin isolation prevents ordinary access by other sites. It cannot protect an unlocked
            key from malicious scripts in this builder or privileged browser extensions. Use a
            strong, unique passphrase; it cannot be recovered.
          </p>
        </>
      )}
      {confirmation && (
        <div className="dxp-ai-origin-confirm" role="alert">
          <p>
            Saved destination: <strong>{state.origin}</strong>. Allow this key to be sent to{' '}
            <strong>{origin}</strong> for this unlocked session?
          </p>
          <button
            type="button"
            className="dxp-button"
            onClick={() => void action(() => store.confirmOrigin(endpoint))}
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
    </section>
  );
}
