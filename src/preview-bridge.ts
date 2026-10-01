import { installPreviewBridge } from './lib/previewBridge';

// Classic script entry point for sites that do not use the Visual DXP package.
const origin = document.currentScript?.getAttribute('data-parent-origin');
try {
  if (!origin || new URL(origin).origin !== origin || !/^https?:/.test(origin)) {
    throw new Error('Invalid parent origin');
  }
  installPreviewBridge(origin);
} catch {
  console.warn(
    '[Visual DXP preview bridge]',
    'Inactive: set data-parent-origin to the exact HTTP(S) editor origin, without a trailing slash.',
  );
}
