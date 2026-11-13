// @ts-check
/**
 * Packs the dist/ that is already built into a release tarball, under the package name its
 * contents call for. Used by release.yml and by the tests, so both pack the same way.
 *
 *   node scripts/pack-tarball.mjs <destination> [<pack>]
 *
 * With no pack, the tarball is the full package, `@ichava/js-icon-components`. With a pack, dist/
 * must have been built for that pack alone (`ICHAVA_ICONS_PACKS=<pack> npm run build`), and the
 * tarball is named `@ichava/js-icon-components-<pack>`, with the same subpath exports. Every
 * per-pack tarball used to share the full package's name, so an application could install only
 * one of them: npm keeps one package per name, and the second install replaced the first.
 *
 * package.json is renamed for the duration of `npm pack` and put back byte for byte afterwards,
 * whatever happens, so a checkout is never left carrying a per-pack name.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageName } from './check-tarball.mjs';

/**
 * @param {string} root  the package root holding package.json and dist/
 * @param {string} destination  directory the tarball is written to
 * @param {string} [pack]  the one pack dist/ was built for, or none for the full package
 * @returns {string} the tarball's path
 */
export function packTarball(root, destination, pack) {
  const file = join(root, 'package.json');
  const original = readFileSync(file);
  const pkg = JSON.parse(original.toString('utf8'));
  const name = packageName(pack === undefined ? undefined : [pack]);
  try {
    if (pkg.name !== name) writeFileSync(file, JSON.stringify({ ...pkg, name }, null, 2) + '\n');
    const out = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    const [packed] = /** @type {{ filename: string }[]} */ (JSON.parse(out));
    if (packed === undefined) throw new Error('npm pack wrote no tarball');
    return join(destination, packed.filename);
  } finally {
    writeFileSync(file, original);
  }
}

function main() {
  const [destination, pack] = process.argv.slice(2);
  if (destination === undefined) throw new Error('usage: pack-tarball.mjs <destination> [<pack>]');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(packTarball(root, resolve(destination), pack));
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
