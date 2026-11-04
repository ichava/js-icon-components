import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import type * as WcFlavour from '../src/wc/index.ts';
import { bundleAndImport, ROOT, sampleIcons } from './helpers.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
let wc: typeof WcFlavour;

beforeAll(async () => {
  // The element extends the HTMLElement it finds at import time, so the DOM goes first.
  Object.assign(globalThis, { HTMLElement: dom.window.HTMLElement, customElements: dom.window.customElements });
  wc = await bundleAndImport<typeof WcFlavour>('wc', { entryPoints: [join(ROOT, 'src/wc/index.ts')], platform: 'neutral' });
  wc.registerIcons(sampleIcons());
  wc.defineIchavaIcon('ichava-icon', dom.window.customElements);
});

function mount(attrs: Record<string, string>): Element {
  const el = dom.window.document.createElement('ichava-icon');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  dom.window.document.body.append(el);
  return el;
}

describe('Web Component flavour', () => {
  it('defines the custom element in jsdom', () => {
    expect(dom.window.customElements.get('ichava-icon')).toBeTypeOf('function');
    expect(wc.defineIchavaIcon('ichava-icon', dom.window.customElements)).toBe('ichava-icon');
  });

  it('renders three icons', () => {
    const html = [
      mount({ name: 'tabler:outline/mug' }).innerHTML,
      mount({ name: 'tabler:filled/mug', size: '32', color: '#7c3aed', label: 'Coffee' }).innerHTML,
      mount({ name: 'tabler:outline/brand-github', 'stroke-width': '1.5' }).innerHTML,
    ];
    expect(html).toMatchSnapshot();
  });

  it('takes data directly and re-renders on attribute change', () => {
    const [mug] = sampleIcons();
    const el = mount({}) as Element & { icon: unknown };
    expect(el.innerHTML).toBe('');
    el.icon = mug;
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    el.setAttribute('label', 'Coffee');
    expect(el.querySelector('svg')?.hasAttribute('aria-hidden')).toBe(false);
    expect(el.querySelector('svg > title')?.textContent).toBe('Coffee');
    expect(el.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('renders nothing for an unknown name', () => {
    expect(mount({ name: 'tabler:outline/no-such-icon' }).innerHTML).toBe('');
  });
});
