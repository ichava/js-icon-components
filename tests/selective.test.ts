import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countOutputs, FLAVOUR_DIRS, generate, parseSelection, unbuiltMessage, type Manifest } from '../src/generator/generate.ts';
import { ALL_FLAVOURS, ASSET_TARGETS } from '../src/shared/index.ts';
import { ASSET_FILES as TARBALL_ASSET_FILES, FLAVOUR_DIRS as TARBALL_FLAVOUR_DIRS } from '../scripts/check-tarball.mjs';
import { ASSET_FILES } from '../src/generator/assets.ts';
import { packs, ROOT } from './helpers.ts';

/**
 * A selective build, as `ICHAVA_ICONS_PACKS=flag ICHAVA_ICONS_FLAVOURS=react` asks for: the flag
 * pack for React only. Everything else must be a stub that throws naming the variable to set.
 */
const IDS = packs().map((p) => p.id);
const SELECTION = parseSelection({ packs: 'flag', flavours: 'react' }, IDS);

let out: string;
let manifest: Manifest;

beforeAll(() => {
  out = mkdtempSync(join(ROOT, '.cache', 'selective-'));
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(ROOT, 'tsconfig.build.json'), '--outDir', out], { cwd: ROOT, stdio: 'ignore' });
  execFileSync(join(ROOT, 'node_modules/.bin/ngc'), ['-p', join(ROOT, 'tsconfig.angular.json'), '--outDir', out], { cwd: ROOT, stdio: 'ignore' });
  manifest = generate({ root: ROOT, outDir: out, selection: SELECTION });
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Runs a static named import in a fresh Node, as an application would, and returns what it printed. */
function importIn(file: string, name: string): { status: number | null; stderr: string; stdout: string } {
  const script = join(out, `probe-${name}-${readdirSync(out).length}.mjs`);
  writeFileSync(script, `import { ${name} } from ${JSON.stringify(pathToFileURL(join(out, file)).href)};\nconsole.log(typeof ${name});\n`);
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}

describe('selection', () => {
  it('reads names by subpath or registry id, and defaults to everything', () => {
    expect(parseSelection({}, IDS)).toEqual({ packs: IDS, flavours: [...ALL_FLAVOURS], assets: [...ASSET_TARGETS] });
    expect(parseSelection({ packs: ' ', flavours: '' }, IDS)).toEqual({ packs: IDS, flavours: [...ALL_FLAVOURS], assets: [...ASSET_TARGETS] });
    expect(parseSelection({ packs: 'openmoji, tabler,tabler', flavours: 'wc,react-native,reactNative' }, IDS)).toEqual({
      packs: ['tabler', 'openmoji'],
      flavours: ['webcomponent', 'reactNative'],
      assets: [],
    });
  });

  it('names asset exports in the same list as flavours, and a list of exports alone builds no flavour', () => {
    expect(parseSelection({ flavours: 'png-zip,react,css-mask' }, IDS)).toEqual({ packs: IDS, flavours: ['react'], assets: ['css-mask', 'png-zip'] });
    expect(parseSelection({ flavours: 'android-vd' }, IDS)).toEqual({ packs: IDS, flavours: [], assets: ['android-vd'] });
    expect(parseSelection({ flavours: 'qwik,elm,ember' }, IDS)).toEqual({ packs: IDS, flavours: ['qwik', 'ember', 'elm'], assets: [] });
    expect(() => parseSelection({ flavours: 'png' }, IDS)).toThrow(/the asset exports are css-mask, data-uri, png-zip, flutter, swiftui, android-vd/);
  });

  it('refuses an unknown pack or flavour, naming the variable and the valid names', () => {
    expect(() => parseSelection({ packs: 'tabler,metronic' }, IDS)).toThrow(/ICHAVA_ICONS_PACKS: unknown pack "metronic"\. The packs are tabler, flag, emoji, openmoji/);
    expect(() => parseSelection({ flavours: 'jquery' }, IDS)).toThrow(/ICHAVA_ICONS_FLAVOURS: unknown flavour "jquery"\. The flavours are react, vue, svelte, wc,/);
  });

  it('the tarball checker knows the same flavour directories and asset files as the generator', () => {
    expect(TARBALL_FLAVOUR_DIRS).toEqual(FLAVOUR_DIRS);
    expect(TARBALL_ASSET_FILES).toEqual(ASSET_FILES);
  });
});

describe('a selective build (flag, react)', () => {
  it('records what it built and what it left out', () => {
    expect(manifest.packs.map((p) => p.id)).toEqual(['flag']);
    expect(manifest.flavours).toEqual(['react']);
    expect(manifest.unbuilt).toEqual({ packs: ['tabler', 'emoji', 'openmoji'], flavours: ALL_FLAVOURS.filter((f) => f !== 'react'), assets: [...ASSET_TARGETS] });
    expect(manifest.assets).toEqual([]);
  });

  it('writes every flag icon for React, and the data behind it', () => {
    const flag = manifest.packs[0];
    expect(flag?.outputs).toEqual({ react: 542 });
    expect(countOutputs(out, 'flag', ['react', 'webcomponent'])).toEqual({ react: 542, webcomponent: 542 });
    expect(readFileSync(join(out, 'data/flag.js'), 'utf8')).toMatch(/^export const IconKe = \{/m);
    expect(flag?.attribution).toEqual(['data/flag/ATTRIBUTION.md', 'react/flag/ATTRIBUTION.md']);
  });

  it('writes no icon for anything it did not select', () => {
    for (const id of IDS) {
      for (const f of ALL_FLAVOURS) {
        if (id === 'flag' && f === 'react') continue;
        if (f === 'webcomponent' && id === 'flag') continue; // wc re-exports data, which flag has
        // Elm is source with no stand-in: an unbuilt Elm module is simply not there.
        if (f === 'elm') expect(existsSync(join(out, 'elm'))).toBe(false);
        else if (f === 'svelte') expect(readdirSync(join(out, `svelte/packs/${id}`)).sort(), `${id} ${f}`).toEqual(['index.d.ts', 'index.js']);
        else expect(countOutputs(out, id, [f])[f], `${id} ${f}`).toBe(0);
      }
    }
    expect(existsSync(join(out, 'vue/flag'))).toBe(false);
    expect(existsSync(join(out, 'assets'))).toBe(false);
    for (const id of ['tabler', 'emoji', 'openmoji']) expect(statSync(join(out, `data/${id}.js`)).size).toBeLessThan(400_000);
  });

  it('an unbuilt pack throws on a named import, naming ICHAVA_ICONS_PACKS', () => {
    const r = importIn('react/packs/tabler.js', 'IconMug');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('the "tabler" pack was not built by this install');
    expect(r.stderr).toContain('ICHAVA_ICONS_PACKS=flag,tabler');
    expect(r.stderr).not.toContain('does not provide an export');
  });

  it('an unbuilt flavour throws for a built pack, naming ICHAVA_ICONS_FLAVOURS', () => {
    const r = importIn('vue/packs/flag.js', 'IconKe');
    expect(r.stderr).toContain('the "vue" flavour was not built by this install');
    expect(r.stderr).toContain('ICHAVA_ICONS_FLAVOURS=react,vue');
  });

  it("an unbuilt flavour's entry point and an unbuilt pack's data throw too", () => {
    expect(importIn('vue/index.js', 'defineIcon').stderr).toContain('ICHAVA_ICONS_FLAVOURS=react,vue');
    expect(importIn('svelte/packs/emoji/index.js', 'IconGrinningFace').stderr).toContain('ICHAVA_ICONS_PACKS=flag,emoji and ICHAVA_ICONS_FLAVOURS=react,svelte');
    expect(importIn('data/openmoji.js', 'IconGrinningFace').stderr).toContain('the "openmoji" pack was not built');
  });

  it('what was built still imports', () => {
    const r = importIn('react/packs/flag.js', 'IconKe');
    expect(r.stderr).toBe('');
    expect(r.stdout.trim()).toBe('object');
  });

  it('the message names what is missing, what was built and both ways forward', () => {
    expect(unbuiltMessage({ pack: 'tabler', flavour: 'vue' }, SELECTION)).toBe(
      '@ichava/js-icon-components: the "tabler" pack and the "vue" flavour were not built by this install, which built the packs flag for the flavours react. ' +
        'Reinstall with ICHAVA_ICONS_PACKS=flag,tabler and ICHAVA_ICONS_FLAVOURS=react,vue (or the same list under "ichava.icons" in your package.json), ' +
        'or install the prebuilt release tarball, which has every pack and flavour.',
    );
  });
});
