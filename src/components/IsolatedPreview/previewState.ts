export type PreviewErrorKey =
  | 'isolatedPreview.proxyUnavailable'
  | 'isolatedPreview.bridgeUnavailable'
  | 'isolatedPreview.reloadLoop'
  | 'isolatedPreview.theDemoCouldNotLoadReloadToTryAgain'
  | 'isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow'
  | 'isolatedPreview.theWebsiteCouldNotLoad';

type PreviewError = { key: PreviewErrorKey } | { message: string };

export interface PreviewState {
  target: string;
  status: 'connecting' | 'ready' | 'unavailable' | 'blocked';
  channel: string;
  elementPicking: boolean;
  error?: PreviewError;
}

export type PreviewAction =
  | { type: 'reset'; target: string; error?: string; errorKey?: PreviewErrorKey }
  | { type: 'connect'; channel: string }
  | { type: 'ready'; channel: string; elementPicking: boolean }
  | { type: 'unavailable'; channel: string }
  | { type: 'timeout'; channel: string; proxied: boolean }
  | { type: 'blocked' }
  | { type: 'error'; key: PreviewErrorKey };

export const initialPreviewState: PreviewState = {
  target: '',
  status: 'connecting',
  channel: '',
  elementPicking: false,
};

/** Pure state transitions; channels reject responses from a previous document. */
export function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === 'reset')
    return {
      ...initialPreviewState,
      target: action.target,
      ...(action.errorKey
        ? { status: 'unavailable', error: { key: action.errorKey } }
        : action.error
          ? { status: 'unavailable', error: { message: action.error } }
          : {}),
    };
  // A blocked document stays stopped until its target changes or the user retries.
  if (state.status === 'blocked') return state;
  if ('channel' in action && action.type !== 'connect' && action.channel !== state.channel)
    return state;
  switch (action.type) {
    case 'connect':
      return {
        target: state.target,
        status: 'connecting',
        channel: action.channel,
        elementPicking: false,
      };
    case 'ready':
      return {
        target: state.target,
        status: 'ready',
        channel: action.channel,
        elementPicking: action.elementPicking,
      };
    case 'unavailable':
      return { ...state, status: 'unavailable', elementPicking: false };
    case 'timeout':
      return {
        ...state,
        status: 'unavailable',
        elementPicking: false,
        error: {
          key: action.proxied
            ? 'isolatedPreview.proxyUnavailable'
            : 'isolatedPreview.bridgeUnavailable',
        },
      };
    case 'blocked':
      return {
        ...state,
        status: 'blocked',
        elementPicking: false,
        error: { key: 'isolatedPreview.reloadLoop' },
      };
    case 'error':
      return { ...state, error: { key: action.key } };
  }
}
