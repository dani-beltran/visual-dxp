import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import { PICKER_PROTOCOL } from '../lib/picker';
import { WebsiteSetup } from './WebsiteSetup';

/** Mount with a URL key so edits immediately discard the previous connection result. */
export function WebsiteConnectionCheck({ url }: { url: string }) {
  const { t } = useBuilderI18n();
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'connected' | 'unavailable'>('loading');
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const debounce = window.setTimeout(() => setStarted(true), 500);
    return () => window.clearTimeout(debounce);
  }, []);

  useEffect(() => {
    if (!started || status !== 'loading') return;
    const frame = frameRef.current;
    const target = frame?.contentWindow;
    let channel = crypto.randomUUID();
    let finished = false;
    const send = (type: string) =>
      target?.postMessage({ protocol: PICKER_PROTOCOL, type, channel }, '*');
    const finish = (result: 'connected' | 'unavailable') => {
      if (finished) return;
      finished = true;
      setStatus(result);
    };
    const initialize = () => {
      if (!finished) send('init');
    };
    const loaded = () => {
      channel = crypto.randomUUID();
      initialize();
    };
    const failed = () => finish('unavailable');
    const receive = (event: MessageEvent) => {
      if (event.source !== target || event.origin !== 'null') return;
      const data = event.data;
      if (data?.protocol === PICKER_PROTOCOL && data.channel === channel && data.type === 'ready')
        finish('connected');
    };
    frame?.addEventListener('load', loaded);
    frame?.addEventListener('error', failed);
    window.addEventListener('message', receive);
    const retry = window.setInterval(initialize, 1000);
    const timeout = window.setTimeout(failed, 8000);
    initialize();
    return () => {
      finished = true;
      send('stop');
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      frame?.removeEventListener('load', loaded);
      frame?.removeEventListener('error', failed);
      window.removeEventListener('message', receive);
    };
  }, [started, status]);

  return (
    <div className="dxp-website-connection">
      {started && status === 'loading' && (
        <iframe
          ref={frameRef}
          src={url}
          title={t('websiteConnectionCheck.websiteConnectionCheck')}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          hidden
        />
      )}
      <div
        className={`dxp-website-connection-status dxp-website-connection-${status}`}
        role="status"
      >
        {status === 'loading' ? (
          <>
            <LoaderCircle size={16} aria-hidden="true" />{' '}
            {t('websiteConnectionCheck.connectingToYourWebsite')}
          </>
        ) : status === 'connected' ? (
          <>
            <Check size={16} aria-hidden="true" />{' '}
            {t('websiteConnectionCheck.websiteConnectedSuccessfully')}
          </>
        ) : (
          <div className="dxp-website-connection-error">
            <h3>{t('websiteConnectionCheck.connectionNeedsAttention')}</h3>
            <span>{t('websiteConnectionCheck.couldnTConnectToYourWebsiteCompleteTheSetupBelow')}</span>
          </div>
        )}
      </div>
      {status === 'unavailable' && <WebsiteSetup />}
    </div>
  );
}
