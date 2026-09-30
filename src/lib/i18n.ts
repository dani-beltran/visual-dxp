import { englishMessages } from './messages';

/** Plain messages are strings; messages with values are typed formatter functions. */
export type BuilderMessages = {
  [K in keyof typeof englishMessages]: (typeof englishMessages)[K] extends (
    ...args: infer A
  ) => string
    ? (...args: A) => string
    : string;
};
export type BuilderMessageKey = keyof BuilderMessages;
export type BuilderMessageArgs<K extends BuilderMessageKey> = BuilderMessages[K] extends (
  params: infer P,
) => string
  ? [params: P]
  : [];
export type BuilderTranslator = <K extends BuilderMessageKey>(
  key: K,
  ...args: BuilderMessageArgs<K>
) => string;
export interface BuilderI18n {
  /** BCP 47 language tag used for dates, numbers and the root lang attribute. */
  locale?: string;
  /** Text direction. Defaults to ltr; the graph keeps its left-to-right coordinates. */
  direction?: 'ltr' | 'rtl';
  /** The host owns loading, selecting and supplying translations. Missing keys use English. */
  messages?: Partial<BuilderMessages>;
}

/** Pure and instance scoped. Also useful for formatting messages outside React. */
export function createBuilderTranslator(
  messages: Partial<BuilderMessages> = {},
): BuilderTranslator {
  return ((key: BuilderMessageKey, params?: unknown) => {
    const message = messages[key] ?? englishMessages[key];
    return typeof message === 'function'
      ? (message as (params: unknown) => string)(params)
      : message;
  }) as BuilderTranslator;
}
export const translateEnglish = createBuilderTranslator();

/** Errors produced by bundled helpers carry keys; server/third-party text is preserved. */
export function formatBuilderError(
  error: unknown,
  t: BuilderTranslator = translateEnglish,
): string {
  if (
    error &&
    typeof error === 'object' &&
    'messageKey' in error &&
    typeof error.messageKey === 'string' &&
    Object.hasOwn(englishMessages, error.messageKey)
  ) {
    return (t as (key: BuilderMessageKey, params: unknown) => string)(
      error.messageKey as BuilderMessageKey,
      'cause' in error
        ? { reason: formatBuilderError(error.cause, t) }
        : 'messageParams' in error
          ? error.messageParams
          : undefined,
    );
  }
  return error instanceof Error ? error.message : String(error);
}
