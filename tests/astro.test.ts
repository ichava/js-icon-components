import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { transform } from '@astrojs/compiler-rs';
import type { Plugin } from 'esbuild';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { IconData } from '../src/shared/index.ts';
import { bundleAndImport, iconsFrom, ROOT, sampleIcons } from './helpers.ts';

/**
 * The Astro templates compiled by Astro's own compiler (@astrojs/compiler-rs, the one Astro 7
 * runs), from an esbuild plugin, then rendered by Astro's container API with the real runtime.
 */
/** The options Astro 7 itself passes (astro/dist/core/compile/compile.js) that change the emitted code. */
const OPTIONS = { internalURL: 'astro/compiler-runtime', resultScopedSlot: true, resolvePath: (specifier: string) => specifier } as const;

const astroCompiler: Plugin = {
  name: 'astro',
  setup(build) {
    build.onLoad({ filter: /\.astro$/ }, ({ path }) => {
      const result = transform(readFileSync(path, 'utf8'), { ...OPTIONS, filename: path });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) throw new Error(`${path}: ${errors.map((d) => d.text).join('; ')}`);
      return { contents: result.code, loader: 'ts' };
    });
  },
};

type Compiled = { default: unknown };
const flavour = () =>
  bundleAndImport<Compiled>('astro', {
    entryPoints: [join(ROOT, 'src/astro/Icon.astro')],
    platform: 'node',
    external: ['astro', 'astro/*'],
    plugins: [astroCompiler],
  });

async function render(icon: IconData, props: Record<string, unknown> = {}): Promise<string> {
  const { default: Icon } = await flavour();
  const container = await AstroContainer.create();
  return container.renderToString(Icon as Parameters<typeof container.renderToString>[0], { props: { icon, ...props } });
}

describe('Astro flavour', () => {
  it('compiles both templates with Astro\'s compiler, and the compiler reports a broken one', () => {
    for (const f of ['Icon.astro', 'Nodes.astro']) {
      const result = transform(readFileSync(join(ROOT, 'src/astro', f), 'utf8'), { ...OPTIONS, filename: f });
      expect(result.diagnostics.filter((d) => d.severity === 'error'), f).toEqual([]);
      expect(result.code).toContain('$$createComponent');
    }
    expect(transform('---\n---\n<svg>{x</svg>', { filename: 'bad.astro' }).diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });

  it('renders three icons', async () => {
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      await render(mug!),
      await render(mugFilled!, { size: 32, color: '#7c3aed', title: 'Coffee' }),
      await render(github!, { strokeWidth: 1.5, class: 'brand' }),
    ];
    for (const markup of html) expect(markup.match(/ class="/g), markup.slice(0, 80)).toHaveLength(1);
    expect(html[2]).toContain('class="ichava-icon brand"');
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const [mug] = sampleIcons();
    expect(await render(mug!)).toContain('aria-hidden="true"');
    const titled = await render(mug!, { title: 'Coffee' });
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Coffee</title>');
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const [, mugFilled] = sampleIcons();
    expect(await render(mugFilled!, { strokeWidth: 3 })).not.toContain('stroke-width="3"');
  });

  it('renders nested elements, references and case-sensitive SVG names', async () => {
    const [ke] = iconsFrom('flag', ['IconKe']);
    const [rainbow] = iconsFrom('twemoji', ['IconRainbow']);
    const flag = await render(ke!);
    expect(flag).toContain('<defs><path id="flag_4x3_ke_ke-a"');
    expect(flag).toMatch(/xlink:href="#flag_4x3_ke_ke-a"/);
    expect(flag).toContain('viewBox="0 0 640 480"');
    expect(await render(rainbow!)).toContain('fill="#8767AC"');
  });
});
