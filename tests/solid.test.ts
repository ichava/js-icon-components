import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import svgPolicy from '../vendor/svg-policy.json' with { type: 'json' };
import type * as SolidFlavour from '../src/solid/index.ts';
import type { IconData } from '../src/shared/index.ts';
import { bundleAndImport, iconsFrom, ROOT, sampleIcons } from './helpers.ts';

type Web = { renderToString: (fn: () => unknown) => string; render: (fn: () => unknown, el: Element) => () => void };
type Core = { createComponent: (c: unknown, p: object) => unknown; createSignal: <T>(v: T) => [() => T, (v: T) => void] };

/**
 * The Solid template has no JSX, so there is nothing for babel-preset-solid to compile: it is
 * type-checked by `npm run typecheck` and rendered twice, by Solid's server build
 * (`renderToString`) and by its client build in jsdom, which is where the SVG namespace matters.
 */
const server = () =>
  bundleAndImport<typeof SolidFlavour & Web & Core>('solid-server', {
    stdin: { contents: "export * from './src/solid/index.ts'; export { renderToString } from 'solid-js/web'; export { createComponent } from 'solid-js';", resolveDir: ROOT, loader: 'ts' },
    platform: 'node',
    conditions: ['node'],
    external: ['solid-js', 'solid-js/web'],
  });

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const client = async () => {
  Object.assign(globalThis, { document: dom.window.document, window: dom.window, Node: dom.window.Node, Element: dom.window.Element });
  return bundleAndImport<typeof SolidFlavour & Web & Core>('solid-client', {
    stdin: { contents: "export * from './src/solid/index.ts'; export { render } from 'solid-js/web'; export { createComponent, createSignal } from 'solid-js';", resolveDir: ROOT, loader: 'ts' },
    platform: 'browser',
    conditions: ['browser'],
  });
};

async function ssr(icon: IconData, props: Record<string, unknown> = {}): Promise<string> {
  const { renderToString, createComponent, createIcon } = await server();
  // Hydration keys and Solid's spacing before `>` are not the template's output, so they are not snapshotted.
  return renderToString(() => createComponent(createIcon(icon), props)).replace(/ data-hk="[^"]*"/g, '').replace(/ +>/g, '>');
}

describe('SolidJS flavour', () => {
  it('renders three icons on the server', async () => {
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      await ssr(mug!),
      await ssr(mugFilled!, { size: 32, color: '#7c3aed', title: 'Coffee' }),
      await ssr(github!, { strokeWidth: 1.5, class: 'brand' }),
    ];
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const [mug] = sampleIcons();
    expect(await ssr(mug!)).toContain('aria-hidden="true"');
    const titled = await ssr(mug!, { title: 'Coffee' });
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Coffee</title>');
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const [, mugFilled] = sampleIcons();
    expect(await ssr(mugFilled!, { strokeWidth: 3 })).not.toContain('stroke-width="3"');
  });

  it('creates every element in the SVG namespace on the client, the title included', async () => {
    const { render, createComponent, createIcon } = await client();
    const tags = svgPolicy.allowedTags.filter((t) => !['svg', 'title', 'desc', 'metadata'].includes(t));
    expect(tags.length).toBeGreaterThan(40);
    const icon: IconData = { ...sampleIcons()[0]!, nodes: [['g', {}, tags.map((t) => [t, {}] as const)]] };
    const host = dom.window.document.createElement('div');
    render(() => createComponent(createIcon(icon), { title: 'Every tag' }), host);
    const els = [...host.querySelectorAll('*')];
    expect(els.length).toBe(tags.length + 3);
    for (const el of els) expect(el.namespaceURI, el.localName).toBe('http://www.w3.org/2000/svg');
    expect(host.querySelector('svg > title')?.textContent).toBe('Every tag');
  });

  it('keeps a flag\'s xlink references and re-renders reactive props on the client', async () => {
    const { render, createComponent, createIcon, createSignal } = await client();
    const [ke] = iconsFrom('flag', ['IconKe']);
    const [size, setSize] = createSignal(20);
    const host = dom.window.document.createElement('div');
    render(() => createComponent(createIcon(ke!), { get size() { return size(); } }), host);
    expect(host.querySelector('use')?.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#flag_4x3_ke_ke-a');
    expect(host.querySelector('svg')?.getAttribute('width')).toBe('20');
    setSize(40);
    expect(host.querySelector('svg')?.getAttribute('width')).toBe('40');
  });
});
