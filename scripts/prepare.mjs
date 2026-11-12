// @ts-check
/**
 * `prepare`, which npm runs when this package is installed from git (and on `npm install` and
 * `npm pack` in a checkout). Plain JavaScript on purpose: it runs before anything is compiled.
 *
 * - `dist/` already built (its `manifest.json` exists): nothing to do. A release tarball, and a
 *   checkout that has built once, never rebuild here; `npm run build` is the explicit rebuild.
 * - `ICHAVA_ICONS_INSTALL=tarball`, or `"install": "tarball"`: refuse a git install and name the
 *   release tarball to install instead. `build` (or unset) is the git build below.
 * - `ICHAVA_ICONS_SKIP_BUILD=1`, or `"skipBuild": true`: build nothing.
 * - Otherwise `npm run build`, for the packs and flavours chosen by `ICHAVA_ICONS_PACKS` and
 *   `ICHAVA_ICONS_FLAVOURS` (comma-separated; unset means all). Each falls back to the same key
 *   under `"ichava": { "icons": { … } }` in the installing application's package.json, which npm
 *   names in `INIT_CWD`. A variable that is set wins over the file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENV = {
  packs: 'ICHAVA_ICONS_PACKS',
  flavours: 'ICHAVA_ICONS_FLAVOURS',
  skip: 'ICHAVA_ICONS_SKIP_BUILD',
  install: 'ICHAVA_ICONS_INSTALL',
};

/** The install paths `"ichava.icons.install"` accepts. */
export const INSTALL_MODES = ['tarball', 'build'];

/**
 * The release tarball URL for a version: what a `tarball` refusal tells the reader to install.
 *
 * @param {string} version
 */
export const tarballUrl = (version) =>
  `https://github.com/ichava/js-icon-components/releases/download/v${version}/ichava-js-icon-components-${version}.tgz`;

/**
 * The `"ichava.icons"` block of the installing application's package.json, or `{}`. The package's
 * own package.json is never read as the consumer's.
 *
 * @param {string | undefined} initCwd
 * @param {string} root
 * @returns {Record<string, unknown>}
 */
export function consumerConfig(initCwd, root) {
  if (initCwd === undefined || initCwd === '' || resolve(initCwd) === resolve(root)) return {};
  const file = join(initCwd, 'package.json');
  if (!existsSync(file)) return {};
  const icons = JSON.parse(readFileSync(file, 'utf8'))?.ichava?.icons;
  if (icons === undefined) return {};
  if (typeof icons !== 'object' || icons === null || Array.isArray(icons)) throw new Error(`${file}: "ichava.icons" must be an object`);
  return icons;
}

/**
 * @param {unknown} value  a list from package.json: an array of names or a comma-separated string
 * @param {string} key
 * @returns {string | undefined}
 */
function joined(value, key) {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value.join(',');
  throw new Error(`"ichava.icons.${key}" must be an array of names or a comma-separated string`);
}

/** @param {string | undefined} value */
const truthy = (value) => value !== undefined && /^(1|true|yes)$/i.test(value.trim());

/**
 * What `prepare` does, as data, so it is testable without running a build.
 *
 * @param {{ env: Record<string, string | undefined>, consumer: Record<string, unknown>, built: boolean, version?: string }} input
 * @returns {{ action: 'built' } | { action: 'refuse', reason: string } | { action: 'skip', reason: string } | { action: 'build', env: Record<string, string> }}
 */
export function plan({ env, consumer, built, version = '0.0.0' }) {
  if (built) return { action: 'built' };

  const fromEnv = env[ENV.install] !== undefined && env[ENV.install] !== '';
  const install = fromEnv ? env[ENV.install] : consumer.install;
  if (install !== undefined && (typeof install !== 'string' || !INSTALL_MODES.includes(install))) {
    const where = fromEnv ? ENV.install : '"ichava.icons.install"';
    throw new Error(`${where} must be one of ${INSTALL_MODES.join(', ')}, got ${JSON.stringify(install)}`);
  }
  if (install === 'tarball') {
    const where = fromEnv ? `${ENV.install}=tarball` : '"ichava.icons.install": "tarball"';
    return {
      action: 'refuse',
      reason: `${where} asks for the prebuilt release tarball, but this is a git install. Install it with:\n  npm install ${tarballUrl(version)}`,
    };
  }
  const skip = env[ENV.skip] !== undefined ? truthy(env[ENV.skip]) : consumer.skipBuild === true;
  if (skip) return { action: 'skip', reason: env[ENV.skip] !== undefined ? `${ENV.skip}=${env[ENV.skip]}` : '"ichava.icons.skipBuild": true' };

  /** @type {Record<string, string>} */
  const out = {};
  const packs = env[ENV.packs] ?? joined(consumer.packs, 'packs');
  const flavours = env[ENV.flavours] ?? joined(consumer.flavours, 'flavours');
  if (packs !== undefined) out[ENV.packs] = packs;
  if (flavours !== undefined) out[ENV.flavours] = flavours;
  return { action: 'build', env: out };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const step = plan({ env: process.env, consumer: consumerConfig(process.env.INIT_CWD, root), built: existsSync(join(root, 'dist', 'manifest.json')), version });

  if (step.action === 'built') {
    console.log('@ichava/js-icon-components: dist/ is already built; `npm run build` rebuilds it.');
    return;
  }
  if (step.action === 'refuse') {
    console.error(`@ichava/js-icon-components: ${step.reason}`);
    process.exit(1);
  }
  if (step.action === 'skip') {
    console.log(`@ichava/js-icon-components: not building (${step.reason}). No icon module is importable from this install.`);
    return;
  }
  const chosen = Object.entries(step.env).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`@ichava/js-icon-components: building dist/${chosen === '' ? ' (every pack and flavour)' : ` for ${chosen}`}`);
  const result = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, ...step.env }, shell: process.platform === 'win32' });
  process.exit(result.status ?? 1);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
