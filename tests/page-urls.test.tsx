// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PageEditorPanel } from '../src/components/ElementPicker/PageEditorPanel';
import { attachPageEditing } from '../src/lib/pageEditing';
import { normalizePageChangeUrls, previewPageUrl, websiteUrl } from '../src/lib/pageUrls';

const proxyOrigin = 'http://127.0.0.1:3000';
const context = { proxyOrigin, baseUrl: 'https://shop.example/catalog/' };
function proxy(origin: string, path: string) {
  const payload = Buffer.from(JSON.stringify({ origin })).toString('base64url');
  return `${proxyOrigin}/api/preview/content/${payload}.signature${path}`;
}
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('unwraps document and CDN URLs, preserving encoded paths, query strings and fragments', () => {
  expect(
    websiteUrl(proxy('https://shop.example', '/products/a%20b?color=sage&size=m#details'), context),
  ).toBe('https://shop.example/products/a%20b?color=sage&size=m#details');
  expect(websiteUrl(proxy('https://cdn.example', '/images/vase.jpg?w=1200'), context)).toBe(
    'https://cdn.example/images/vase.jpg?w=1200',
  );
  expect(websiteUrl(new URL(proxy('https://shop.example', '/products')).pathname, context)).toBe(
    'https://shop.example/products',
  );
});

it('leaves ordinary URLs and malformed or unrelated proxy-like URLs unchanged', () => {
  for (const value of [
    '#collection',
    '../products',
    '/images/vase.jpg',
    'mailto:hello@example.com',
    'https://shop.example/real.jpg',
    `${proxyOrigin}/api/preview/content/invalid/path`,
    proxy('javascript:alert(1)', '/image'),
    proxy('https://shop.example/path', '/image'),
  ]) {
    expect(websiteUrl(value, context)).toBe(value);
  }
  const unrelated = proxy('https://shop.example', '/products').replace(
    proxyOrigin,
    'https://unrelated.example',
  );
  expect(websiteUrl(unrelated, context)).toBe(unrelated);
  expect(websiteUrl(proxy('https://shop.example', '/products'), {})).toContain(
    '/api/preview/content/',
  );
});

it('reuses existing routes to load canonical edits in the preview', () => {
  const document = proxy('https://shop.example', '/catalog/');
  const image = proxy('https://cdn.example', '/old.jpg');
  expect(previewPageUrl('https://cdn.example/new.jpg?width=800', [image, document], context)).toBe(
    proxy('https://cdn.example', '/new.jpg?width=800'),
  );
  expect(previewPageUrl('../sale#featured', [image, document], context)).toBe(
    proxy('https://shop.example', '/sale#featured'),
  );
  expect(previewPageUrl('#details', [document], context)).toBe('#details');
  expect(previewPageUrl('https://new-cdn.example/image.jpg', [image, document], context)).toBe(
    'https://new-cdn.example/image.jpg',
  );
});

it('normalizes saved URL operations without changing text or alt text', () => {
  const value = proxy('https://cdn.example', '/photo.jpg');
  expect(
    normalizePageChangeUrls({ selector: 'img', action: 'replace-image', value }, context).value,
  ).toBe('https://cdn.example/photo.jpg');
  expect(
    normalizePageChangeUrls(
      { selector: 'a', action: 'attribute', attribute: 'href', value },
      context,
    ).value,
  ).toBe('https://cdn.example/photo.jpg');
  const text = { selector: 'p', action: 'text' as const, value };
  expect(normalizePageChangeUrls(text, context)).toBe(text);
  const alt = { selector: 'img', action: 'attribute' as const, attribute: 'alt', value };
  expect(normalizePageChangeUrls(alt, context)).toBe(alt);
});

it('reads canonical link and responsive image URLs while retaining proxy delivery inside the frame', () => {
  const doc = document.implementation.createHTMLDocument();
  doc.head.innerHTML = `<base href="${proxy('https://shop.example', '/catalog/')}">`;
  doc.body.innerHTML = `<a href="${proxy('https://shop.example', '/old')}">Shop</a><img src="${proxy('https://cdn.example', '/small.jpg')}" alt="Vase">`;
  const link = doc.querySelector('a')!,
    image = doc.querySelector('img')!;
  Object.defineProperty(image, 'currentSrc', {
    value: proxy('https://cdn.example', '/large.jpg?width=1200'),
  });
  const editing = attachPageEditing(doc, vi.fn(), context);
  expect(editing.detail(link).href).toBe('https://shop.example/old');
  expect(editing.detail(image).src).toBe('https://cdn.example/large.jpg?width=1200');
  expect(image.getAttribute('src')).toBe(proxy('https://cdn.example', '/small.jpg'));
  expect(
    editing.update([
      {
        selector: 'a',
        action: 'attribute',
        attribute: 'href',
        value: 'https://shop.example/new#items',
      },
      { selector: 'img', action: 'replace-image', value: 'https://cdn.example/new.jpg' },
    ]),
  ).toBe(true);
  expect(link.getAttribute('href')).toBe(proxy('https://shop.example', '/new#items'));
  expect(image.getAttribute('src')).toBe(proxy('https://cdn.example', '/new.jpg'));
  editing.destroy();
});

it('shows actual website URLs even when older saved edits contain proxy URLs', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const props = {
    urlContext: context,
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    focusedChange: null,
  };
  await act(async () =>
    root.render(
      <PageEditorPanel
        {...props}
        selected={{
          selector: 'a',
          tagName: 'a',
          text: 'Shop',
          href: proxy('https://shop.example', '/original'),
        }}
        changes={[
          {
            selector: 'a',
            action: 'attribute',
            attribute: 'href',
            value: proxy('https://shop.example', '/saved'),
          },
        ]}
      />,
    ),
  );
  expect(host.querySelector<HTMLInputElement>('input[id$="-href"]')?.value).toBe(
    'https://shop.example/saved',
  );
  await act(async () =>
    root.render(
      <PageEditorPanel
        {...props}
        selected={{
          selector: 'img',
          tagName: 'img',
          text: '',
          src: proxy('https://cdn.example', '/original.jpg'),
        }}
        changes={[
          {
            selector: 'img',
            action: 'replace-image',
            value: proxy('https://cdn.example', '/saved.jpg'),
          },
        ]}
      />,
    ),
  );
  expect(host.querySelector<HTMLInputElement>('input[id$="-image"]')?.value).toBe(
    'https://cdn.example/saved.jpg',
  );
  await act(async () => root.unmount());
});
