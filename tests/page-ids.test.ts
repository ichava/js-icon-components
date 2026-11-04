import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readPack } from '../src/generator/generate.ts';
import { collectIds, collectRefs } from '../src/generator/ids.ts';
import type * as ReactFlavour from '../src/react/index.tsx';
import type { IconData } from '../src/shared/index.ts';
import { bundleAndImport, iconsFrom, pack, packs, ROOT } from './helpers.ts';

/**
 * The guard for per-icon id prefixing: one page renders two icons from the same pack and two from
 * different packs, and every `id` on it is distinct. OpenMoji is the hard case: every icon in it
 * defines `id="emoji"`, `id="color"` and `id="line"`. Flags carry `<use xlink:href>` and clip paths.
 */

const flavour = () =>
  bundleAndImport<typeof ReactFlavour>('react-ids', {
    entryPoints: [join(ROOT, 'src/react/index.tsx')],
    jsx: 'automatic',
    external: ['react', 'react-dom'],
  });

const page = async (icons: readonly IconData[]): Promise<string> => {
  const { createIcon } = await flavour();
  return renderToStaticMarkup(createElement(Fragment, null, ...icons.map((icon, key) => createElement(createIcon(icon), { key }))));
};

const idsOn = (html: string): string[] => [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1] as string);
const duplicates = (ids: readonly string[]): string[] => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

const SAME_PACK = ['IconGrinningFace', 'IconRainbow'] as const;

describe('ids on a page', () => {
  it('two icons from the same pack share no id', async () => {
    const html = await page(iconsFrom('openmoji', SAME_PACK));
    const ids = idsOn(html);
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(duplicates(ids)).toEqual([]);
  });

  it('icons from different packs share no id', async () => {
    const icons = [...iconsFrom('openmoji', ['IconGrinningFace']), ...iconsFrom('flag', ['IconKe', 'IconKe1x1']), ...iconsFrom('emoji', ['IconRainbow'])];
    const ids = idsOn(await page(icons));
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(duplicates(ids)).toEqual([]);
  });

  it('the guard sees the collision when ids are not prefixed', async () => {
    const raw = readPack(pack('openmoji'), ROOT, { prefix: false });
    const icons = SAME_PACK.map((n) => raw.find((i) => i.exportName === n)?.data as IconData);
    expect(duplicates(idsOn(await page(icons)))).toEqual(expect.arrayContaining(['color', 'line']));
  });
});

describe('ids across every pinned pack', () => {
  const all = packs().map((p) => [p.id, readPack(p, ROOT)] as const);

  it('read every pack', () => {
    expect(all.map(([id]) => id)).toEqual(['tabler', 'flag', 'emoji', 'openmoji']);
  });

  it.each(all)('%s: no id is used by two icons, and every id carries its icon\'s prefix', (_id, icons) => {
    const owner = new Map<string, string>();
    let seen = 0;
    for (const { data } of icons) {
      const prefix = `${data.pack}_${data.set}_`;
      for (const id of [...collectIds(data.nodes), ...(data.attrs.id ? [data.attrs.id] : [])]) {
        seen++;
        expect(id.startsWith(prefix), `${data.id}: ${id}`).toBe(true);
        const other = owner.get(id);
        if (other !== undefined && other !== data.id) throw new Error(`${id} is defined by ${other} and ${data.id}`);
        owner.set(id, data.id);
      }
    }
    // Measured 2026-11-04 at the pinned refs: tabler 0, flag 1,155, emoji 14, openmoji 26,314.
    expect(seen).toBeGreaterThanOrEqual({ tabler: 0, flag: 1100, emoji: 14, openmoji: 26000 }[_id] as number);
    if (_id === 'tabler') expect(seen).toBe(0);
  });

  it.each(all)('%s: prefixing breaks no reference that resolved before', (id, icons) => {
    const raw = new Map(readPack(pack(id), ROOT, { prefix: false }).map((i) => [i.exportName, i.data]));
    let resolved = 0;
    for (const { exportName, data } of icons) {
      const before = raw.get(exportName) as IconData;
      const beforeIds = collectIds(before.nodes);
      const afterIds = collectIds(data.nodes);
      const ok = (refs: string[], ids: Set<string>) => refs.filter((r) => ids.has(r)).length;
      const b = ok(collectRefs({ rootAttrs: before.attrs, nodes: before.nodes }), beforeIds);
      expect(ok(collectRefs({ rootAttrs: data.attrs, nodes: data.nodes }), afterIds), data.id).toBe(b);
      resolved += b;
    }
    if (id === 'flag') expect(resolved).toBeGreaterThan(500);
  });
});
