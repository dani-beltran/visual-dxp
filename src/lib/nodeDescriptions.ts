import type { NodeKind } from './types';

/** Shared node help: what it does, when to use it, then essential setup and outputs. */
export const nodeDescriptions = {
  trigger:
    'Starts the workflow when a selected event occurs. Use it to respond to page activity or visitor actions.',
  transform:
    'Selects a field from incoming data and transforms its value. The result is passed to downstream steps.',
  http: 'Sends an HTTP request to an API. Use it to call an external service.',
  dom: 'Customizes multiple elements on the page. Edit text, images, links, appearance, and visibility together.',
  'track-event':
    'Sends a custom event through the workflow’s analytics integration. Use it to mark a milestone on a chosen path.',
  cookie: 'Saves a cookie on this website. Use it to remember a value for later steps or visits.',
  delay: 'Pauses the workflow before continuing. Use it to space out connected steps.',
  fork: 'Chooses a path based on a condition. Use it to tailor the workflow to the visitor or page.',
  experiment:
    'Splits visitors between variants A and B. Use it to test two experiences with a configurable traffic split and consistent browser assignments.',
  loop: 'Repeats connected steps. Use it to run the same sequence more than once.',
  popover: 'Displays a panel over the page. Use it to show a message or an embedded website.',
  note: 'Adds text to the canvas. Use it to document ideas, context, or reminders.',
  frame:
    'Groups nodes on the canvas so they move together. Use it to organize related parts of a workflow.',
} satisfies Record<NodeKind, string>;
