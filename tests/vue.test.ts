import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { compileVue } from '../src/generator/generate.ts';
import type { IconData, IconProps } from '../src/shared/index.ts';
import { bundleAndImport, ROOT, sampleIcons } from './helpers.ts';

interface VueFlavour {
  default: object;
  defineIcon: (icon: IconData) => (props: IconProps) => unknown;
}

// The Vue template compiled by @vue/compiler-sfc (script and template), then server-rendered.
const flavour = () =>
  bundleAndImport<VueFlavour>('vue', {
    stdin: {
      contents: compileVue(readFileSync(join(ROOT, 'src/vue/Icon.vue'), 'utf8'), 'Icon.vue'),
      resolveDir: join(ROOT, 'src/vue'),
      loader: 'js',
    },
    external: ['vue'],
  });

const render = (component: unknown, props: Record<string, unknown> = {}) =>
  renderToString(createSSRApp({ render: () => h(component as never, props) }));

describe('Vue flavour', () => {
  it('compiles the template with @vue/compiler-sfc', async () => {
    const { default: Icon, defineIcon } = await flavour();
    expect(typeof defineIcon).toBe('function');
    expect(Icon).toHaveProperty('render');
  });

  it('renders three icons', async () => {
    const { defineIcon } = await flavour();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      await render(defineIcon(mug!)),
      await render(defineIcon(mugFilled!), { size: 32, color: '#7c3aed', title: 'Coffee' }),
      await render(defineIcon(github!), { strokeWidth: 1.5, class: 'brand' }),
    ];
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const { defineIcon } = await flavour();
    const [mug] = sampleIcons();
    expect(await render(defineIcon(mug!))).toContain('aria-hidden="true"');
    const titled = await render(defineIcon(mug!), { title: 'Coffee' });
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('<title>Coffee</title>');
  });
});
