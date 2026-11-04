// @ts-check
/**
 * Checks a packed tarball (`npm pack`) is installable as-is: `dist/` holds every module its own
 * manifest says was built, a stand-in for everything it says was not, and nothing from the
 * development tree ships. Used by the tests and by release.yml before a tarball is attached.
 *
 *   node scripts/check-tarball.mjs <file.tgz> [--packs tabler,flag]
 *
 * `--packs` asserts which packs the tarball was built with (every one when omitted).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Each flavour's directory under dist/; mirrors FLAVOUR_DIRS in src/generator/generate.ts. */
export const FLAVOUR_DIRS = {
  react: 'react',
  vue: 'vue',
  svelte: 'svelte',
  webcomponent: 'wc',
  reactNative: 'react-native',
  angular: 'angular',
  solid: 'solid',
  preact: 'preact',
  astro: 'astro',
};

/** Development-tree paths that must never ship. */
export const FORBIDDEN = ['src/', 'tests/', 'scripts/', 'node_modules/', '.cache/', 'vendor/', 'config/', '.github/', 'docs/', 'packs.json', 'tsconfig'];

/**
 * @typedef {{ id: string, outputs: Record<string, number>, attribution: string[] }} PackEntry
 * @typedef {{ flavours: string[], packs: PackEntry[], unbuilt?: { packs: string[], flavours: string[] } }} Manifest
 */

/**
 * @param {{ files: string[], manifest: Manifest, pkg: Record<string, any>, packIds: string[], expectPacks?: string[] }} input
 *   `files` are paths inside the tarball with the leading `package/` removed; `packIds` is every
 *   pack in packs.json.
 * @returns {string[]} the problems found; empty when the tarball is good
 */
export function tarballProblems({ files, manifest, pkg, packIds, expectPacks }) {
  const have = new Set(files);
  const problems = [];
  const need = (/** @type {string} */ f) => {
    if (!have.has(f)) problems.push(`missing ${f}`);
  };

  if (files.length < 50) problems.push(`only ${files.length} files: not a built package`);
  for (const f of ['package.json', 'README.md', 'LICENSE', 'dist/manifest.json', 'dist/shared/index.js', 'dist/shared/index.d.ts']) need(f);
  for (const f of files) {
    const bad = FORBIDDEN.find((p) => f.startsWith(p));
    if (bad !== undefined) problems.push(`ships ${f} (nothing under ${bad} belongs in the tarball)`);
  }

  const built = manifest.packs.map((p) => p.id);
  const wanted = expectPacks ?? packIds;
  if (built.join(',') !== wanted.join(',')) problems.push(`built packs are [${built.join(', ')}], expected [${wanted.join(', ')}]`);
  if (manifest.flavours.length !== Object.keys(FLAVOUR_DIRS).length) problems.push(`built flavours are [${manifest.flavours.join(', ')}], expected all nine`);

  for (const id of packIds) {
    need(`dist/data/${id}.js`);
    for (const [flavour, dir] of Object.entries(FLAVOUR_DIRS)) {
      need(flavour === 'svelte' ? `dist/svelte/packs/${id}/index.js` : `dist/${dir}/packs/${id}.js`);
      need(`dist/${dir}/index.js`);
    }
  }
  for (const pack of manifest.packs) {
    for (const f of pack.attribution) need(`dist/${f}`);
    const svelte = files.filter((f) => f.startsWith(`dist/svelte/packs/${pack.id}/Icon`) && f.endsWith('.svelte')).length;
    if (svelte !== pack.outputs.svelte) problems.push(`${pack.id}: ${svelte} Svelte components, manifest says ${pack.outputs.svelte}`);
  }

  for (const key of ['dependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
    if (pkg[key] !== undefined && Object.keys(pkg[key]).length > 0) problems.push(`package.json declares ${key}; the tarball must install with nothing but the framework peers`);
  }
  for (const peer of Object.keys(pkg.peerDependencies ?? {})) {
    if (pkg.peerDependenciesMeta?.[peer]?.optional !== true) problems.push(`peer ${peer} is not optional`);
  }
  return problems;
}

/** @param {string} tgz */
export function readTarball(tgz) {
  const files = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter((f) => f !== '' && !f.endsWith('/'))
    .map((f) => f.replace(/^package\//, ''));
  const read = (/** @type {string} */ f) => JSON.parse(execFileSync('tar', ['-xzOf', tgz, `package/${f}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  return { files, manifest: /** @type {Manifest} */ (read('dist/manifest.json')), pkg: read('package.json') };
}

function main() {
  const [tgz, flag, value] = process.argv.slice(2);
  if (tgz === undefined) throw new Error('usage: check-tarball.mjs <file.tgz> [--packs a,b]');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const packIds = JSON.parse(readFileSync(join(root, 'packs.json'), 'utf8')).packs.map((/** @type {{ id: string }} */ p) => p.id);
  const problems = tarballProblems({ ...readTarball(tgz), packIds, ...(flag === '--packs' && value !== undefined ? { expectPacks: value.split(',') } : {}) });
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${tgz}: ${p}`);
    process.exit(1);
  }
  console.log(`${tgz}: ok`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
