import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { consumerConfig, INSTALL_MODES, plan, tarballUrl } from '../scripts/prepare.mjs';
import { ROOT } from './helpers.ts';

const app = mkdtempSync(join(tmpdir(), 'ichava-prepare-'));
afterAll(() => rmSync(app, { recursive: true, force: true }));

const consumer = (icons: unknown): Record<string, unknown> => {
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', ichava: { icons } }));
  return consumerConfig(app, ROOT);
};

describe('prepare', () => {
  it('builds everything when nothing is chosen', () => {
    expect(plan({ env: {}, consumer: {}, built: false })).toEqual({ action: 'build', env: {} });
  });

  it('never rebuilds a dist/ that is already built', () => {
    expect(plan({ env: { ICHAVA_ICONS_PACKS: 'tabler' }, consumer: { packs: ['flag'] }, built: true })).toEqual({ action: 'built' });
  });

  it('reads packs and flavours from the variables', () => {
    expect(plan({ env: { ICHAVA_ICONS_PACKS: 'tabler,flag', ICHAVA_ICONS_FLAVOURS: 'react,vue' }, consumer: {}, built: false })).toEqual({
      action: 'build',
      env: { ICHAVA_ICONS_PACKS: 'tabler,flag', ICHAVA_ICONS_FLAVOURS: 'react,vue' },
    });
  });

  it('falls back to "ichava.icons" in the application package.json, as a list or a string', () => {
    expect(plan({ env: {}, consumer: consumer({ packs: ['tabler'], flavours: 'react' }), built: false })).toEqual({
      action: 'build',
      env: { ICHAVA_ICONS_PACKS: 'tabler', ICHAVA_ICONS_FLAVOURS: 'react' },
    });
  });

  it('a variable that is set wins over the file, key by key', () => {
    expect(plan({ env: { ICHAVA_ICONS_PACKS: 'flag' }, consumer: consumer({ packs: ['tabler'], flavours: ['vue'] }), built: false })).toEqual({
      action: 'build',
      env: { ICHAVA_ICONS_PACKS: 'flag', ICHAVA_ICONS_FLAVOURS: 'vue' },
    });
    expect(plan({ env: { ICHAVA_ICONS_SKIP_BUILD: '0' }, consumer: { skipBuild: true }, built: false }).action).toBe('build');
  });

  it('skips the build on ICHAVA_ICONS_SKIP_BUILD=1 or "skipBuild": true', () => {
    expect(plan({ env: { ICHAVA_ICONS_SKIP_BUILD: '1' }, consumer: {}, built: false })).toEqual({ action: 'skip', reason: 'ICHAVA_ICONS_SKIP_BUILD=1' });
    expect(plan({ env: {}, consumer: consumer({ skipBuild: true }), built: false })).toEqual({ action: 'skip', reason: '"ichava.icons.skipBuild": true' });
  });

  it('"install": "build", or no install key, is the git build', () => {
    expect(plan({ env: {}, consumer: consumer({ install: 'build', packs: ['flag'] }), built: false })).toEqual({ action: 'build', env: { ICHAVA_ICONS_PACKS: 'flag' } });
    expect(plan({ env: { ICHAVA_ICONS_INSTALL: 'build' }, consumer: { install: 'tarball' }, built: false }).action).toBe('build');
  });

  it('"install": "tarball" refuses a git install and names the release tarball for this version', () => {
    const step = plan({ env: {}, consumer: consumer({ install: 'tarball' }), built: false, version: '0.1.0' });
    expect(step.action).toBe('refuse');
    expect(step).toHaveProperty('reason', expect.stringContaining('"ichava.icons.install": "tarball"'));
    expect(step).toHaveProperty('reason', expect.stringContaining(`npm install ${tarballUrl('0.1.0')}`));
    expect(tarballUrl('0.1.0')).toBe('https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-0.1.0.tgz');
    expect(plan({ env: { ICHAVA_ICONS_INSTALL: 'tarball' }, consumer: {}, built: false }).action).toBe('refuse');
  });

  it('a tarball choice never blocks a dist/ that is already built, which is what a tarball install is', () => {
    expect(plan({ env: { ICHAVA_ICONS_INSTALL: 'tarball' }, consumer: { install: 'tarball' }, built: true })).toEqual({ action: 'built' });
  });

  it('refuses an unknown install value, listing the allowed ones', () => {
    expect(() => plan({ env: {}, consumer: { install: 'zip' }, built: false })).toThrow(`"ichava.icons.install" must be one of ${INSTALL_MODES.join(', ')}, got "zip"`);
    expect(() => plan({ env: {}, consumer: { install: true }, built: false })).toThrow(/must be one of tarball, build, got true/);
    expect(() => plan({ env: { ICHAVA_ICONS_INSTALL: 'Tarball' }, consumer: {}, built: false })).toThrow(/ICHAVA_ICONS_INSTALL must be one of tarball, build, got "Tarball"/);
  });

  it('never reads its own package.json as the consumer, and refuses a malformed block', () => {
    expect(consumerConfig(ROOT, ROOT)).toEqual({});
    expect(consumerConfig(undefined, ROOT)).toEqual({});
    expect(() => consumer('tabler')).toThrow(/"ichava.icons" must be an object/);
    expect(() => plan({ env: {}, consumer: { packs: [1] }, built: false })).toThrow(/must be an array of names or a comma-separated string/);
  });

  it('is what package.json runs, and leaves a built dist/ alone', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.prepare).toBe('node scripts/prepare.mjs');
    const before = readFileSync(join(ROOT, 'dist/manifest.json'), 'utf8');
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/prepare.mjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ICHAVA_ICONS_PACKS: 'flag' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('dist/ is already built');
    expect(readFileSync(join(ROOT, 'dist/manifest.json'), 'utf8')).toBe(before);
  });
});
