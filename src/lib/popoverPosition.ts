/** Position a fixed popover without owning its content, focus, or lifecycle. */
export function placePopover(
  panel: HTMLElement,
  arrow: SVGSVGElement | null,
  options: { anchor?: Element | null; position?: string; avoidAnchor?: boolean } = {},
) {
  const doc = panel.ownerDocument;
  const win = doc.defaultView!;
  const anchor = options.anchor;
  let directionX = 0;
  let directionY = 1;
  const viewportWidth = win.innerWidth || doc.documentElement.clientWidth;
  const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
  panel.style.transform = '';
  panel.style.inset = 'auto';
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    // Layout dimensions remain stable while entrance scale/translation is active.
    const bounds = panel.getBoundingClientRect();
    const panelRect = {
      width: panel.offsetWidth || bounds.width,
      height: panel.offsetHeight || bounds.height,
    };
    if (
      options.avoidAnchor &&
      rect.bottom + 12 + panelRect.height > viewportHeight - 16 &&
      rect.top - panelRect.height - 12 < 16
    ) {
      const right = viewportWidth - rect.right - 28;
      const leftSpace = rect.left - 28;
      if (Math.max(right, leftSpace) >= panelRect.width) {
        const onRight = right >= leftSpace;
        const top = Math.max(16, Math.min(rect.top, viewportHeight - panelRect.height - 16));
        panel.style.left = `${onRight ? rect.right + 12 : rect.left - panelRect.width - 12}px`;
        panel.style.top = `${top}px`;
        panel.style.transformOrigin = onRight ? 'left center' : 'right center';
        if (arrow) {
          const center = Math.max(
            26,
            Math.min(rect.top + rect.height / 2 - top, panelRect.height - 26),
          );
          arrow.style.left = onRight ? '-14px' : `${panelRect.width - 6}px`;
          arrow.style.top = `${center - 5}px`;
          arrow.style.bottom = 'auto';
          arrow.style.transform = onRight ? 'rotate(-90deg)' : 'rotate(90deg)';
        }
        return { directionX: onRight ? -1 : 1, directionY: 0 };
      }
    }
    const left = Math.max(16, Math.min(rect.left, viewportWidth - panelRect.width - 16));
    const above = rect.bottom + 12 + panelRect.height > viewportHeight - 16;
    directionX = 0;
    directionY = above ? 1 : -1;
    panel.style.transformOrigin = above ? 'center bottom' : 'center top';
    const top = above ? rect.top - panelRect.height - 12 : rect.bottom + 12;
    panel.style.left = `${left}px`;
    // Flipping above an offscreen anchor can still leave the panel below the viewport.
    panel.style.top = `${Math.max(16, Math.min(top, viewportHeight - panelRect.height - 16))}px`;
    if (arrow) {
      // Leave room for the rounded corners when the panel hits a viewport edge.
      const center = Math.max(
        26,
        Math.min(rect.left + rect.width / 2 - left, panelRect.width - 26),
      );
      arrow.style.left = `${center - 10}px`;
      arrow.style.top = above ? 'auto' : '-9px';
      arrow.style.bottom = above ? '-9px' : 'auto';
      arrow.style.transform = above ? 'rotate(180deg)' : '';
    }
  } else {
    const position = options.position ?? 'bottom-right';
    directionX = position === 'center' ? 0 : position.endsWith('left') ? -1 : 1;
    directionY = position.startsWith('top') ? -1 : 1;
    panel.style.transformOrigin =
      position === 'center'
        ? 'center'
        : `${directionX < 0 ? 'left' : 'right'} ${directionY < 0 ? 'top' : 'bottom'}`;
    if (position === 'center') {
      panel.style.left = '50%';
      panel.style.top = '50%';
      panel.style.transform = 'translate(-50%, -50%)';
    } else {
      panel.style[position.startsWith('top') ? 'top' : 'bottom'] = '24px';
      panel.style[position.endsWith('left') ? 'left' : 'right'] = '24px';
    }
  }
  return { directionX, directionY };
}
