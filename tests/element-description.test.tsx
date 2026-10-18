// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { spanishMessages } from '../src/app/locales/es';
import { PageChangesSummary } from '../src/components/ElementPicker/PageChangesSummary';
import {
  describeElement,
  formatElementDescription,
  isElementDescription,
} from '../src/lib/elementDescription';
import { createBuilderTranslator, translateEnglish } from '../src/lib/i18n';
import { isPageChange, pageChangeLabel } from '../src/lib/pageChanges';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
function element(markup: string, selector: string) {
  document.body.innerHTML = markup;
  const target = document.querySelector(selector);
  if (!target) throw new Error('Missing fixture element');
  return target;
}

it('describes original heading content without translating generated classes or including hidden text', () => {
  const heading = element(
    '<h1 class="css-19x9">Good <em>things.</em><br>Every day.<span hidden>Hidden</span><svg><title>Icon</title></svg></h1>',
    'h1',
  );
  expect(describeElement(heading)).toEqual({ kind: 'heading', name: 'Good things. Every day.' });
  expect(formatElementDescription(describeElement(heading), translateEnglish)).toBe(
    'Heading · “Good things. Every day.”',
  );
});

it('prefers explicit author labels and accessible names, including references, alt text and form labels', () => {
  const heading = element(
    '<h1 data-dxp-label="Hero headline" aria-label="Heading">Good things.</h1>',
    'h1',
  );
  expect(describeElement(heading).name).toBe('Hero headline');
  const link = element(
    '<span id="name">Shop all</span><a aria-labelledby="name" aria-label="Other">Browse</a>',
    'a',
  );
  expect(describeElement(link)).toEqual({ kind: 'link', name: 'Shop all' });
  expect(describeElement(element('<img alt="Ceramic vase" src="vase.jpg">', 'img'))).toEqual({
    kind: 'image',
    name: 'Ceramic vase',
  });
  expect(
    describeElement(
      element(
        '<label for="email">Email address</label><input id="email" value="private@example.com">',
        'input',
      ),
    ),
  ).toEqual({ kind: 'field', name: 'Email address' });
  expect(describeElement(element('<input type="submit" value="Subscribe">', 'input'))).toEqual({
    kind: 'button',
    name: 'Subscribe',
  });
});

it('distinguishes repeated links with page context and gives unlabeled elements sensible fallbacks', () => {
  document.body.innerHTML =
    '<header><nav><a>Contact</a></nav></header><footer><nav><a>Contact</a></nav><img></footer><div id="empty"></div>';
  const header = document.querySelector('header a')!,
    footer = document.querySelector('footer a')!;
  expect(formatElementDescription(describeElement(header), translateEnglish)).toBe(
    'Header · Link · “Contact”',
  );
  expect(formatElementDescription(describeElement(footer), translateEnglish)).toBe(
    'Footer · Link · “Contact”',
  );
  expect(
    formatElementDescription(describeElement(document.querySelector('img')!), translateEnglish),
  ).toBe('Footer · Image');
  expect(describeElement(document.querySelector('#empty')!)).toEqual({
    kind: 'element',
    name: '#empty',
  });
});

it('bounds saved metadata and rejects malformed descriptions', () => {
  const description = describeElement(element(`<p>${'Long content '.repeat(100)}</p>`, 'p'));
  expect(description.name?.endsWith('…')).toBe(true);
  expect(isElementDescription(description)).toBe(true);
  expect(isPageChange({ selector: 'p', value: 'Changed', element: description })).toBe(true);
  expect(
    isPageChange({ selector: 'p', element: { kind: 'heading', name: { html: 'unsafe' } } }),
  ).toBe(false);
  expect(isPageChange({ selector: 'p', element: { kind: 'unknown' } })).toBe(false);
});

it('renders the original element name and a readable change without Advanced or selector details', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <PageChangesSummary
        changes={[
          {
            selector: '.css-x93 > h1',
            action: 'text',
            value: 'Something wonderful.',
            element: { kind: 'heading', name: 'Good things.' },
          },
        ]}
      />,
    ),
  );
  expect(host.querySelector('.dxp-page-element-name')?.textContent).toBe(
    'Heading · “Good things.”',
  );
  expect(host.querySelector('.dxp-page-change-label')?.textContent).toBe(
    'Text changed to “Something wonderful.”',
  );
  expect(host.querySelector('details')).toBeNull();
  expect(host.textContent).not.toContain('.css-x93 > h1');
  await act(async () => root.unmount());
});

it('localizes element types and change descriptions and clearly describes alt text removal', () => {
  const spanish = createBuilderTranslator(spanishMessages);
  expect(formatElementDescription({ kind: 'heading', name: 'Good things.' }, spanish)).toBe(
    'Título · “Good things.”',
  );
  expect(pageChangeLabel({ selector: 'h1', value: 'Algo maravilloso.' }, spanish)).toBe(
    'Texto cambiado a «Algo maravilloso.»',
  );
  expect(
    pageChangeLabel(
      { selector: 'img', action: 'attribute', attribute: 'alt', value: '' },
      translateEnglish,
    ),
  ).toBe('Alt text cleared');
});
