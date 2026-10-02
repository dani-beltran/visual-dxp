/** Incremental, bounded UTF-8 lines for SSE and newline-delimited JSON. */
export async function* responseLines(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty AI response.');
  const decoder = new TextDecoder();
  let pending = '';
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        pending += decoder.decode();
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > limit) throw new Error('AI response is too large.');
      pending += decoder.decode(value, { stream: true });
      let end = pending.indexOf('\n');
      while (end >= 0) {
        yield pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        end = pending.indexOf('\n');
      }
    }
    if (pending) yield pending.replace(/\r$/, '');
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function* serverEvents(response: Response, limit: number) {
  let event = '';
  let data: string[] = [];
  for await (const line of responseLines(response, limit)) {
    if (!line) {
      if (data.length) yield { event, data: data.join('\n') };
      event = '';
      data = [];
    } else if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (data.length) yield { event, data: data.join('\n') };
}

/** Hold only a suffix that could become a secret across subsequent text deltas. */
export function safeTextEmitter(secret: string, emit: (text: string) => void) {
  let pending = '';
  return (delta: string, flush = false) => {
    pending += delta;
    if (secret && pending.includes(secret)) throw new Error('Unsafe AI response.');
    let hold = 0;
    if (secret && !flush) {
      for (let length = 1; length < secret.length && length <= pending.length; length++) {
        if (pending.endsWith(secret.slice(0, length))) hold = length;
      }
    }
    const text = pending.slice(0, pending.length - hold);
    pending = pending.slice(pending.length - hold);
    if (text) emit(text);
  };
}
