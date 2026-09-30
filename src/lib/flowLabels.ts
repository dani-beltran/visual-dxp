import type { AriaLabelConfig } from '@xyflow/react';
import type { BuilderTranslator } from './i18n';
export function getFlowLabels(t: BuilderTranslator): AriaLabelConfig {
  return {
    'node.a11yDescription.default': t('flow.node.a11yDescription.default'),
    'node.a11yDescription.keyboardDisabled': t('flow.node.a11yDescription.keyboardDisabled'),
    'edge.a11yDescription.default': t('flow.edge.a11yDescription.default'),
    'controls.ariaLabel': t('flow.controls.ariaLabel'),
    'controls.zoomIn.ariaLabel': t('flow.controls.zoomIn.ariaLabel'),
    'controls.zoomOut.ariaLabel': t('flow.controls.zoomOut.ariaLabel'),
    'controls.fitView.ariaLabel': t('flow.controls.fitView.ariaLabel'),
    'controls.interactive.ariaLabel': t('flow.controls.interactive.ariaLabel'),
    'minimap.ariaLabel': t('flow.minimap.ariaLabel'),
    'handle.ariaLabel': t('flow.handle.ariaLabel'),
    'node.a11yDescription.ariaLiveMessage': (params) => t('flow.nodeMoved', params),
  };
}
