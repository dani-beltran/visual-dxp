/** Local servers can leak chat-template tool syntax into assistant text. Hold
 * split opening tags so protocol text never flashes in the user-facing stream. */
export function toolTextEmitter(emit: (text: string) => void) {
  const markers = ['<tool_call>', '<function='];
  let pending = '';
  let suppressed = false;
  return (text: string, flush = false) => {
    if (suppressed) return;
    pending += text;
    const positions = markers
      .map((marker) => pending.indexOf(marker))
      .filter((index) => index >= 0);
    if (positions.length) {
      const prefix = pending.slice(0, Math.min(...positions));
      if (prefix) emit(prefix);
      pending = '';
      suppressed = true;
      return;
    }
    let hold = 0;
    if (!flush) {
      for (const marker of markers) {
        for (let length = 1; length < marker.length && length <= pending.length; length++) {
          if (pending.endsWith(marker.slice(0, length))) hold = Math.max(hold, length);
        }
      }
    }
    const visible = pending.slice(0, pending.length - hold);
    pending = pending.slice(pending.length - hold);
    if (visible) emit(visible);
  };
}

// This recognizes only the empty completion marker, never arbitrary mutation
// tools or their arguments. Edits still come exclusively from validated calls.
export const isTextualWorkflowFinish = (text: string) =>
  /^\s*<tool_call>\s*<function=finish_workflow>\s*<\/function>\s*<\/tool_call>\s*$/.test(text);
export const hasToolText = (text: string) => /<tool_call>|<function=/.test(text);
