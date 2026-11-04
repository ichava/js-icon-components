import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import type * as PreactFlavour from '../src/preact/index.tsx';
import { bundleAndImport, iconsFrom, ROOT, sampleIcons } from './helpers.ts';

// The Preact template compiled by esbuild's TSX compiler with Preact's automatic JSX runtime,
// then rendered by preact-render-to-string.
const flavour = () =>
  bundleAndImport<typeof PreactFlavour>('preact', {
    entryPoints: [join(ROOT, 'src/preact/index.tsx')],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    external: ['preact', 'preact/*'],
  });

describe('Preact flavour', () => {
  it('compiles the template with esbuild (TSX, Preact JSX runtime)', async () => {
    const { Icon, createIcon } = await flavour();
    expect(typeof createIcon).toBe('function');
    expect(typeof Icon).toBe('function');
  });

  it('renders three icons', async () => {
    const { createIcon } = await flavour();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      renderToString(h(createIcon(mug!), {})),
      renderToString(h(createIcon(mugFilled!), { size: 32, color: '#7c3aed', title: 'Coffee' })),
      renderToString(h(createIcon(github!), { strokeWidth: 1.5, class: 'brand' })),
    ];
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const { createIcon } = await flavour();
    const Mug = createIcon(sampleIcons()[0]!);
    expect(renderToString(h(Mug, {}))).toContain('aria-hidden="true"');
    const titled = renderToString(h(Mug, { title: 'Coffee' }));
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Coffee</title>');
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const { createIcon } = await flavour();
    expect(renderToString(h(createIcon(sampleIcons()[1]!), { strokeWidth: 3 }))).not.toContain('stroke-width="3"');
  });

  it('renders a flag with its style string and references', async () => {
    const { createIcon } = await flavour();
    const [ke] = iconsFrom('flag', ['IconKe']);
    const html = renderToString(h(createIcon(ke!), {}));
    expect(html).toContain('id="flag_4x3_ke_ke-a"');
    expect(html).toMatch(/href="#flag_4x3_ke_ke-a"/);
  });
});
