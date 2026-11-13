import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from 'svelte/compiler';
import { render as renderSvelte } from 'svelte/server';
import type { Component } from 'svelte';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { compileVue } from '../src/generator/generate.ts';
import type * as ReactFlavour from '../src/react/index.tsx';
import type * as WcFlavour from '../src/wc/index.ts';
import { themed, type IconData, type IconProps } from '../src/shared/index.ts';
import { bundleAndImport, illustrations, ROOT } from './helpers.ts';

/**
 * Illustration props, exercised with the test-only fixture pack (tests/fixtures/packs/
 * illustration-demo, three CC0 shapes drawn for these tests): `primaryColor` sets
 * `--ichava-primary` and `color`, and `variant="dark"` draws the dark twin the pack carries.
 * No public illustration set exists, so this pack is the only place the props are exercised.
 */

const all = illustrations();
const byName = (n: string): IconData => {
  const found = all.find((i) => i.exportName === n);
  if (!found) throw new Error(`${n} is not in the fixture pack`);
  return found.data;
};
const hills = byName('IconHills');
const frame = byName('IconFrame');
const LIGHT_SKY = '#f4f1ea';
const DARK_SKY = '#1e2230';

describe('the fixture illustration pack', () => {
  it('folds each -dark file into its light twin and keeps a file with no twin', () => {
    expect(all.map((i) => i.exportName)).toEqual(['IconBlob', 'IconFrame', 'IconHills']);
    expect(all.every((i) => i.data.kind === 'illustration')).toBe(true);
    expect(Object.keys(hills.variants ?? {})).toEqual(['dark']);
    expect(frame.variants).toBeUndefined();
    expect(JSON.stringify(themed(hills, 'dark').nodes)).toContain(DARK_SKY);
    // No twin: the dark variant is the item itself, never an empty drawing.
    expect(themed(frame, 'dark')).toBe(frame);
  });
});

/** What every flavour must show: the primary colour on the root, and the right twin drawn. */
function expectRecoloured(markup: string, sky: string): void {
  expect(markup).toMatch(/--ichava-primary: ?#ff0000/);
  expect(markup).toMatch(/color="#ff0000"/);
  expect(markup).toContain(sky);
  expect(markup).not.toContain(sky === DARK_SKY ? LIGHT_SKY : DARK_SKY);
}

describe('React', () => {
  let React: typeof ReactFlavour;
  beforeAll(async () => {
    React = await bundleAndImport<typeof ReactFlavour>('react-illustration', { entryPoints: [join(ROOT, 'src/react/index.tsx')], jsx: 'automatic', external: ['react', 'react-dom'] });
  });

  it('recolours and switches variant', () => {
    const Hills = React.createIcon(hills);
    const light = renderToStaticMarkup(createElement(Hills, { primaryColor: '#ff0000' }));
    const dark = renderToStaticMarkup(createElement(Hills, { primaryColor: '#ff0000', variant: 'dark' }));
    expectRecoloured(light, LIGHT_SKY);
    expectRecoloured(dark, DARK_SKY);
    expect([light, dark]).toMatchSnapshot();
    // The props never reach the DOM as attributes of their own.
    expect(light).not.toMatch(/primaryColor|variant=/i);
  });
});

describe('Vue', () => {
  let defineIcon: (icon: IconData) => (props: IconProps) => unknown;
  beforeAll(async () => {
    ({ defineIcon } = await bundleAndImport<{ defineIcon: typeof defineIcon }>('vue-illustration', {
      stdin: { contents: compileVue(readFileSync(join(ROOT, 'src/vue/Icon.vue'), 'utf8'), 'Icon.vue'), resolveDir: join(ROOT, 'src/vue'), loader: 'js' },
      external: ['vue'],
    }));
  });

  it('recolours and switches variant', async () => {
    const Hills = defineIcon(hills);
    const render = (props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(Hills as never, props) }));
    const light = await render({ primaryColor: '#ff0000' });
    const dark = await render({ primaryColor: '#ff0000', variant: 'dark' });
    expectRecoloured(light, LIGHT_SKY);
    expectRecoloured(dark, DARK_SKY);
    expect([light, dark]).toMatchSnapshot();
    expect(light).not.toMatch(/primary-?color=|variant=/i);
  });
});

describe('Svelte', () => {
  let Icon: Component<Record<string, unknown>>;
  beforeAll(async () => {
    const source = readFileSync(join(ROOT, 'src/svelte/Icon.svelte'), 'utf8');
    ({ default: Icon } = await bundleAndImport<{ default: typeof Icon }>('svelte-illustration', {
      stdin: { contents: compile(source, { filename: 'Icon.svelte', generate: 'server' }).js.code, resolveDir: join(ROOT, 'src/svelte'), loader: 'js' },
      external: ['svelte', 'svelte/*'],
    }));
  });

  it('recolours and switches variant', () => {
    const render = (props: Record<string, unknown>) => renderSvelte(Icon, { props: { icon: hills, ...props } }).body.replace(/<!--[^>]*-->/g, '');
    const light = render({ primaryColor: '#ff0000' });
    const dark = render({ primaryColor: '#ff0000', variant: 'dark' });
    expectRecoloured(light, LIGHT_SKY);
    expectRecoloured(dark, DARK_SKY);
    expect([light, dark]).toMatchSnapshot();
    expect(light).not.toMatch(/primarycolor=|variant=/i);
  });
});

describe('Web Component', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  let wc: typeof WcFlavour;
  beforeAll(async () => {
    Object.assign(globalThis, { HTMLElement: dom.window.HTMLElement, customElements: dom.window.customElements });
    wc = await bundleAndImport<typeof WcFlavour>('wc-illustration', { entryPoints: [join(ROOT, 'src/wc/index.ts')], platform: 'neutral' });
    wc.registerIcons(all.map((i) => i.data));
    wc.defineIchavaIcon('ichava-icon', dom.window.customElements);
  });

  it('recolours and switches variant, live on attribute change', () => {
    const el = dom.window.document.createElement('ichava-icon');
    el.setAttribute('name', hills.id);
    el.setAttribute('primary-color', '#ff0000');
    dom.window.document.body.append(el);
    const light = el.innerHTML;
    el.setAttribute('variant', 'dark');
    const dark = el.innerHTML;
    expectRecoloured(light, LIGHT_SKY);
    expectRecoloured(dark, DARK_SKY);
    expect(el.querySelector('svg')?.style.getPropertyValue('--ichava-primary')).toBe('#ff0000');
    expect([light, dark]).toMatchSnapshot();
  });
});

describe('the props on an icon without twins', () => {
  it('an explicit color still wins over primaryColor for color, and the custom property stays', async () => {
    const React = await bundleAndImport<typeof ReactFlavour>('react-illustration-2', { entryPoints: [join(ROOT, 'src/react/index.tsx')], jsx: 'automatic', external: ['react', 'react-dom'] });
    const markup = renderToStaticMarkup(createElement(React.createIcon(frame), { primaryColor: '#ff0000', color: '#00ff00', variant: 'dark' }));
    expect(markup).toContain('color="#00ff00"');
    expect(markup).toMatch(/--ichava-primary: ?#ff0000/);
    expect(markup).toContain('var(--ichava-primary, #10ac84)');
  });
});
