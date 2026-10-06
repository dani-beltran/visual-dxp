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
import { formatBuilderError } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';
import { ChatMarkdown } from './ChatMarkdown';
import '../styles/chat.css';

export interface CanvasChatProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  configured: boolean;
  activeProvider?: string;
  locked?: boolean;
  configurationError?: boolean;
  selectedLabel?: string;
  onSend: (
    messages: AIChatMessage[],
    signal: AbortSignal,
    onText?: (text: string) => void,
    onReasoning?: (text: string) => void,
  ) => Promise<{
    message: string;
    changeCount: number;
  }>;
}

type Message = AIChatMessage & { id: number; changeCount?: number; reasoning?: string };

export function CanvasChat({
  configured,
  activeProvider = 'OpenAI',
  locked = false,
  configurationError = false,
  selectedLabel,
  onSend,
  open: controlledOpen,
  onOpenChange,
}: CanvasChatProps) {
  const { t } = useBuilderI18n();
  const suggestions = [
    t('canvasChat.addAWelcomePopoverAfterA2SecondDelay'),
    t('canvasChat.explainThisWorkflow'),
    t('canvasChat.changeTheSelectedStep'),
  ];
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [panelSize, setPanelSize] = useState({ width: 400, height: 520 });
  const invalidConfiguration = !configured || configurationError;
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
    const assistantId = sequence.current++;
    let partial = '';
    let reasoning = '';
    const updatePartial = () => {
      const message: Message = { role: 'assistant', content: partial, reasoning, id: assistantId };
      setMessages((previous) => [...previous.filter((entry) => entry.id !== assistantId), message]);
    };
    try {
      const result = await onSend(
        conversation,
        controller.signal,
        (text) => {
          if (controller.signal.aborted || request.current !== controller) return;
          partial += text;
          updatePartial();
        },
        (text) => {
          if (controller.signal.aborted || request.current !== controller) return;
          reasoning += text;
          updatePartial();
        },
      );
      if (controller.signal.aborted || request.current !== controller) return;
      history.current = [...conversation, { role: 'assistant', content: result.message }];
      setMessages((previous) => [
        ...previous.filter((message) => message.id !== assistantId),
        {
          role: 'assistant',
          content: result.message,
          reasoning,
          changeCount: result.changeCount,
          id: assistantId,
        },
      ]);
    } catch (cause) {
      if (request.current !== controller) return;
      setMessages((previous) => previous.filter((message) => message.id !== assistantId));
      setError(
        controller.signal.aborted
          ? t('canvasChat.stoppedNoChangesWereMade')
          : t('canvasChat.valueNoChangesWereMade', {
              value: String(
                cause instanceof Error ? formatBuilderError(cause, t) : t('canvasChat.unavailable'),
              ),
            }),
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
        data-tutorial="chat"
        className={`dxp-canvas-help-button dxp-ai-button ${open ? 'active' : ''}`}
        aria-label={t('canvasChat.aiChat')}
        title={t('canvasChat.aiChat')}
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
              <h2 id={`${id}-title`}>{t('canvasChat.yourWorkflowAssistant')}</h2>
              <p>{t('aiSettings.activeProvider', { label: activeProvider })}</p>
            </div>
            <button
              type="button"
              className="dxp-icon-button"
              aria-label={t('canvasChat.startANewConversation')}
              title={t('canvasChat.newConversation')}
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
              aria-label={t('canvasChat.closeAiChat')}
              onClick={close}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="dxp-ai-context" role="status">
            <span
              className={`dxp-ai-status ${invalidConfiguration ? 'error' : 'ready'}`}
              aria-hidden="true"
            />
            {invalidConfiguration ? (
              <span>
                {locked
                  ? t('canvasChat.unlockActiveproviderInSettingsBelowToUseAi', {
                      activeProvider: String(activeProvider),
                    })
                  : t('canvasChat.aiConfigurationIsIncorrectForActiveproviderCheckSettingsBelow', {
                      activeProvider: String(activeProvider),
                    })}
              </span>
            ) : selectedLabel ? (
              <span>{t('canvasChat.selectedStep', { label: selectedLabel })}</span>
            ) : (
              <span>{t('canvasChat.workingWithYourCurrentCanvas')}</span>
            )}
          </div>
          <div
            ref={transcript}
            className="dxp-ai-transcript"
            role="log"
            aria-label={t('canvasChat.aiConversation')}
            aria-live="polite"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable transcript must be keyboard-focusable for scrolling.
            tabIndex={0}
          >
            {!messages.length && configured && !locked && (
              <div className="dxp-ai-welcome">
                <MessageCircle size={25} strokeWidth={1.5} aria-hidden="true" />
                <h3>{t('canvasChat.whatWouldYouLikeToCreate')}</h3>
                <p>{t('canvasChat.askMeToAddStepsAdjustTheirSettingsOrConnectYourJourney')}</p>
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
                <strong>{t('canvasChat.connectYourAiAssistant')}</strong>
                <p>{t('canvasChat.aiChatIsReadyForSetupAskYourWorkspaceAdministratorToConnect')}</p>
              </div>
            )}
            {messages.map((message) => (
              <article key={message.id} className={`dxp-ai-message dxp-ai-message-${message.role}`}>
                <span className="dxp-ai-message-author">
                  {message.role === 'user' ? t('canvasChat.you') : t('canvasChat.visualDxpAi')}
                </span>
                {message.reasoning && (
                  <details className="dxp-ai-reasoning">
                    <summary>{t('canvasChat.reasoningSummary')}</summary>
                    <ChatMarkdown content={message.reasoning} />
                  </details>
                )}
                {message.content && <ChatMarkdown content={message.content} />}
                {!!message.changeCount && (
                  <span className="dxp-ai-applied">
                    <Check size={12} aria-hidden="true" />
                    {t('canvasChat.editsApplied', { count: message.changeCount })}
                  </span>
                )}
              </article>
            ))}
            {busy && (
              <div className="dxp-ai-thinking" role="status">
                <LoaderCircle size={14} className="dxp-ai-spin" aria-hidden="true" />
                {t('canvasChat.workingOnYourWorkflow')}
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
                aria-label={t('canvasChat.messageTheWorkflowAssistant')}
                placeholder={
                  configured
                    ? t('canvasChat.describeAChangeToYourWorkflow')
                    : t('canvasChat.connectTheAssistantToStartChatting')
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
                  aria-label={t('canvasChat.stopGenerating')}
                  title={t('canvasChat.stopGenerating')}
                  onClick={() => request.current?.abort()}
                >
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="dxp-ai-send"
                  aria-label={t('canvasChat.sendMessage')}
                  title={t('canvasChat.sendMessage')}
                  disabled={!configured || !draft.trim()}
                >
                  <ArrowUp size={17} aria-hidden="true" />
                </button>
              )}
            </div>
            <p>{t('canvasChat.changesAreUndoableTestYourWorkflowBeforePublishing')}</p>
          </form>
        </section>
      )}
    </div>
  );
}
