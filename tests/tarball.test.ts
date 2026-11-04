import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readTarball, tarballProblems } from '../scripts/check-tarball.mjs';
import type { Manifest } from '../src/generator/generate.ts';
import { packs, ROOT } from './helpers.ts';

/**
 * The release tarball, packed from this checkout's dist/ exactly as release.yml packs it, then
 * installed into a scratch application from the local file, offline. The application has the
 * framework runtimes it imports and nothing else: no TypeScript, esbuild, ngc or Astro compiler.
 */
const IDS = packs().map((p) => p.id);
const work = mkdtempSync(join(tmpdir(), 'ichava-tarball-'));
let tgz: string;

beforeAll(() => {
  const built = existsSync(join(ROOT, 'dist/manifest.json')) ? (JSON.parse(readFileSync(join(ROOT, 'dist/manifest.json'), 'utf8')) as Manifest) : undefined;
  if (built === undefined || built.packs.length !== IDS.length || built.flavours.length !== 9) {
    throw new Error('dist/ is missing or was built selectively; run `npm run build` first');
  }
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', work], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 })) as { filename: string }[];
  tgz = join(work, packed?.filename as string);
}, 300_000);

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('the release tarball', () => {
  it('is named as the release download URL expects', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    expect(tgz.endsWith(`/ichava-js-icon-components-${version}.tgz`)).toBe(true);
  });

  it('holds dist/ for every pack and flavour, and nothing from the development tree', () => {
    const contents = readTarball(tgz);
    expect(contents.files.length).toBeGreaterThan(17_000);
    expect(tarballProblems({ ...contents, packIds: IDS })).toEqual([]);
  });

  it('the checker refuses source, tests, a missing module and a required dependency', () => {
    const contents = readTarball(tgz);
    const files = [...contents.files.filter((f) => f !== 'dist/vue/packs/tabler.js'), 'src/react/index.tsx', 'tests/react.test.ts'];
    const pkg = { ...contents.pkg, dependencies: { esbuild: '^0.28.0' } };
    expect(tarballProblems({ ...contents, files, pkg, packIds: IDS })).toEqual([
      'ships src/react/index.tsx (nothing under src/ belongs in the tarball)',
      'ships tests/react.test.ts (nothing under tests/ belongs in the tarball)',
      'missing dist/vue/packs/tabler.js',
      'package.json declares dependencies; the tarball must install with nothing but the framework peers',
    ]);
  });

  it('installs offline and imports one icon in every flavour, with no compiler present', () => {
    const app = join(work, 'app');
    mkdirSync(app);
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', private: true, type: 'module' }));
    execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', tgz], { cwd: app, stdio: 'ignore' });

    const modules = join(app, 'node_modules');
    const installed = join(modules, '@ichava/js-icon-components');
    expect(existsSync(join(installed, 'dist/manifest.json'))).toBe(true);
    expect(existsSync(join(installed, 'src'))).toBe(false);
    // Nothing but the package itself was installed: no development dependency came with it.
    expect(readdirSync(modules).filter((f) => !f.startsWith('.'))).toEqual(['@ichava']);

    // The runtimes the application would have as peers. react-native-svg needs a React Native
    // runtime, so a three-line stand-in takes its place.
    for (const peer of ['react', 'react-dom', 'vue', 'preact', 'preact-render-to-string', 'solid-js']) symlinkSync(join(ROOT, 'node_modules', peer), join(modules, peer));
    mkdirSync(join(modules, 'react-native-svg'));
    writeFileSync(join(modules, 'react-native-svg/package.json'), JSON.stringify({ name: 'react-native-svg', type: 'module', exports: './index.js' }));
    // The stand-in exports exactly the element names the shipped module imports.
    const imported = /import Svg, \{([^}]+)\} from 'react-native-svg'/.exec(readFileSync(join(installed, 'dist/react-native/index.js'), 'utf8'))?.[1] ?? '';
    const elements = imported.split(',').map((n) => n.trim().split(/\s+as\s+/)[0] as string).filter(Boolean);
    expect(elements.length).toBeGreaterThan(20);
    writeFileSync(
      join(modules, 'react-native-svg/index.js'),
      "const el = (n) => { const c = () => null; c.displayName = n; return c; };\nexport default el('Svg');\n" + elements.map((n) => `export const ${n} = el('${n}');`).join('\n') + '\n',
    );

    const probe = `
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { h } from 'vue';
      import { renderToString } from 'vue/server-renderer';
      import { h as ph } from 'preact';
      import { render as prender } from 'preact-render-to-string';
      import { rootAttributes } from '@ichava/js-icon-components';
      import { IconMug as data } from '@ichava/js-icon-components/data/tabler';
      import { IconMug as React } from '@ichava/js-icon-components/react/tabler';
      import { IconMug as Vue } from '@ichava/js-icon-components/vue/tabler';
      import { IconMug as Wc } from '@ichava/js-icon-components/wc/tabler';
      import { IconMug as Native } from '@ichava/js-icon-components/react-native/tabler';
      import { IconMug as Angular } from '@ichava/js-icon-components/angular/tabler';
      import { IconMug as Solid } from '@ichava/js-icon-components/solid/tabler';
      import { IconMug as Preact } from '@ichava/js-icon-components/preact/tabler';
      import { IconMug as Astro } from '@ichava/js-icon-components/astro/tabler';
      import { IconKe } from '@ichava/js-icon-components/react/flag';
      import { IconGrinningFace } from '@ichava/js-icon-components/react/emoji';
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const out = {
        shared: rootAttributes(data, { size: 20 }).width,
        react: renderToStaticMarkup(createElement(React, { size: 20 })).slice(0, 4),
        vue: (await renderToString(h(Vue, { size: 20 }))).slice(0, 4),
        preact: prender(ph(Preact, { size: 20 })).slice(0, 4),
        wc: Wc.id, angular: Angular.id, astro: Astro.id,
        native: typeof Native, solid: typeof Solid,
        flag: renderToStaticMarkup(createElement(IconKe)).slice(0, 4),
        emoji: renderToStaticMarkup(createElement(IconGrinningFace)).slice(0, 4),
        // Svelte ships .svelte source, compiled by the application's own Svelte.
        svelte: existsSync(fileURLToPath(import.meta.resolve('@ichava/js-icon-components/svelte/tabler')))
          && existsSync(fileURLToPath(import.meta.resolve('@ichava/js-icon-components/svelte/tabler/IconMug.svelte'))),
      };
      for (const tool of ['typescript', 'esbuild', '@angular/compiler-cli', '@astrojs/compiler-rs', 'svelte']) {
        try { import.meta.resolve(tool); out[tool] = 'present'; } catch { /* absent, as it must be */ }
      }
      console.log(JSON.stringify(out));
    `;
    writeFileSync(join(app, 'probe.mjs'), probe);
    const r = spawnSync(process.execPath, ['--conditions=svelte', 'probe.mjs'], { cwd: app, encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(JSON.parse(r.stdout)).toEqual({
      shared: '20',
      react: '<svg',
      vue: '<svg',
      preact: '<svg',
      wc: 'tabler:outline/mug',
      angular: 'tabler:outline/mug',
      astro: 'tabler:outline/mug',
      native: 'object',
      solid: 'function',
      flag: '<svg',
      emoji: '<svg',
      svelte: true,
    });
  });
});
