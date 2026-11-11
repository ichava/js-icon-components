import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readPack } from '../src/generator/generate.ts';
import { listSvgs, readBlobs, resolveSource } from '../src/generator/packs.ts';
import type * as ReactFlavour from '../src/react/index.tsx';
import { bundleAndImport, iconsFrom, pack, ROOT } from './helpers.ts';

/**
 * Multi-colour artwork must render with its own colours. A flavour that forced `currentColor`, a
 * prefixing bug that broke a `url(#gradient)`, or a template that dropped `style` would each turn a
 * flag or an emoji into a silhouette. The guard renders every multi-colour icon in the colour packs
 * and compares the colours in the markup with the colours in the source SVG, one by one.
 */

const flavour = () =>
  bundleAndImport<typeof ReactFlavour>('react-colours', {
    entryPoints: [join(ROOT, 'src/react/index.tsx')],
    jsx: 'automatic',
    external: ['react', 'react-dom'],
  });

const PAINT = /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*[=:]\s*"?\s*(#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\))/gi;

/** Every colour literal in paint position, in document order, lowercased. Root `color` from props is excluded by not passing it. */
const colours = (svg: string): string[] => [...svg.matchAll(PAINT)].map((m) => (m[2] as string).toLowerCase().replace(/\s+/g, ''));

const COLOUR_PACKS = ['flag', 'twemoji', 'openmoji'] as const;

describe('multi-colour icons keep their colours', () => {
  it.each(COLOUR_PACKS)('%s: every multi-colour icon renders every source colour', async (id) => {
    const { createIcon } = await flavour();
    const p = pack(id);
    const dir = resolveSource(p, ROOT);
    const sources = listSvgs(dir, p);
    const blobs = readBlobs(dir, sources.map((s) => s.blob));
    const sourceOf = new Map(sources.map((s) => [`${p.id}:${s.set}/${s.name}`, blobs.get(s.blob) as string]));

    let checked = 0;
    for (const { data } of readPack(p, ROOT)) {
      const expected = colours(sourceOf.get(data.id) as string);
      if (new Set(expected).size < 2) continue;
      checked++;
      expect(colours(renderToStaticMarkup(createElement(createIcon(data)))), data.id).toEqual(expected);
    }
    // Floors, measured 2026-11-04 a little under the real counts, so a matcher that stops matching fails.
    expect(checked).toBeGreaterThan({ flag: 500, twemoji: 3000, openmoji: 3000 }[id]);
  });

  it('renders three multi-colour icons', async () => {
    const { createIcon } = await flavour();
    const icons = [...iconsFrom('twemoji', ['IconRainbow']), ...iconsFrom('openmoji', ['IconRainbow']), ...iconsFrom('flag', ['IconKe'])];
    const html = icons.map((icon) => renderToStaticMarkup(createElement(createIcon(icon), { size: 48 })));
    for (const markup of html) expect(new Set(colours(markup)).size).toBeGreaterThanOrEqual(3);
    expect(html).toMatchSnapshot();
  });

  it('the matcher sees a silhouette', () => {
    expect(colours('<path fill="#F00"/><path style="fill:#00f"/><stop stop-color="rgb(1, 2, 3)"/>')).toEqual(['#f00', '#00f', 'rgb(1,2,3)']);
    expect(colours('<path fill="currentColor"/>')).toEqual([]);
  });
});
