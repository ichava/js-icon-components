import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactFlavour from '../src/react/index.tsx';
import { bundleAndImport, ROOT, sampleIcons } from './helpers.ts';

// The React template compiled by esbuild's TSX compiler, then rendered by react-dom/server.
const flavour = () =>
  bundleAndImport<typeof ReactFlavour>('react', {
    entryPoints: [join(ROOT, 'src/react/index.tsx')],
    jsx: 'automatic',
    external: ['react', 'react-dom'],
  });

describe('React flavour', () => {
  it('compiles the template with esbuild (TSX)', async () => {
    const { Icon, createIcon } = await flavour();
    expect(typeof createIcon).toBe('function');
    expect(Icon).toBeTruthy();
  });

  it('renders three icons', async () => {
    const { createIcon } = await flavour();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      renderToStaticMarkup(createElement(createIcon(mug!))),
      renderToStaticMarkup(createElement(createIcon(mugFilled!), { size: 32, color: '#7c3aed', title: 'Coffee' })),
      renderToStaticMarkup(createElement(createIcon(github!), { strokeWidth: 1.5, className: 'brand' })),
    ];
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const { createIcon } = await flavour();
    const [mug] = sampleIcons();
    const Mug = createIcon(mug!);
    expect(renderToStaticMarkup(createElement(Mug))).toContain('aria-hidden="true"');
    const titled = renderToStaticMarkup(createElement(Mug, { title: 'Coffee' }));
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Coffee</title>');
  });

  it('turns a style string into the object React requires', async () => {
    const { styleObject } = await flavour();
    expect(styleObject('marker:none; -webkit-text-stroke:1px;-ms-flex-x:2;--ichava-primary:#f00;stroke-width : 2;;bad')).toEqual({
      marker: 'none',
      WebkitTextStroke: '1px',
      msFlexX: '2',
      '--ichava-primary': '#f00',
      strokeWidth: '2',
    });
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const { createIcon } = await flavour();
    const [, mugFilled] = sampleIcons();
    expect(renderToStaticMarkup(createElement(createIcon(mugFilled!), { strokeWidth: 3 }))).not.toContain('stroke-width="3"');
  });
});
