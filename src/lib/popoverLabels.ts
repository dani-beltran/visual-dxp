import type { BuilderTranslator } from './i18n';
import type { PopoverSettings } from './types';

const positionKeys = {
  center: 'nodeInspector.centerOfScreen',
  'top-left': 'nodeInspector.topLeft',
  'top-right': 'nodeInspector.topRight',
  'bottom-left': 'nodeInspector.bottomLeft',
  'bottom-right': 'nodeInspector.bottomRight',
  anchor: 'nodeInspector.nextToAnElement',
} as const;

const animationKeys = {
  none: 'nodeInspector.animationNone',
  fade: 'nodeInspector.animationFade',
  slide: 'nodeInspector.animationSlide',
  zoom: 'nodeInspector.animationZoom',
  bounce: 'nodeInspector.animationBounce',
} as const;

/** Imported workflows may hold unsupported values; those are shown as written. */
export function popoverPositionLabel(settings: PopoverSettings, t: BuilderTranslator): string {
  const position = settings.position ?? 'bottom-right';
  return Object.hasOwn(positionKeys, position) ? t(positionKeys[position]) : String(position);
}

/** One line describing a popover: content type, width, position and animation. */
export function popoverSettingsSummary(settings: PopoverSettings, t: BuilderTranslator): string {
  const animation = settings.popoverAnimation ?? 'none';
  return [
    t(
      settings.contentType === 'iframe'
        ? 'nodeInspector.embeddedWebsite'
        : 'nodeInspector.customHtml',
    ),
    `${settings.width ?? 360} ${t('nodeInspector.px')}`,
    popoverPositionLabel(settings, t),
    Object.hasOwn(animationKeys, animation) ? t(animationKeys[animation]) : String(animation),
  ].join(' · ');
}
