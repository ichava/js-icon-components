import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { countOutputs, generate, type Manifest } from '../src/generator/generate.ts';
import { resolveSource } from '../src/generator/packs.ts';
import { FLAVOURS } from '../src/shared/index.ts';
import { CACHE, ROOT, tabler } from './helpers.ts';

let out: string;
let manifest: Manifest;

beforeAll(() => {
  // The real build into a scratch directory: tsc for the runtimes, then the generator.
  out = mkdtempSync(join(ROOT, '.cache', 'generate-'));
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(ROOT, 'tsconfig.build.json'), '--outDir', out], { cwd: ROOT });
  manifest = generate({ root: ROOT, outDir: out });
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Counts the pack's SVGs straight from git, independently of the generator's own listing. */
function inputCount(): number {
  const pack = tabler();
  const listing = execFileSync('git', ['-C', resolveSource(pack, ROOT), 'ls-tree', '-r', '--name-only', pack.ref, '--', pack.path], { encoding: 'utf8' });
  return listing.split('\n').filter((p) => pack.sets.some((s) => p.startsWith(`${pack.path}/${s}/`) && p.endsWith('.svg'))).length;
}

describe('generation', () => {
  it('reads at least the floor of input SVGs', () => {
    const pack = tabler();
    expect(inputCount()).toBeGreaterThanOrEqual(pack.minIcons);
  });

  it.each(FLAVOURS)('writes exactly one %s icon per input SVG', (flavour) => {
    const inputs = inputCount();
    expect(countOutputs(out, 'tabler')[flavour]).toBe(inputs);
    expect(manifest.packs[0]?.outputs[flavour]).toBe(inputs);
  });

  it('the counter notices a missing output', () => {
    rmSync(join(out, 'svelte/packs/tabler/IconMug.svelte'));
    expect(countOutputs(out, 'tabler').svelte).toBe(inputCount() - 1);
  });

  it('records the pinned ref in the manifest and in every generated module', () => {
    const pack = tabler();
    expect(manifest.packs[0]?.ref).toBe(pack.ref);
    expect(readFileSync(join(out, 'react/packs/tabler.js'), 'utf8')).toContain(pack.ref);
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

it('keeps scratch output inside the gitignored cache', () => {
  expect(CACHE.startsWith(join(ROOT, '.cache'))).toBe(true);
});
