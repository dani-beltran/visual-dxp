import type { StepConfig } from './types';

/**
 * Whether an HTML popover contains a <form>. Such popovers wait for the visitor to submit
 * the form and pass its fields downstream as data, like an HTTP request passes its response.
 * Comments and raw-text elements cannot create forms, so markup inside them is ignored.
 * Iframe popovers never qualify: their documents cannot be inspected.
 */
export function popoverHasForm(config: Pick<StepConfig, 'contentType' | 'content'>): boolean {
  if (config.contentType === 'iframe' || typeof config.content !== 'string') return false;
  const markup = config.content
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template|textarea|title)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, '');
  return /<form(?=[\s/>])/i.test(markup);
}
