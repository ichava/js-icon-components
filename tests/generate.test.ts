import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { ATTRIBUTION_DIRS, countOutputs, generate, readPackWithCounts, type Manifest } from '../src/generator/generate.ts';
import { loadPacks, needsAttribution, resolveAttribution, resolveSource, type PackConfig } from '../src/generator/packs.ts';
import { ALL_FLAVOURS } from '../src/shared/index.ts';
import { CACHE, packs, ROOT, tabler } from './helpers.ts';

let out: string;
let manifest: Manifest;

beforeAll(() => {
  // The real build into a scratch directory: tsc for the runtimes, then the generator.
  out = mkdtempSync(join(ROOT, '.cache', 'generate-'));
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(ROOT, 'tsconfig.build.json'), '--outDir', out], { cwd: ROOT });
  execFileSync(join(ROOT, 'node_modules/.bin/ngc'), ['-p', join(ROOT, 'tsconfig.angular.json'), '--outDir', out], { cwd: ROOT });
  manifest = generate({ root: ROOT, outDir: out });
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Counts the pack's SVGs straight from git, independently of the generator's own listing. */
function inputCount(pack: PackConfig): number {
  const listing = execFileSync('git', ['-C', resolveSource(pack, ROOT), 'ls-tree', '-r', '--name-only', pack.ref, '--', pack.path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const depth = pack.categories === true ? 3 : 2;
  return listing.split('\n').filter((p) => pack.sets.some((s) => p.startsWith(`${pack.path}/${s}/`) && p.endsWith('.svg') && p.slice(pack.path.length + 1).split('/').length === depth)).length;
}

/** Measured 2026-11-04 at the pinned refs. A ref bump that changes a count updates this table. */
const MEASURED: Record<string, number> = { tabler: 6257, flag: 542, emoji: 3435, openmoji: 8568 };

const PACKS = packs();
const rows = PACKS.map((p) => [p.id, p] as const);

describe('generation', () => {
  it('generates the four pinned packs, and none of the private ones', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['tabler', 'flag', 'emoji', 'openmoji']);
    expect(manifest.packs.map((p) => p.id)).toEqual(['tabler', 'flag', 'emoji', 'openmoji']);
    for (const p of PACKS) expect(p.repository).not.toMatch(/icon-sets-(bundled|metronic)/);
  });

  it.each(rows)('%s: reads its measured number of input SVGs, above the floor', (id, pack) => {
    const inputs = inputCount(pack);
    expect(inputs).toBe(MEASURED[id]);
    expect(inputs).toBeGreaterThanOrEqual(pack.minIcons);
    expect(manifest.packs.find((p) => p.id === id)?.inputs).toBe(inputs);
  });

  it.each(rows.flatMap(([id, pack]) => ALL_FLAVOURS.map((f) => [id, f, pack] as const)))('%s: writes exactly one %s icon per input SVG, less the listed exclusions', (id, flavour, pack) => {
    const expected = inputCount(pack) - (pack.exclude?.length ?? 0);
    expect(countOutputs(out, id)[flavour]).toBe(expected);
    expect(manifest.packs.find((p) => p.id === id)?.outputs[flavour]).toBe(expected);
  });

  it('the counter notices a missing output', () => {
    rmSync(join(out, 'svelte/packs/tabler/IconMug.svelte'));
    expect(countOutputs(out, 'tabler').svelte).toBe(inputCount(tabler()) - 1);
  });

  it('records the pinned ref in the manifest and in every generated module', () => {
    for (const pack of PACKS) {
      expect(manifest.packs.find((p) => p.id === pack.id)?.ref).toBe(pack.ref);
      for (const f of ['data', 'react/packs', 'vue/packs', 'wc/packs']) expect(readFileSync(join(out, `${f}/${pack.id}.js`), 'utf8')).toContain(pack.ref);
    }
  });

  it.each([
    ['react', "import { IconMug } from './react/packs/tabler.js'; console.log(IconMug);", ['react', 'react/*']],
    ['vue', "import { IconMug } from './vue/packs/tabler.js'; console.log(IconMug);", ['vue']],
  ])('tree-shakes the %s pack to the icons imported', async (_flavour, contents, external) => {
    const result = await build({ stdin: { contents, resolveDir: out, loader: 'js' }, bundle: true, format: 'esm', minify: true, write: false, external, logLevel: 'silent' });
    const code = result.outputFiles[0]?.text ?? '';
    expect(code).toContain('tabler:outline/mug');
    expect(code).not.toContain('tabler:outline/mug-off');
    expect(code.length).toBeLessThan(20_000);
  });
});

describe('exclusions', () => {
  it('lists only icons the policy still rejects', () => {
    const openmoji = PACKS.find((p) => p.id === 'openmoji') as PackConfig;
    expect(readPackWithCounts(openmoji, ROOT).excluded.sort()).toEqual([
      'resources/assets/svg/files/openmoji-black/uncategorised/1f3f4-e0063-e0061-e0071-e0063-e007f.svg',
      'resources/assets/svg/files/openmoji-color/uncategorised/1f3f4-e0063-e0061-e0071-e0063-e007f.svg',
    ]);
  });

  it('fails on an entry that now passes, or that names no file', () => {
    const t = tabler();
    expect(() => readPackWithCounts({ ...t, exclude: [{ path: 'outline/mug.svg', reason: 'test' }] }, ROOT)).toThrow(/now passes the policy/);
    expect(() => readPackWithCounts({ ...t, exclude: [{ path: 'outline/no-such-icon.svg', reason: 'test' }] }, ROOT)).toThrow(/names no SVG/);
  });
});

describe('attribution', () => {
  const ccPacks = PACKS.filter(needsAttribution);

  it('the CC-BY and CC-BY-SA packs are the two emoji packs', () => {
    expect(ccPacks.map((p) => [p.id, p.licence])).toEqual([['emoji', 'CC-BY-4.0'], ['openmoji', 'CC-BY-SA-4.0']]);
  });

  it.each(PACKS.flatMap((p) => resolveAttribution(p, ROOT).flatMap((file) => ATTRIBUTION_DIRS.map((dir) => [p.id, dir, p.id, file.split('/').pop() as string] as const))))(
    '%s ships dist/%s/%s/%s',
    (id, dir, _id, name) => {
      const file = join(out, dir, id, name);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(200);
    },
  );

  it.each(ccPacks.map((p) => [p.id, p] as const))('%s: the attribution names the artwork licence, and the manifest lists every copy', (id, pack) => {
    const text = readFileSync(join(out, 'react', id, 'ATTRIBUTION.md'), 'utf8');
    expect(text).toContain(pack.licence === 'CC-BY-SA-4.0' ? 'CC-BY-SA 4.0' : 'CC-BY 4.0');
    expect(manifest.packs.find((p) => p.id === id)?.attribution).toHaveLength(resolveAttribution(pack, ROOT).length * ATTRIBUTION_DIRS.length);
  });

  it('every generated module carries the artwork licence in a comment bundlers keep', () => {
    for (const pack of PACKS) {
      expect(readFileSync(join(out, `react/packs/${pack.id}.js`), 'utf8')).toContain(`/*! ${pack.id} artwork: ${pack.licence}.`);
    }
  });

  it('refuses a CC pack that lists no attribution files', () => {
    const file = join(CACHE, 'packs-no-attribution.json');
    const emoji = PACKS.find((p) => p.id === 'emoji');
    execFileSync('mkdir', ['-p', CACHE]);
    execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(file)}, JSON.stringify({ packs: [${JSON.stringify({ ...emoji, attribution: [] })}] }))`]);
    expect(() => loadPacks(file)).toThrow(/must list its attribution files/);
  });
});

it('keeps scratch output inside the gitignored cache', () => {
  expect(CACHE.startsWith(join(ROOT, '.cache'))).toBe(true);
});
