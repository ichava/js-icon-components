import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import svgPolicy from '../vendor/svg-policy.json' with { type: 'json' };
import type * as NativeFlavour from '../src/react-native/index.tsx';
import { bundleAndImport, iconsFrom, ROOT, sampleIcons } from './helpers.ts';

// The React Native template compiled by esbuild's TSX compiler (Metro's Babel preset does the same
// JSX transform), with react-native-svg replaced by a host-element stand-in, then rendered by
// react-dom/server. `npm run typecheck` checks the template against react-native-svg's real types.
const flavour = () =>
  bundleAndImport<typeof NativeFlavour>('react-native', {
    entryPoints: [join(ROOT, 'src/react-native/index.tsx')],
    jsx: 'automatic',
    external: ['react', 'react-dom'],
    alias: { 'react-native-svg': join(ROOT, 'tests/shims/react-native-svg.tsx') },
  });

describe('React Native flavour', () => {
  it('compiles the template with esbuild (TSX)', async () => {
    const { Icon, createIcon } = await flavour();
    expect(typeof createIcon).toBe('function');
    expect(Icon).toBeTruthy();
  });

  it('maps every element the SVG policy allows to a react-native-svg component', async () => {
    const { ELEMENTS } = await flavour();
    const rendered = svgPolicy.allowedTags.filter((t) => !['title', 'desc', 'metadata'].includes(t));
    expect(rendered.length).toBeGreaterThan(40);
    for (const tag of rendered) expect(ELEMENTS[tag], tag).toBeTypeOf('function');
  });

  it('renders three icons', async () => {
    const { createIcon } = await flavour();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      renderToStaticMarkup(createElement(createIcon(mug!))),
      renderToStaticMarkup(createElement(createIcon(mugFilled!), { size: 32, color: '#7c3aed', title: 'Coffee' })),
      renderToStaticMarkup(createElement(createIcon(github!), { strokeWidth: 1.5 })),
    ];
    expect(html).toMatchSnapshot();
  });

  it('renders a flag with its refs, clip paths and style props intact', async () => {
    const { createIcon } = await flavour();
    const [ke] = iconsFrom('flag', ['IconKe']);
    const html = renderToStaticMarkup(createElement(createIcon(ke!)));
    expect(html).toContain('href="#flag_4x3_ke_ke-a"');
    expect(html).not.toContain('xlink');
    expect(html).toContain('fill="#b00"');
  });

  it('is hidden from assistive technology without a title and labelled with one', async () => {
    const { createIcon } = await flavour();
    const Mug = createIcon(sampleIcons()[0]!);
    expect(renderToStaticMarkup(createElement(Mug))).toContain('importantForAccessibility="no-hide-descendants"');
    const titled = renderToStaticMarkup(createElement(Mug, { title: 'Coffee' }));
    expect(titled).toContain('accessibilityLabel="Coffee"');
    expect(titled).toContain('accessibilityRole="image"');
    expect(titled).not.toContain('<title>');
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const { createIcon } = await flavour();
    expect(renderToStaticMarkup(createElement(createIcon(sampleIcons()[1]!), { strokeWidth: 3 }))).not.toContain('strokeWidth="3"');
    expect(renderToStaticMarkup(createElement(createIcon(sampleIcons()[0]!), { strokeWidth: 3 }))).toContain('strokeWidth="3"');
  });

  it('splits a style string into props', async () => {
    const { nativeProps } = await flavour();
    expect(nativeProps({ style: 'marker:none; fill : #fff;-inkscape-stroke:none', 'clip-path': 'url(#a)', 'xlink:href': '#b', class: 'x', 'aria-label': 'y' }))
      .toEqual({ marker: 'none', fill: '#fff', clipPath: 'url(#a)', href: '#b' });
  });
});
