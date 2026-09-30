import { Check, Copy, Download } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import '../styles/website-setup.css';

export function WebsiteSetup() {
  const headingId = useId();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const editorOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-editor.example';
  const snippet = `<script src="/picker-bridge.js" data-parent-origin="${editorOrigin}"></script>`;

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
      <h3 id={headingId}>Connect your website</h3>
      <p>
        Download and host <code>picker-bridge.js</code> at your website’s root, then add this script
        to the pages you want to select elements on.
      </p>
      <code className="dxp-website-setup-snippet">{snippet}</code>
      <div className="dxp-website-setup-actions">
        <button
          type="button"
          className="dxp-website-setup-copy"
          onClick={copyScript}
          aria-label={copyStatus === 'copied' ? 'Copied' : 'Copy script'}
        >
          {copyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
          <span role="status">{copyStatus === 'copied' ? 'Copied' : 'Copy script'}</span>
        </button>
        <a href="/picker-bridge.js" download="picker-bridge.js">
          <Download size={14} /> Download bridge file
        </a>
      </div>
      {copyStatus === 'error' && (
        <p role="alert">
          Couldn’t copy automatically. Select the script above and copy it manually.
        </p>
      )}
      <p>
        The website must also allow embedding via its CSP <code>frame-ancestors</code> and{' '}
        <code>X-Frame-Options</code> settings.
      </p>
    </section>
  );
}
