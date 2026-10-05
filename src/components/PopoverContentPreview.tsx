import { useEffect, useState } from 'react';
import { createPopoverElements } from '../lib/runtime/popovers';
import type { WorkflowNode } from '../lib/types';

export function PopoverContentPreview({ node, title }: { node: WorkflowNode; title: string }) {
  const [srcDoc, setSrcDoc] = useState('');
  useEffect(() => {
    // Build in a detached document, then serialize into the script-disabled iframe.
    const doc = document.implementation.createHTMLDocument('');
    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    doc.head.appendChild(viewport);
    doc.body.style.cssText = 'margin:0;padding:16px 8px;';
    const { panel, surface, arrow } = createPopoverElements(
      node,
      doc,
      node.data.config.position === 'anchor',
    );
    // Only placement and viewport constraints differ from the website preview.
    Object.assign(panel.style, {
      position: 'relative',
      margin: '0 auto',
      maxWidth: '100%',
    });
    surface.style.maxHeight = 'none';
    if (arrow) {
      arrow.style.left = 'calc(50% - 10px)';
      arrow.style.top = '-9px';
    }
    doc.body.appendChild(panel);
    setSrcDoc(`<!doctype html>${doc.documentElement.outerHTML}`);
  }, [node]);

  // Mount with the finished document and replace the browsing context on edits.
  // Updating an initially empty srcdoc can leave the sandboxed frame blank in Chrome.
  return srcDoc ? <iframe key={srcDoc} title={title} sandbox="" srcDoc={srcDoc} /> : null;
}
