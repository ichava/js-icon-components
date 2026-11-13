import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { precompile } from '@glimmer/compiler';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { compileEmber } from '../src/generator/generate.ts';
import { iconMarkup } from '../src/ember/markup.ts';
import { ROOT, sampleIcons } from './helpers.ts';

/**
 * The Ember template, `src/ember/Icon.gjs`, compiled the way the build compiles it: content-tag
 * turns the template tag into JavaScript, and the Glimmer precompiler compiles the template in
 * strict mode with exactly the module's imports in scope.
 *
 * What this proves, and what it does not: the template is valid Glimmer and calls only what it
 * imports, and the markup it emits (the helper's output, rendered here) is right. It does not boot
 * an Ember application: no Ember runtime is installed, so the component is not mounted by Ember.
 */

const source = readFileSync(join(ROOT, 'src/ember/Icon.gjs'), 'utf8');

describe('Ember flavour', () => {
  it('compiles with content-tag and the Glimmer precompiler', () => {
    const code = compileEmber(source, 'Icon.gjs', ['iconMarkup']);
    expect(code).toContain('from "@ember/template-compiler"');
    expect(code).toContain("import { iconMarkup } from './markup.js';");
    expect(code).toMatch(/export default template_\w+\(`/);
  });

  it('the precompiler refuses a helper that is not in scope, so the check can fail', () => {
    expect(() => compileEmber(source, 'Icon.gjs', [])).toThrow(/not in scope: iconMarkup/);
    expect(() => precompile('{{{iconMarkup @icon}}', { strictMode: true })).toThrow();
  });

  it('renders three icons', () => {
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      iconMarkup(mug!),
      iconMarkup(mugFilled!, 32, '#7c3aed', undefined, 'Coffee'),
      iconMarkup(github!, undefined, undefined, 1.5, undefined, 'brand'),
    ];
    expect(html[0]).toContain('aria-hidden="true"');
    expect(html[1]).toContain('<title>Coffee</title>');
    expect(html[2]).toContain('class="ichava-icon brand"');
    expect(html).toMatchSnapshot();
  });

  it('the markup parses back into the same SVG tree, with every attribute escaped', () => {
    const [mug] = sampleIcons();
    const hostile = { ...mug!, nodes: [['path', { d: 'M0 0', 'data-x': '"><script>alert(1)</script>' }]] } as typeof mug;
    const html = iconMarkup(hostile!, undefined, undefined, undefined, '</title><script>x</script>');
    const doc = new JSDOM(`<body>${html}</body>`).window.document;
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('path')?.getAttribute('data-x')).toBe('"><script>alert(1)</script>');
    expect(doc.querySelector('title')?.textContent).toBe('</title><script>x</script>');
    expect(doc.querySelector('svg')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});
