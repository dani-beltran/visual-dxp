import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AIProvider,
  type AIRequestConfiguration,
  allowsBrowserCredentials,
  isAIProvider,
  normalizeLocalBaseURL,
  resolveAIEndpoint,
  validAIKey,
  validAIModel,
} from './aiCredentials';

// Keep the historical key: replacing a v1 record with v2 is one atomic storage write.
export const AI_SETTINGS_STORAGE_KEY = 'visual-dxp-ai-settings-v1';
interface Cipher {
  version: 1 | 2;
  salt: number[];
  iv: number[];
  ciphertext: number[];
}
interface SavedConfig {
  damaged?: true;
  model: string;
  origin: string;
  baseURL?: string;
  credential?: Cipher;
}
interface Document {
  version: 2;
  activeProvider: AIProvider | null;
  viewedProvider: AIProvider;
  providers: Partial<Record<AIProvider, SavedConfig>>;
}
export interface ProviderSettingsSnapshot {
  status: 'server' | 'locked' | 'unlocked' | 'unavailable';
  model: string;
  origin: string;
  baseURL: string;
  hasCredential: boolean;
  error: string;
  errorKey?: 'aiSettings.storageUnavailable' | 'aiSettings.providerDamaged';
}
export interface AISettingsSnapshot extends ProviderSettingsSnapshot {
  activeProvider: AIProvider | null;
  viewedProvider: AIProvider;
  providers: Record<AIProvider, ProviderSettingsSnapshot>;
  effectiveRevision: number;
}
const blank = (): ProviderSettingsSnapshot => ({
  status: 'server',
  model: '',
  origin: '',
  baseURL: '',
  hasCredential: false,
  error: '',
});
const initial = (): Document => ({
  version: 2,
  activeProvider: null,
  viewedProvider: 'openai',
  providers: {},
});
const bytes = (value: unknown, min: number, max = min): value is number[] =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
function validateConfig(value: SavedConfig, provider: AIProvider) {
  if (
    !value ||
    !validAIModel(value.model) ||
    new URL(value.origin).origin !== value.origin ||
    !allowsBrowserCredentials(new URL(value.origin))
  )
    throw new Error();
  if (
    provider === 'local'
      ? !value.baseURL || normalizeLocalBaseURL(value.baseURL) !== value.baseURL
      : value.baseURL !== undefined
  )
    throw new Error();
  const c = value.credential;
  if (Object.hasOwn(value, 'credential') && !c) throw new Error();
  if (!c && provider !== 'local') throw new Error();
  if (
    c &&
    (![1, 2].includes(c.version) ||
      (c.version === 1 && provider !== 'openai') ||
      !bytes(c.salt, 16) ||
      !bytes(c.iv, 12) ||
      !bytes(c.ciphertext, 24, 528))
  )
    throw new Error();
}
function decode(raw: string): Document {
  const value = JSON.parse(raw);
  if (value?.version === 1) {
    const { model, origin, salt, iv, ciphertext } = value;
    const config: SavedConfig = { model, origin, credential: { version: 1, salt, iv, ciphertext } };
    validateConfig(config, 'openai');
    return { ...initial(), activeProvider: 'openai', providers: { openai: config } };
  }
  if (
    value?.version !== 2 ||
    (value.activeProvider !== null && !isAIProvider(value.activeProvider)) ||
    !isAIProvider(value.viewedProvider) ||
    !value.providers ||
    typeof value.providers !== 'object' ||
    Array.isArray(value.providers)
  )
    throw new Error();
  // Whitelist persisted fields: unknown properties never enter snapshots/requests.
  const doc: Document = {
    ...initial(),
    activeProvider: value.activeProvider,
    viewedProvider: value.viewedProvider,
  };
  for (const provider of AI_PROVIDERS) {
    const config = value.providers[provider];
    if (config !== undefined) {
      try {
        validateConfig(config, provider);
      } catch {
        doc.providers[provider] = { damaged: true, model: '', origin: '' };
        continue;
      }
      doc.providers[provider] = {
        model: config.model,
        origin: config.origin,
        ...(provider === 'local' ? { baseURL: config.baseURL } : {}),
        ...(config.credential
          ? {
              credential: {
                version: config.credential.version,
                salt: config.credential.salt,
                iv: config.credential.iv,
                ciphertext: config.credential.ciphertext,
              },
            }
          : {}),
      };
    }
  }
  // Older records implicitly selected OpenAI even when nothing had been saved.
  if (doc.activeProvider && !doc.providers[doc.activeProvider]) doc.activeProvider = null;
  return doc;
}
function aad(config: SavedConfig, provider: AIProvider, version: number) {
  return new TextEncoder().encode(
    JSON.stringify(
      version === 1
        ? [1, config.origin, config.model]
        : [2, provider, config.origin, config.model, config.baseURL ?? ''],
    ),
  );
}
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle)
    throw Object.assign(new Error('Web Crypto is unavailable. Use a secure browser context.'), {
      messageKey: 'errors.aiSettings.webCryptoIsUnavailableUseASecureBrowserContext',
      messageParams: {},
    });
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Secrets remain private and ephemeral. One atomic write saves and activates a provider. */
export class AISettingsStore {
  private doc = initial();
  private raw: string | null = null;
  private keys: Partial<Record<AIProvider, string>> = {};
  private confirmations: Partial<Record<AIProvider, string>> = {};
  private revision = 0;
  private effectiveRevision = 0;
  private unavailable = '';
  private listeners = new Set<() => void>();
  private requests = new Set<AbortController>();
  private snapshot = this.buildSnapshot();
  constructor(private storage: () => Storage = () => window.localStorage) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private buildSnapshot(): AISettingsSnapshot {
    const unavailable = this.unavailable
      ? {
          status: 'unavailable' as const,
          error: this.unavailable,
          errorKey: 'aiSettings.storageUnavailable' as const,
        }
      : {};
    const providers = Object.fromEntries(
      AI_PROVIDERS.map((provider) => {
        const saved = this.doc.providers[provider];
        return [
          provider,
          {
            ...blank(),
            ...(saved
              ? {
                  model: saved.model,
                  origin: saved.origin,
                  baseURL: saved.baseURL ?? '',
                  hasCredential: !!saved.credential,
                  status: saved.credential && !this.keys[provider] ? 'locked' : 'unlocked',
                }
              : {}),
            ...(saved?.damaged
              ? {
                  status: 'unavailable',
                  errorKey: 'aiSettings.providerDamaged',
                  error:
                    'This provider’s browser settings are damaged. Remove or replace its configuration.',
                }
              : {}),
            ...unavailable,
          },
        ];
      }),
    ) as Record<AIProvider, ProviderSettingsSnapshot>;
    return {
      ...(this.doc.activeProvider ? providers[this.doc.activeProvider] : blank()),
      ...unavailable,
      providers,
      activeProvider: this.doc.activeProvider,
      viewedProvider: this.doc.viewedProvider,
      effectiveRevision: this.effectiveRevision,
    };
  }
  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
  private cancel() {
    this.effectiveRevision++;
    for (const controller of this.requests)
      controller.abort(
        Object.assign(new Error('AI configuration changed. Send your message again.'), {
          messageKey: 'errors.aiSettings.aiConfigurationChangedSendYourMessageAgain',
          messageParams: {},
        }),
      );
    this.requests.clear();
  }
  refresh = () => {
    try {
      const raw = this.storage().getItem(AI_SETTINGS_STORAGE_KEY);
      if (raw === this.raw && !this.unavailable) return;
      const next = raw ? decode(raw) : initial();
      const oldActive = this.doc.activeProvider;
      let changed = oldActive !== next.activeProvider || !!this.unavailable;
      for (const provider of AI_PROVIDERS) {
        if (
          JSON.stringify(this.doc.providers[provider]) !== JSON.stringify(next.providers[provider])
        ) {
          delete this.keys[provider];
          delete this.confirmations[provider];
          if (provider === oldActive || provider === next.activeProvider) changed = true;
        }
      }
      this.doc = next;
      this.raw = raw;
      this.unavailable = '';
      this.revision++;
      if (changed) this.cancel();
      this.emit();
    } catch {
      this.revision++;
      this.keys = {};
      this.confirmations = {};
      this.cancel();
      this.unavailable =
        'Browser settings cannot be read. Restore storage access or remove the damaged settings before using AI.';
      this.emit();
    }
  };
  private persist(next: Document) {
    const raw = JSON.stringify(next);
    try {
      this.storage().setItem(AI_SETTINGS_STORAGE_KEY, raw);
    } catch {
      throw Object.assign(
        new Error(
          'Browser settings could not be saved. Enable localStorage and try again. Previous active settings were preserved.',
        ),
        {
          messageKey: 'errors.aiSettings.browserSettingsCouldNotBeSavedEnableLocalstorageAndTry',
          messageParams: {},
        },
      );
    }
    this.raw = raw;
    this.doc = next;
    this.unavailable = '';
    this.revision++;
  }
  view = (provider: AIProvider) => {
    this.refresh();
    if (this.unavailable) throw new Error(this.unavailable);
    this.persist({ ...this.doc, viewedProvider: provider });
    this.emit();
  };
  lock = () => {
    this.revision++;
    this.keys = {};
    this.confirmations = {};
    this.cancel();
    this.emit();
  };
  lockProvider(provider: AIProvider) {
    this.revision++;
    if (this.keys[provider] || this.confirmations[provider]) {
      delete this.keys[provider];
      delete this.confirmations[provider];
      if (provider === this.doc.activeProvider) this.cancel();
      this.emit();
    }
  }
  // Legacy API remains an OpenAI save-and-activate operation.
  save(apiKey: string, model: string, passphrase: string, endpoint: string) {
    return this.saveProvider('openai', { apiKey, model }, passphrase, endpoint);
  }
  async saveProvider(
    provider: AIProvider,
    input: { apiKey: string; model: string; baseURL?: string },
    passphrase: string,
    endpoint: string,
  ) {
    this.refresh();
    if (this.unavailable) throw new Error(this.unavailable);
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw Object.assign(new Error('Use an HTTPS AI server before saving browser settings.'), {
        messageKey: 'errors.aiSettings.useAnHttpsAiServerBeforeSavingBrowserSettings',
        messageParams: {},
      });
    const apiKey = input.apiKey.trim();
    const model = input.model.trim();
    if (
      !validAIModel(model) ||
      (provider === 'local' ? !!apiKey && !validAIKey(apiKey) : !validAIKey(apiKey))
    )
      throw Object.assign(new Error('Enter a valid API key and model ID.'), {
        messageKey: 'errors.aiSettings.enterAValidApiKeyAndModelId',
        messageParams: {},
      });
    const saved: SavedConfig = {
      model,
      origin: url.origin,
      ...(provider === 'local' ? { baseURL: normalizeLocalBaseURL(input.baseURL ?? '') } : {}),
    };
    if (
      apiKey &&
      (model.includes(apiKey) || saved.baseURL?.includes(apiKey) || url.href.includes(apiKey))
    )
      throw Object.assign(new Error('Keep credentials out of model IDs and URLs.'), {
        messageKey: 'errors.aiSettings.keepCredentialsOutOfModelIdsAndUrls',
        messageParams: {},
      });
    const revision = this.revision;
    if (apiKey) {
      if (passphrase.length < 12)
        throw Object.assign(new Error('Use a passphrase with at least 12 characters.'), {
          messageKey: 'errors.aiSettings.useAPassphraseWithAtLeast12Characters',
          messageParams: {},
        });
      if (!globalThis.crypto?.subtle)
        throw Object.assign(new Error('Web Crypto is unavailable. Use a secure browser context.'), {
          messageKey: 'errors.aiSettings.webCryptoIsUnavailableUseASecureBrowserContext',
          messageParams: {},
        });
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await derive(passphrase, salt);
      const plaintext = new TextEncoder().encode(apiKey);
      try {
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, additionalData: aad(saved, provider, 2) },
          key,
          plaintext,
        );
        saved.credential = {
          version: 2,
          salt: [...salt],
          iv: [...iv],
          ciphertext: [...new Uint8Array(ciphertext)],
        };
      } finally {
        plaintext.fill(0);
      }
    }
    this.refresh();
    if (revision !== this.revision)
      throw Object.assign(new Error('Settings changed. Save again.'), {
        messageKey: 'errors.aiSettings.settingsChangedSaveAgain',
        messageParams: {},
      });
    this.persist({
      ...this.doc,
      activeProvider: provider,
      providers: { ...this.doc.providers, [provider]: saved },
    });
    if (apiKey) this.keys[provider] = apiKey;
    else delete this.keys[provider];
    delete this.confirmations[provider];
    this.cancel();
    this.emit();
  }
  async unlock(passphrase: string, provider = this.doc.activeProvider ?? this.doc.viewedProvider) {
    this.refresh();
    const saved = this.doc.providers[provider];
    if (!saved?.credential || this.unavailable)
      throw Object.assign(
        new Error('Browser settings are unavailable. Restore storage access or remove them.'),
        {
          messageKey:
            'errors.aiSettings.browserSettingsAreUnavailableRestoreStorageAccessOrRemoveThem',
          messageParams: {},
        },
      );
    this.lockProvider(provider);
    const revision = this.revision;
    try {
      const c = saved.credential;
      const key = await derive(passphrase, new Uint8Array(c.salt));
      const plaintext = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(c.iv),
            additionalData: aad(saved, provider, c.version),
          },
          key,
          new Uint8Array(c.ciphertext),
        ),
      );
      let apiKey: string;
      try {
        apiKey = new TextDecoder().decode(plaintext);
      } finally {
        plaintext.fill(0);
      }
      this.refresh();
      if (!validAIKey(apiKey) || revision !== this.revision) throw new Error();
      this.keys[provider] = apiKey;
      if (provider === this.doc.activeProvider) this.cancel();
      this.emit();
    } catch {
      throw Object.assign(
        new Error(
          'Could not unlock settings. Check your passphrase, or remove settings and save a new key.',
        ),
        {
          messageKey: 'errors.aiSettings.couldNotUnlockSettingsCheckYourPassphraseOrRemoveSettings',
          messageParams: {},
        },
      );
    }
  }
  activate(provider: AIProvider, serverDefaults = false) {
    this.refresh();
    const state = this.snapshot.providers[provider];
    if (state.status === 'unavailable') throw new Error(state.error);
    if (state.status === 'locked')
      throw Object.assign(new Error('Unlock this provider before activating it.'), {
        messageKey: 'errors.aiSettings.unlockThisProviderBeforeActivatingIt',
        messageParams: {},
      });
    if (state.status === 'server' && !serverDefaults)
      throw Object.assign(new Error('Save a configuration before activating this provider.'), {
        messageKey: 'errors.aiSettings.saveAConfigurationBeforeActivatingThisProvider',
        messageParams: {},
      });
    if (provider === this.doc.activeProvider) return;
    this.persist({ ...this.doc, activeProvider: provider });
    this.cancel();
    this.emit();
  }
  remove = (provider = this.doc.activeProvider ?? this.doc.viewedProvider) => {
    this.refresh();
    const providers = { ...this.doc.providers };
    delete providers[provider];
    const wasActive = provider === this.doc.activeProvider;
    this.persist({
      ...this.doc,
      providers,
      activeProvider: wasActive ? null : this.doc.activeProvider,
    });
    delete this.keys[provider];
    delete this.confirmations[provider];
    if (wasActive) this.cancel();
    this.emit();
  };
  confirmOrigin(endpoint: string, provider = this.doc.activeProvider ?? this.doc.viewedProvider) {
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw Object.assign(new Error('Browser credentials require an HTTPS AI server.'), {
        messageKey: 'errors.aiSettings.browserCredentialsRequireAnHttpsAiServer',
        messageParams: {},
      });
    this.confirmations[provider] = url.origin;
    if (provider === this.doc.activeProvider) this.cancel();
    this.emit();
  }
  needsConfirmation(
    endpoint: string,
    provider = this.doc.activeProvider ?? this.doc.viewedProvider,
  ) {
    const origin = resolveAIEndpoint(endpoint).origin;
    const saved = this.doc.providers[provider];
    return !!saved && saved.origin !== origin && this.confirmations[provider] !== origin;
  }
  forRequest(endpoint: string, controller: AbortController): AIRequestConfiguration | undefined {
    this.refresh();
    const provider = this.doc.activeProvider;
    const state = this.snapshot;
    if (state.status === 'unavailable') throw new Error(state.error);
    if (!provider) {
      this.requests.add(controller);
      return undefined;
    }
    if (state.status === 'locked')
      throw Object.assign(
        new Error(`Unlock ${AI_PROVIDER_LABELS[provider]} in AI Settings before using AI.`),
        {
          messageKey: 'errors.aiSettings.unlockValue1InAiSettingsBeforeUsingAi',
          messageParams: { value1: String(AI_PROVIDER_LABELS[provider]) },
        },
      );
    if (state.status === 'server') {
      this.requests.add(controller);
      return { provider, source: 'server' };
    }
    const url = resolveAIEndpoint(endpoint);
    if (!allowsBrowserCredentials(url))
      throw Object.assign(new Error('Browser credentials require an HTTPS AI server.'), {
        messageKey: 'errors.aiSettings.browserCredentialsRequireAnHttpsAiServer',
        messageParams: {},
      });
    if (this.needsConfirmation(endpoint))
      throw Object.assign(
        new Error(
          'The AI server origin changed. Confirm the new destination in AI settings or the assistant before sending.',
        ),
        {
          messageKey: 'errors.aiSettings.theAiServerOriginChangedConfirmTheNewDestinationIn',
          messageParams: {},
        },
      );
    this.requests.add(controller);
    return {
      provider,
      source: 'browser',
      apiKey: this.keys[provider] ?? '',
      model: state.model,
      origin: url.origin,
      ...(provider === 'local' ? { baseURL: state.baseURL } : {}),
    };
  }
  finishRequest(controller: AbortController) {
    this.requests.delete(controller);
  }
}
