import { installBrandingBridge } from './lib/brandingBridge';
import { installPickerBridge } from './lib/pickerBridge';
import { installPreviewBridge } from './lib/previewBridge';

// Classic script entry point for sites that do not use the Visual DXP package.
const origin = document.currentScript?.getAttribute('data-parent-origin');
const targetUrl = document.currentScript?.getAttribute('data-target-url') || undefined;
const targetBaseUrl = document.currentScript?.getAttribute('data-target-base-url') || targetUrl;
try {
  if (!origin || new URL(origin).origin !== origin || !/^https?:/.test(origin)) {
    throw new Error('Invalid parent origin');
  }
  installPickerBridge(origin);
  installBrandingBridge(origin, targetUrl);
  installPreviewBridge(origin, undefined, targetBaseUrl);
} catch {
  console.warn(
    '[Visual DXP bridge]',
    'Inactive: set data-parent-origin to the exact HTTP(S) editor origin, without a trailing slash.',
  );
}
