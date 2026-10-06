'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

// The editor restores localStorage during initialization and measures browser DOM.
// Do not prerender it: its first render must use the saved browser workflow.
const Editor = dynamic(() => import('./EditorApp'), {
  ssr: false,
  loading: () => (
    <div className="editor-loading" role="status" aria-live="polite">
      <Image
        className="editor-loading-logo"
        src="/visual-dxp-logo.png"
        alt="Visual DXP"
        width={320}
        height={80}
        priority
      />
      <div className="editor-loading-caption">
        <span className="editor-loading-spinner" aria-hidden="true" />
        <p>Loading your editor…</p>
      </div>
    </div>
  ),
});

export default Editor;
