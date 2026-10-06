'use client';

import dynamic from 'next/dynamic';

// The editor restores localStorage during initialization and measures browser DOM.
// Do not prerender it: its first render must use the saved browser workflow.
const Editor = dynamic(() => import('./EditorApp'), {
  ssr: false,
  loading: () => <div role="status">Loading Visual DXP…</div>,
});

export default Editor;
