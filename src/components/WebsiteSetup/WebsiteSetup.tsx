import '../../styles/base.css';
import '../../styles/shared.css';
import { Check, Copy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import './WebsiteSetup.css';

export function WebsiteSetup() {
  const { t } = useBuilderI18n();
  const headingId = useId();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const editorOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-editor.example';
  const snippet = `<script src="${editorOrigin}/bridge.js" data-parent-origin="${editorOrigin}"></script>`;

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <section className="dxp-website-setup" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('websiteSetup.connectYourWebsite')}</h3>
      <p>{t('websiteSetup.installInstructions', { filename: 'bridge.js' })}</p>
      <code className="dxp-website-setup-snippet">{snippet}</code>
      <div className="dxp-website-setup-actions">
        <button
          type="button"
          className="dxp-website-setup-copy"
          onClick={copyScript}
          aria-label={
            copyStatus === 'copied' ? t('websiteSetup.copied') : t('websiteSetup.copyScript')
          }
        >
          {copyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
          <span role="status">
            {copyStatus === 'copied' ? t('websiteSetup.copied') : t('websiteSetup.copyScript')}
          </span>
        </button>
      </div>
      {copyStatus === 'error' && (
        <p role="alert">
          {t('websiteSetup.couldnTCopyAutomaticallySelectTheScriptAboveAndCopyItManually')}
        </p>
      )}
      <p>{t('websiteSetup.embeddingInstructions')}</p>
    </section>
  );
}
