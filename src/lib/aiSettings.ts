import {
  allowsBrowserCredentials,
  type BrowserAIOverride,
  resolveAIEndpoint,
  validAIKey,
  validAIModel,
} from './aiCredentials';

export const AI_SETTINGS_STORAGE_KEY = 'dlb-dxp-ai-settings-v1';
const iterations = 600_000;
interface Envelope {
  version: 1;
  salt: number[];
  iv: number[];
  ciphertext: number[];
  model: string;
  origin: string;
}
export interface AISettingsSnapshot {
  status: 'server' | 'locked' | 'unlocked' | 'unavailable';
  model: string;
  origin: string;
  error: string;
}
const empty: AISettingsSnapshot = { status: 'server', model: '', origin: '', error: '' };
const bytes = (value: unknown, min: number, max = min): value is number[] =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
function decode(raw: string): Envelope {
  const value = JSON.parse(raw) as Envelope;
  if (
    value?.version !== 1 ||
    !bytes(value.salt, 16) ||
    !bytes(value.iv, 12) ||
    !bytes(value.ciphertext, 24, 528) ||
    !validAIModel(value.model) ||
    new URL(value.origin).origin !== value.origin ||
    !allowsBrowserCredentials(new URL(value.origin))
  )
    throw new Error();
  return value;
}
function aad(value: Pick<Envelope, 'origin' | 'model'>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([1, value.origin, value.model]));
}
async function derive(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle)
    throw new Error('Web Crypto is unavailable. Use a secure browser context.');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Secrets never enter React snapshots, workflow state, history, or persisted plaintext. */
export class AISettingsStore {
  private snapshot = empty;
  private raw: string | null = null;
  private apiKey: string | null = null;
  private confirmedOrigin: string | null = null;
  private revision = 0;
  private listeners = new Set<() => void>();
  private requests = new Set<AbortController>();
  constructor(private storage: () => Storage = () => window.localStorage) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(snapshot: AISettingsSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  private clear() {
    this.revision++;
    this.apiKey = null;
    this.confirmedOrigin = null;
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
  }
  refresh = () => {
    try {
      const raw = this.storage().getItem(AI_SETTINGS_STORAGE_KEY);
      if (raw === this.raw && this.snapshot.status !== 'unavailable') return;
      this.clear();
      this.raw = raw;
      const value = raw ? decode(raw) : null;
      this.emit(
        value ? { status: 'locked', model: value.model, origin: value.origin, error: '' } : empty,
      );
    } catch {
      this.clear();
      this.emit({
        ...empty,
        status: 'unavailable',
        error:
          'Browser settings cannot be read. Restore storage access or remove the damaged settings before using AI.',
      });
    }
  };
  lock = () => {
    this.clear();
    if (this.snapshot.status === 'unlocked')
      this.emit({ ...this.snapshot, status: 'locked', error: '' });
  };
  async save(apiKey: string, model: string, passphrase: string, endpoint: string) {
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw new Error('Use an HTTPS AI server before saving browser credentials.');
    if (!validAIKey(apiKey) || !validAIModel(model))
      throw new Error('Enter a valid API key and model ID.');
    if (passphrase.length < 12) throw new Error('Use a passphrase with at least 12 characters.');
    this.lock();
    const revision = this.revision;
    if (!globalThis.crypto?.subtle)
      throw new Error('Web Crypto is unavailable. Use a secure browser context.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(passphrase, salt);
    const metadata = { origin: url.origin, model };
    const plaintext = new TextEncoder().encode(apiKey);
    let ciphertext: ArrayBuffer;
    try {
      ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad(metadata) },
        key,
        plaintext,
      );
    } finally {
      plaintext.fill(0);
    }
    if (revision !== this.revision) throw new Error('Settings changed. Save again.');
    const raw = JSON.stringify({
      version: 1,
      salt: [...salt],
      iv: [...iv],
      ciphertext: [...new Uint8Array(ciphertext)],
      ...metadata,
    });
    try {
      this.storage().setItem(AI_SETTINGS_STORAGE_KEY, raw);
    } catch {
      this.clear();
      this.emit({
        ...empty,
        status: 'unavailable',
        error:
          'Browser settings could not be saved. Enable localStorage and save again, or remove browser settings.',
      });
      throw new Error(this.snapshot.error);
    }
    this.raw = raw;
    this.apiKey = apiKey;
    this.emit({ status: 'unlocked', ...metadata, error: '' });
  }
  async unlock(passphrase: string) {
    this.refresh();
    if (!this.raw || this.snapshot.status === 'unavailable')
      throw new Error('Browser settings are unavailable. Restore storage access or remove them.');
    this.lock();
    const revision = this.revision;
    try {
      const value = decode(this.raw);
      const key = await derive(passphrase, new Uint8Array(value.salt));
      const plaintext = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(value.iv), additionalData: aad(value) },
          key,
          new Uint8Array(value.ciphertext),
        ),
      );
      let apiKey: string;
      try {
        apiKey = new TextDecoder().decode(plaintext);
      } finally {
        plaintext.fill(0);
      }
      if (!validAIKey(apiKey) || revision !== this.revision) throw new Error();
      this.apiKey = apiKey;
      this.emit({ status: 'unlocked', origin: value.origin, model: value.model, error: '' });
    } catch {
      throw new Error(
        'Could not unlock settings. Check your passphrase, or remove settings and save a new key.',
      );
    }
  }
  remove = () => {
    this.lock();
    try {
      this.storage().removeItem(AI_SETTINGS_STORAGE_KEY);
    } catch {
      throw new Error('Settings could not be removed. Enable localStorage access and try again.');
    }
    this.raw = null;
    this.emit(empty);
  };
  confirmOrigin(endpoint: string) {
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw new Error('Browser credentials require an HTTPS AI server.');
    this.confirmedOrigin = url.origin;
    this.emit({ ...this.snapshot });
  }
  needsConfirmation(endpoint: string) {
    const origin = resolveAIEndpoint(endpoint).origin;
    return Boolean(
      this.snapshot.origin && origin !== this.snapshot.origin && origin !== this.confirmedOrigin,
    );
  }
  forRequest(endpoint: string, controller: AbortController): BrowserAIOverride | undefined {
    this.refresh();
    if (this.snapshot.status === 'server') return;
    if (this.snapshot.status === 'unavailable') throw new Error(this.snapshot.error);
    if (!this.apiKey || this.snapshot.status !== 'unlocked')
      throw new Error(
        'Unlock AI settings in the corresponding section.',
      );
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw new Error('Browser credentials require an HTTPS AI server.');
    if (this.needsConfirmation(endpoint))
      throw new Error(
        'The AI server origin changed. Confirm the new destination in AI settings or the assistant before sending.',
      );
    this.requests.add(controller);
    return { apiKey: this.apiKey, model: this.snapshot.model, origin: url.origin };
  }
  finishRequest(controller: AbortController) {
    this.requests.delete(controller);
  }
}
