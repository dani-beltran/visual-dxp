import type { NodeKind } from './types';

/** Shared node help: what it does, when to use it, then essential setup and outputs. */
export const nodeDescriptions = {
  trigger:
    'Starts the workflow when a selected event occurs. Use it to respond to page activity or visitor actions. Choose an event and any required target element or thresholds, then connect the first step.',
  http: 'Sends an HTTP request to an API. Use it to call an external service. Set the URL and method, with headers or a body as needed; the next step receives response data on success or an error object with message and code on failure.',
  dom: 'Updates matching elements on the page. Use it to change content, appearance, or visibility. Choose a target element and an action, then use a manual value or incoming data from a connected step. Set an attribute name when needed.',
  cookie:
    'Saves a cookie on this website. Use it to remember a value for later steps or visits. Set a name, value, and expiration; a Condition step can check the saved value.',
  delay:
    'Pauses the workflow before continuing. Use it to space out connected steps. Set a duration in milliseconds; the next step runs after the pause.',
  fork: 'Chooses a path based on a condition. Use it to tailor the workflow to the visitor or page. Choose a condition type and its values, then connect the True output for a match and the False output otherwise.',
  loop: 'Repeats connected steps. Use it to run the same sequence more than once. Set a repetition count, connect the steps to Body, and connect the following step to Done.',
  popover:
    'Displays a panel over the page. Use it to show a message or an embedded website. Provide HTML or a website URL, choose a position and width, and select an anchor element when positioning it next to an element.',
  note: 'Adds text to the canvas. Use it to document ideas, context, or reminders. Enter the note text and choose its formatting; notes are skipped when the workflow runs.',
  frame:
    'Groups nodes on the canvas so they move together. Use it to organize related parts of a workflow. Name the frame and place nodes fully inside it; frames are skipped when the workflow runs.',
} satisfies Record<NodeKind, string>;
