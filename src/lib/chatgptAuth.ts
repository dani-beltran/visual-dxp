/** Public session display state only. OAuth tokens and provider configuration never enter this store. */
export interface ChatGPTSession {
  available: boolean;
  account: { name: string } | null;
}
export interface ChatGPTAuthState extends ChatGPTSession {
  status: 'loading' | 'signed-out' | 'signing-in' | 'signed-in' | 'signing-out';
  error: boolean;
}
export class ChatGPTAuthStore {
  private state: ChatGPTAuthState = {
    available: false,
    account: null,
    status: 'signed-out',
    error: false,
  };
  private listeners = new Set<() => void>();
  private revision = 0;
  constructor(
    private endpoint?: string,
    private navigate = (url: string) => window.location.assign(url),
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(patch: Partial<ChatGPTAuthState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private async call(action = '') {
    if (!this.endpoint) throw new Error('Sign-in unavailable.');
    const url = new URL(this.endpoint.replace(/\/$/, '') + action, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Sign-in requires a same-origin endpoint.');
    const result = await fetch(url.href, {
      method: action ? 'POST' : 'GET',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok || result.redirected) throw new Error('Sign-in request failed.');
    return result.json();
  }
  refresh = async (restore = false) => {
    if (!this.endpoint || (!restore && ['signing-in', 'signing-out'].includes(this.state.status)))
      return;
    const revision = ++this.revision;
    this.set({ status: 'loading', error: false });
    try {
      const session = await this.call();
      if (revision !== this.revision) return;
      if (
        typeof session.available !== 'boolean' ||
        (session.account !== null && typeof session.account?.name !== 'string')
      )
        throw new Error('Invalid session.');
      this.set({
        available: session.available,
        account: session.account,
        status: session.account ? 'signed-in' : 'signed-out',
        error: !!session.error,
      });
    } catch {
      if (revision === this.revision)
        this.set({ status: 'signed-out', account: null, error: true });
    }
  };
  signIn = async () => {
    if (!this.state.available || this.state.status !== 'signed-out') return;
    const revision = ++this.revision;
    this.set({ status: 'signing-in', error: false });
    try {
      const result = await this.call('/sign-in');
      if (revision !== this.revision) return;
      const url = new URL(result.authorizationUrl);
      if (url.origin !== 'https://auth.openai.com' || url.username || url.password)
        throw new Error('Invalid authorization URL.');
      this.navigate(url.href);
    } catch {
      if (revision === this.revision) this.set({ status: 'signed-out', error: true });
    }
  };
  signOut = async () => {
    if (this.state.status !== 'signed-in') return;
    ++this.revision;
    this.set({ status: 'signing-out', error: false });
    try {
      await this.call('/sign-out');
      this.set({ account: null, status: 'signed-out' });
    } catch {
      this.set({ status: 'signed-in', error: true });
    }
  };
}
