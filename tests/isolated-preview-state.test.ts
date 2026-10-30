import { expect, it } from 'vitest';
import {
  initialPreviewState,
  previewReducer,
} from '../src/components/IsolatedPreview/previewState';

const target = 'https://site.example/';
const connecting = previewReducer(previewReducer(initialPreviewState, { type: 'reset', target }), {
  type: 'connect',
  channel: 'current',
});

it('does not let stale readiness or timeouts change the current connection', () => {
  for (const action of [
    { type: 'ready', channel: 'previous', elementPicking: true },
    { type: 'timeout', channel: 'previous', proxied: true },
    { type: 'unavailable', channel: 'previous' },
  ] as const)
    expect(previewReducer(connecting, action)).toBe(connecting);
});

it('keeps a reload-loop block terminal until the preview is reset', () => {
  const blocked = previewReducer(connecting, { type: 'blocked' });
  expect(blocked.status).toBe('blocked');
  for (const action of [
    { type: 'ready', channel: 'current', elementPicking: true },
    { type: 'connect', channel: 'new' },
    { type: 'error', key: 'isolatedPreview.theWebsiteCouldNotLoad' },
  ] as const)
    expect(previewReducer(blocked, action)).toBe(blocked);
  const reset = previewReducer(blocked, { type: 'reset', target: 'https://next.example/' });
  expect(reset).toMatchObject({
    target: 'https://next.example/',
    status: 'connecting',
    elementPicking: false,
  });
  expect(reset.error).toBeUndefined();
});

it('clears readiness and picking on reconnect while retaining readiness for a workflow error', () => {
  const ready = previewReducer(connecting, {
    type: 'ready',
    channel: 'current',
    elementPicking: true,
  });
  const error = previewReducer(ready, {
    type: 'error',
    key: 'isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow',
  });
  expect(error).toMatchObject({ status: 'ready', elementPicking: true, channel: 'current' });
  const reconnecting = previewReducer(error, { type: 'connect', channel: 'next' });
  expect(reconnecting).toMatchObject({
    status: 'connecting',
    elementPicking: false,
    channel: 'next',
    target,
  });
  expect(reconnecting.error).toBeUndefined();
});
