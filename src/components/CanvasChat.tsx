import {
  ArrowUp,
  Check,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { AIChatMessage } from '../lib/ai';
import '../styles/chat.css';

export interface CanvasChatProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  configured: boolean;
  selectedLabel?: string;
  onSend: (
    messages: AIChatMessage[],
    signal: AbortSignal,
  ) => Promise<{
    message: string;
    changeCount: number;
  }>;
}

type Message = AIChatMessage & { id: number; changeCount?: number };
const suggestions = [
  'Add a welcome popover after a 2-second delay',
  'Explain the connections in this workflow',
  'Change the selected step',
];

export function CanvasChat({
  configured,
  selectedLabel,
  onSend,
  open: controlledOpen,
  onOpenChange,
}: CanvasChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [panelSize, setPanelSize] = useState({ width: 400, height: 520 });
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const history = useRef<AIChatMessage[]>([]);
  const sequence = useRef(0);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  useLayoutEffect(() => {
    if (!open || !root.current || !trigger.current) return;
    const canvas = root.current.closest('.dxp-canvas');
    const dock = root.current.closest('.dxp-canvas-dock');
    const anchor = root.current.parentElement;
    if (!canvas || !dock || !anchor) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const buttonBounds = anchor.getBoundingClientRect();
      setPanelSize({
        width: Math.min(400, Math.max(0, buttonBounds.right - bounds.left - 12)),
        height: Math.min(configured ? 520 : 360, Math.max(0, buttonBounds.top - bounds.top - 24)),
      });
    };
    resize();
    (configured ? input.current : closeButton.current)?.focus();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(dock);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [open, configured]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Opening the panel and toggling its busy indicator change the transcript's scroll height.
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = messages.length || error ? element.scrollHeight : 0;
  }, [messages, busy, error, open]);

  async function send() {
    const content = draft.trim();
    if (!content || !configured || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const conversation: AIChatMessage[] = [
      ...history.current.slice(-18),
      { role: 'user', content },
    ];
    setMessages((previous) => [...previous, { role: 'user', content, id: sequence.current++ }]);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const result = await onSend(conversation, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      history.current = [...conversation, { role: 'assistant', content: result.message }];
      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: result.message,
          changeCount: result.changeCount,
          id: sequence.current++,
        },
      ]);
    } catch (cause) {
      if (request.current !== controller) return;
      setError(
        controller.signal.aborted
          ? 'Stopped. No changes were made.'
          : `${cause instanceof Error ? cause.message : 'Unable to reach the AI assistant.'} No changes were made.`,
      );
      setDraft(content);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        input.current?.focus();
      }
    }
  }

  return (
    <div className="dxp-ai-chat" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`dxp-canvas-help-button dxp-ai-button ${open ? 'active' : ''}`}
        aria-label="AI chat"
        title="AI chat"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {busy ? (
          <LoaderCircle size={18} className="dxp-ai-spin" aria-hidden="true" />
        ) : (
          <Sparkles size={18} aria-hidden="true" />
        )}
      </button>
      {open && (
        <section
          id={id}
          className={`dxp-ai-panel ${panelSize.height < 400 ? 'dxp-ai-panel-compact' : ''} nodrag nopan nowheel`}
          style={panelSize}
          role="dialog"
          aria-labelledby={`${id}-title`}
          onKeyDown={(event) => {
            // Keep canvas deletion/undo shortcuts out of the conversation.
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
        >
          <header className="dxp-ai-header">
            <span className="dxp-ai-avatar">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id={`${id}-title`}>Your workflow assistant</h2>
              <p>From an idea to a connected experience</p>
            </div>
            <button
              type="button"
              className="dxp-icon-button"
              aria-label="Start a new conversation"
              title="New conversation"
              disabled={busy || !messages.length}
              onClick={() => {
                history.current = [];
                setMessages([]);
                setError('');
                setDraft('');
                input.current?.focus();
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            <button
              ref={closeButton}
              type="button"
              className="dxp-icon-button"
              aria-label="Close AI chat"
              onClick={close}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="dxp-ai-context">
            <span className={`dxp-ai-status ${configured ? 'ready' : ''}`} />
            {selectedLabel ? (
              <span>
                Selected: <strong>{selectedLabel}</strong>
              </span>
            ) : (
              <span>Working with your current canvas</span>
            )}
          </div>
          <div
            ref={transcript}
            className="dxp-ai-transcript"
            role="log"
            aria-label="AI conversation"
            aria-live="polite"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable transcript must be keyboard-focusable for scrolling.
            tabIndex={0}
          >
            {!messages.length && configured && (
              <div className="dxp-ai-welcome">
                <MessageCircle size={25} strokeWidth={1.5} aria-hidden="true" />
                <h3>What would you like to create?</h3>
                <p>Ask me to add steps, adjust their settings, or connect your journey.</p>
                {configured && (
                  <div className="dxp-ai-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        disabled={!configured}
                        onClick={() => {
                          setDraft(suggestion);
                          input.current?.focus();
                        }}
                      >
                        {suggestion}
                        <ArrowUp size={13} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!configured && (
              <div className="dxp-ai-setup" role="status">
                <strong>Connect your AI assistant</strong>
                <p>
                  AI chat is ready for setup. Ask your workspace administrator to connect the
                  assistant service to enable it.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <article key={message.id} className={`dxp-ai-message dxp-ai-message-${message.role}`}>
                <span className="dxp-ai-message-author">
                  {message.role === 'user' ? 'You' : 'Visual DXP AI'}
                </span>
                <p>{message.content}</p>
                {!!message.changeCount && (
                  <span className="dxp-ai-applied">
                    <Check size={12} aria-hidden="true" />
                    {message.changeCount} {message.changeCount === 1 ? 'edit' : 'edits'} applied ·
                    Undo on the canvas
                  </span>
                )}
              </article>
            ))}
            {busy && (
              <div className="dxp-ai-thinking" role="status">
                <LoaderCircle size={14} className="dxp-ai-spin" aria-hidden="true" />
                Working on your workflow…
              </div>
            )}
            {error && (
              <p className="dxp-ai-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <form
            className="dxp-ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <div className="dxp-ai-input-wrap">
              <textarea
                ref={input}
                aria-label="Message the workflow assistant"
                placeholder={
                  configured
                    ? 'Describe a change to your workflow…'
                    : 'Connect the assistant to start chatting'
                }
                value={draft}
                disabled={!configured || busy}
                maxLength={8000}
                rows={2}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              {busy ? (
                <button
                  type="button"
                  className="dxp-ai-send"
                  aria-label="Stop generating"
                  title="Stop generating"
                  onClick={() => request.current?.abort()}
                >
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="dxp-ai-send"
                  aria-label="Send message"
                  title="Send message"
                  disabled={!configured || !draft.trim()}
                >
                  <ArrowUp size={17} aria-hidden="true" />
                </button>
              )}
            </div>
            <p>Changes are undoable. Test your workflow before publishing.</p>
          </form>
        </section>
      )}
    </div>
  );
}
