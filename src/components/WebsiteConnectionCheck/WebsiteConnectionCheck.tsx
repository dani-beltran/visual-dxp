import '../../styles/base.css';
import '../../styles/shared.css';
import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BRANDING_PROTOCOL, parseBrandingProfile, saveBrandingProfile } from '../../lib/branding';
import { useBuilderI18n } from '../../lib/i18nContext';
import { PICKER_PROTOCOL } from '../../lib/picker';
import { usePreviewUrl } from '../../lib/previewTransport';
import { WebsiteSetup } from '../WebsiteSetup/WebsiteSetup';
import './WebsiteConnectionCheck.css';

/** Mount with a URL key so edits immediately discard the previous connection result. */
export function WebsiteConnectionCheck({ url, silent = false }: { url: string; silent?: boolean }) {
  const { t } = useBuilderI18n();
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<
    'loading' | 'connected' | 'unavailable' | 'branding-unavailable'
  >('loading');
  const [readingBranding, setReadingBranding] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const preview = usePreviewUrl(started ? url : '');

  useEffect(() => {
    const debounce = window.setTimeout(() => setStarted(true), 500);
    return () => window.clearTimeout(debounce);
  }, []);

  useEffect(() => {
    if (!started || status !== 'loading') return;
    if (preview.error) {
      setStatus('unavailable');
      return;
    }
    if (!preview.url) return;
    const frame = frameRef.current;
    const target = frame?.contentWindow;
    let channel = crypto.randomUUID();
    let finished = false;
    let connected = false;
    let timeout: ReturnType<typeof setTimeout>;
    const send = (type: string, protocol = PICKER_PROTOCOL) =>
      target?.postMessage({ protocol, type, channel }, '*');
    const finish = (result: 'connected' | 'unavailable' | 'branding-unavailable') => {
      if (finished) return;
      finished = true;
      setStatus(result);
    };
    const initialize = () => {
      if (!finished && !connected) send('init');
    };
    const loaded = () => {
      send('stop', BRANDING_PROTOCOL);
      channel = crypto.randomUUID();
      connected = false;
      setReadingBranding(false);
      clearTimeout(timeout);
      timeout = setTimeout(failed, 8000);
      initialize();
    };
    const failed = () => finish(connected ? 'branding-unavailable' : 'unavailable');
    const receive = (event: MessageEvent) => {
      if (finished || event.source !== target || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.channel !== channel) return;
      if (data.protocol === PICKER_PROTOCOL && data.type === 'ready' && !connected) {
        connected = true;
        setReadingBranding(true);
        clearTimeout(timeout);
        timeout = setTimeout(failed, 8000);
        send('extract', BRANDING_PROTOCOL);
      }
      if (connected && data.protocol === BRANDING_PROTOCOL) {
        if (data.type === 'error') finish('branding-unavailable');
        if (data.type === 'profile') {
          try {
            const profile = parseBrandingProfile(data.profile);
            const persisted = saveBrandingProfile(profile, url);
            setStorageUnavailable(!persisted);
            console.info(
              '[Visual DXP branding bridge]',
              'Branding profile received successfully.',
              {
                savedToLocalStorage: persisted,
                sampledElements: Object.keys(profile.elements),
              },
            );
            finish('connected');
          } catch {
            /* Ignore malformed responses; the bounded timeout reports failure. */
          }
        }
      }
    };
    frame?.addEventListener('load', loaded);
    frame?.addEventListener('error', failed);
    window.addEventListener('message', receive);
    const retry = window.setInterval(initialize, 1000);
    timeout = setTimeout(failed, 8000);
    initialize();
    return () => {
      finished = true;
      send('stop', BRANDING_PROTOCOL);
      send('stop');
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      frame?.removeEventListener('load', loaded);
      frame?.removeEventListener('error', failed);
      window.removeEventListener('message', receive);
    };
  }, [started, status, url, preview.url, preview.error]);

  return (
    <div
      className={silent ? undefined : 'dxp-website-connection'}
      style={silent ? { display: 'contents' } : undefined}
    >
      {started && status === 'loading' && preview.url && (
        <iframe
          ref={frameRef}
          src={preview.url}
          title={t('websiteConnectionCheck.websiteConnectionCheck')}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: 1440,
            height: 900,
            border: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {!silent && (
        <div
          className={`dxp-website-connection-status dxp-website-connection-${status}`}
          role="status"
        >
          {status === 'loading' ? (
            <>
              <LoaderCircle size={16} aria-hidden="true" />{' '}
              {t(
                readingBranding
                  ? 'websiteConnectionCheck.readingBranding'
                  : 'websiteConnectionCheck.connectingToYourWebsite',
              )}
            </>
          ) : status === 'connected' ? (
            <>
              <Check size={16} aria-hidden="true" />{' '}
              {t('websiteConnectionCheck.websiteConnectedSuccessfully')}
            </>
          ) : status === 'branding-unavailable' ? (
            <span>{t('websiteConnectionCheck.brandingUnavailable')}</span>
          ) : (
            <div className="dxp-website-connection-error">
              <h3>{t('websiteConnectionCheck.connectionNeedsAttention')}</h3>
              <span>
                {preview.error ||
                  t('websiteConnectionCheck.couldnTConnectToYourWebsiteCompleteTheSetupBelow')}
              </span>
            </div>
          )}
        </div>
      )}
      {!silent && storageUnavailable && (
        <p role="status">{t('websiteConnectionCheck.brandingStorageUnavailable')}</p>
      )}
      {!silent && status === 'unavailable' && <WebsiteSetup />}
    </div>
  );
}
