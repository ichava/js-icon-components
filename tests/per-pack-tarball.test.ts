import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { packageName, readTarball, tarballProblems } from '../scripts/check-tarball.mjs';
import { packTarball } from '../scripts/pack-tarball.mjs';
import { generate, parseSelection } from '../src/generator/generate.ts';
import { packs, ROOT } from './helpers.ts';

/**
 * Per-pack tarballs, built and packed as release.yml builds and packs them, then two of them
 * installed side by side into one application and imported from together. Until each carried its
 * own package name, the second install replaced the first: npm keeps one package per name.
 */
const IDS = packs().map((p) => p.id);
const PAIR = ['flag', 'emoji'] as const;
const work = mkdtempSync(join(tmpdir(), 'ichava-per-pack-'));
const tarballs: Record<string, string> = {};

/** A package root holding what `npm pack` reads: package.json, README, LICENSE and dist/. */
function stage(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const f of ['package.json', 'README.md', 'LICENSE']) cpSync(join(ROOT, f), join(dir, f));
}

beforeAll(() => {
  // The runtimes, compiled once and copied, as each release build compiles the same sources.
  const runtimes = join(work, 'runtimes');
  execFileSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', join(ROOT, 'tsconfig.build.json'), '--outDir', runtimes], { cwd: ROOT, stdio: 'ignore' });
  execFileSync(join(ROOT, 'node_modules/.bin/ngc'), ['-p', join(ROOT, 'tsconfig.angular.json'), '--outDir', runtimes], { cwd: ROOT, stdio: 'ignore' });
  for (const id of PAIR) {
    const dir = join(work, `stage-${id}`);
    stage(dir);
    cpSync(runtimes, join(dir, 'dist'), { recursive: true });
    generate({ root: ROOT, outDir: join(dir, 'dist'), selection: parseSelection({ packs: id }, IDS) });
    tarballs[id] = packTarball(dir, work, id);
  }
}, 600_000);

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('per-pack tarballs', () => {
  it('each carries its own package name and file name, and passes the checker', () => {
    for (const id of PAIR) {
      expect(tarballs[id]?.endsWith(`/ichava-js-icon-components-${id}-0.1.0.tgz`)).toBe(true);
      const contents = readTarball(tarballs[id] as string);
      expect(contents.pkg.name).toBe(`@ichava/js-icon-components-${id}`);
      expect(tarballProblems({ ...contents, packIds: IDS, expectPacks: [id] })).toEqual([]);
    }
    // packTarball renamed package.json only while packing: the staged copy is back to the full name.
    expect(packageName(undefined)).toBe('@ichava/js-icon-components');
  });

  it('the checker refuses a per-pack tarball that kept the shared name', () => {
    const contents = readTarball(tarballs.flag as string);
    const shared = { ...contents, pkg: { ...contents.pkg, name: '@ichava/js-icon-components' } };
    expect(tarballProblems({ ...shared, packIds: IDS, expectPacks: ['flag'] })).toEqual([
      'package.json name is @ichava/js-icon-components, expected @ichava/js-icon-components-flag',
    ]);
  });

  it('two install side by side and an application imports from both', () => {
    const app = join(work, 'app');
    mkdirSync(app);
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', private: true, type: 'module' }));
    execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', tarballs.flag as string, tarballs.emoji as string], { cwd: app, stdio: 'ignore' });

    const modules = join(app, 'node_modules');
    expect(readdirSync(join(modules, '@ichava')).sort()).toEqual(['js-icon-components-emoji', 'js-icon-components-flag']);
    for (const peer of ['react', 'react-dom']) symlinkSync(join(ROOT, 'node_modules', peer), join(modules, peer));

    writeFileSync(
      join(app, 'probe.mjs'),
      `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { IconKe } from '@ichava/js-icon-components-flag/react/flag';
        import { IconGrinningFace } from '@ichava/js-icon-components-emoji/react/emoji';
        import { IconKe as KeData } from '@ichava/js-icon-components-flag/data/flag';
        import { existsSync } from 'node:fs';
        import { fileURLToPath } from 'node:url';
        const asset = (spec) => existsSync(fileURLToPath(import.meta.resolve(spec)));
        console.log(JSON.stringify({
          flag: renderToStaticMarkup(createElement(IconKe)).slice(0, 4),
          emoji: renderToStaticMarkup(createElement(IconGrinningFace)).slice(0, 4),
          data: KeData.id,
          flagCss: asset('@ichava/js-icon-components-flag/assets/flag/icons.css'),
          emojiDataUri: asset('@ichava/js-icon-components-emoji/assets/emoji/data-uri.json'),
          elm: asset('@ichava/js-icon-components-flag/elm/Ichava/Icons/Flag.elm'),
        }));
      `,
    );
    const r = spawnSync(process.execPath, ['probe.mjs'], { cwd: app, encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(JSON.parse(r.stdout)).toEqual({ flag: '<svg', emoji: '<svg', data: 'flag:4x3/ke', flagCss: true, emojiDataUri: true, elm: true });
  });

  it('with one shared name, as before, the second install replaced the first', () => {
    const app = join(work, 'app-shared');
    mkdirSync(app);
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app-shared', private: true, type: 'module' }));
    const renamed: string[] = [];
    for (const id of PAIR) {
      const dir = join(work, `shared-${id}`);
      cpSync(join(work, `stage-${id}`), dir, { recursive: true });
      // Packing with no pack named keeps the full package's name: the old per-pack tarball.
      const out = join(work, `out-${id}`);
      mkdirSync(out);
      renamed.push(packTarball(dir, out));
    }
    for (const tgz of renamed) execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', tgz], { cwd: app, stdio: 'ignore' });
    const installed = join(app, 'node_modules/@ichava/js-icon-components');
    expect(readdirSync(join(app, 'node_modules/@ichava'))).toEqual(['js-icon-components']);
    expect(existsSync(join(installed, 'dist/assets/emoji'))).toBe(true);
    expect(existsSync(join(installed, 'dist/assets/flag'))).toBe(false);
  });
});
