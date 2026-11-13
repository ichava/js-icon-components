import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createOptimizer } from '@builder.io/qwik/optimizer';
import type { Plugin } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { bundleAndImport, ROOT, sampleIcons } from './helpers.ts';
import type { IconData } from '../src/shared/index.ts';

/**
 * The Qwik template, bundled by esbuild and rendered by Qwik's own server renderer
 * (`@builder.io/qwik/server`), plus a pass of Qwik's optimizer over an application component that
 * uses an icon inside `component$`, which is how an application's build meets this package.
 */

// The server renderer imports the client build's manifest, a module Vite provides. A test has no
// client build, so it is empty here, exactly as Qwik's own tests stub it.
const manifestStub: Plugin = {
  name: 'qwik-client-manifest',
  setup(build) {
    build.onResolve({ filter: /^@qwik-client-manifest$/ }, () => ({ path: 'manifest', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const manifest = undefined;' }));
  },
};

interface Harness {
  render(icon: IconData, props: Record<string, unknown>): Promise<string>;
}

const harness = () =>
  bundleAndImport<Harness>('qwik', {
    stdin: {
      contents: `
        import { jsx } from '@builder.io/qwik';
        import { renderToString } from '@builder.io/qwik/server';
        import { createIcon } from './index.ts';
        export async function render(icon, props) {
          const Icon = createIcon(icon);
          const { html } = await renderToString(jsx(Icon, props), { containerTagName: 'div', qwikLoader: { include: 'never' }, manifest: { symbols: {}, mapping: {}, bundles: {}, version: '1' } });
          // The container's own attributes carry a random instance id; the icon is what is tested.
          return /<svg[\\s\\S]*<\\/svg>/.exec(html)?.[0] ?? html;
        }
      `,
      resolveDir: join(ROOT, 'src/qwik'),
      loader: 'ts',
    },
    plugins: [manifestStub],
    define: { 'import.meta.env': '{}' },
  });

describe('Qwik flavour', () => {
  it('renders three icons on the server with Qwik', async () => {
    const { render } = await harness();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      await render(mug!, {}),
      await render(mugFilled!, { size: 32, color: '#7c3aed', title: 'Coffee' }),
      await render(github!, { strokeWidth: 1.5, class: 'brand' }),
    ];
    expect(html[0]).toContain('aria-hidden="true"');
    expect(html[1]).toContain('<title>Coffee</title>');
    expect(html[1]).not.toContain('aria-hidden');
    expect(html[2]).toContain('class="ichava-icon brand"');
    expect(html).toMatchSnapshot();
  });

  it("an application's component$ that uses an icon goes through Qwik's optimizer", async () => {
    const optimizer = await createOptimizer();
    const app = [
      "import { component$ } from '@builder.io/qwik';",
      "import { IconMug } from '@ichava/js-icon-components/qwik/tabler';",
      'export const Badge = component$(() => <span><IconMug size={20} title="Coffee" /></span>);',
    ].join('\n');
    const out = await optimizer.transformModules({
      srcDir: '/app/src',
      input: [{ path: 'badge.tsx', code: app }],
      entryStrategy: { type: 'smart' },
      transpileTs: true,
      transpileJsx: true,
      isServer: true,
    });
    expect(out.diagnostics.filter((d) => d.category === 'error')).toEqual([]);
    const code = out.modules.map((m) => m.code).join('\n');
    expect(code).toContain('@ichava/js-icon-components/qwik/tabler');
    expect(code).toContain('IconMug');
  });

  it("the shipped template passes through the optimizer untouched, needing no $ transform", async () => {
    const optimizer = await createOptimizer();
    const out = await optimizer.transformModules({
      srcDir: join(ROOT, 'src/qwik'),
      input: [{ path: 'index.ts', code: readFileSync(join(ROOT, 'src/qwik/index.ts'), 'utf8') }],
      entryStrategy: { type: 'smart' },
      transpileTs: true,
      isServer: true,
    });
    expect(out.diagnostics.filter((d) => d.category === 'error')).toEqual([]);
    // One module out, no segments split off: there is no `$` boundary in the template.
    expect(out.modules).toHaveLength(1);
  });
});
