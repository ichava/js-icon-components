import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { consumerConfig, plan } from '../scripts/prepare.mjs';
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
