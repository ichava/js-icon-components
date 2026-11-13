import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { bundleAndImport, ROOT, sampleIcons } from './helpers.ts';

const source = readFileSync(join(ROOT, 'src/svelte/Icon.svelte'), 'utf8');

// The Svelte template compiled by svelte/compiler for the server, then rendered by svelte/server.
const flavour = () =>
  bundleAndImport<{ default: Component<Record<string, unknown>> }>('svelte', {
    stdin: {
      contents: compile(source, { filename: 'Icon.svelte', generate: 'server' }).js.code,
      resolveDir: join(ROOT, 'src/svelte'),
      loader: 'js',
    },
    external: ['svelte', 'svelte/*'],
  });

describe('Svelte flavour', () => {
  it('compiles the template with svelte/compiler, for client and server', () => {
    expect(compile(source, { filename: 'Icon.svelte', generate: 'client' }).js.code).toContain('$.');
    expect(compile(source, { filename: 'Icon.svelte', generate: 'server' }).js.code).toContain('$.');
  });

  it('compiles the generated per-icon wrapper', () => {
    const wrapper = "<script>\n  import Icon from '../../Icon.svelte';\n  import { IconMug as icon } from '../../../data/tabler.js';\n  let props = $props();\n</script>\n\n<Icon {...props} {icon} />\n";
    expect(() => compile(wrapper, { filename: 'IconMug.svelte', generate: 'client' })).not.toThrow();
  });

  it('renders three icons', async () => {
    const { default: Icon } = await flavour();
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      render(Icon, { props: { icon: mug } }).body,
      render(Icon, { props: { icon: mugFilled, size: 32, color: '#7c3aed', title: 'Coffee' } }).body,
      render(Icon, { props: { icon: github, strokeWidth: 1.5, class: 'brand' } }).body,
    ].map((h) => h.replace(/<!--[^>]*-->/g, ''));
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a title and named with one', async () => {
    const { default: Icon } = await flavour();
    const [mug] = sampleIcons();
    expect(render(Icon, { props: { icon: mug } }).body).toContain('aria-hidden="true"');
    const titled = render(Icon, { props: { icon: mug, title: 'Coffee' } }).body;
    expect(titled).not.toContain('aria-hidden');
    expect(titled).toContain('<title>Coffee</title>');
  });
});
