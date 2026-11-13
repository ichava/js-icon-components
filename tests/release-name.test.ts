import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { releaseNameProblems } from '../scripts/check-release-name.mjs';
import { tarballUrl } from '../scripts/prepare.mjs';
import { ROOT } from './helpers.ts';

/**
 * The release attaches the full tarball under the name `tarballUrl()` gives, so the command a
 * `"install": "tarball"` refusal prints, and the documented install line, never drift from what
 * release.yml uploads. release.yml runs scripts/check-release-name.mjs after packing.
 */
const work = mkdtempSync(join(tmpdir(), 'ichava-release-name-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const SUMS = (name: string) => `${'0'.repeat(64)}  ${name}\n`;

type Step = { name?: string; run?: string };
const workflow = parse(readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf8')) as {
  on: { push: { tags: string[] } };
  jobs: { release: { steps: Step[] } };
};
const steps = workflow.jobs.release.steps;

describe('the release tarball name', () => {
  it('matches tarballUrl() for a final tag', () => {
    const name = 'ichava-js-icon-components-0.2.0.tgz';
    expect(tarballUrl('0.2.0')).toBe(`https://github.com/ichava/js-icon-components/releases/download/v0.2.0/${name}`);
    expect(releaseNameProblems({ tag: 'v0.2.0', files: [name, 'SHA256SUMS'], sums: SUMS(name) })).toEqual([]);
  });

  it('matches tarballUrl() for a pre-release tag, which packs with its own version', () => {
    const name = 'ichava-js-icon-components-0.2.0-rc.1.tgz';
    expect(releaseNameProblems({ tag: 'v0.2.0-rc.1', files: [name], sums: SUMS(name) })).toEqual([]);
  });

  it('refuses a release whose tarball is named differently, or that SHA256SUMS does not list', () => {
    expect(releaseNameProblems({ tag: 'v0.2.0', files: ['js-icon-components-0.2.0.tgz'], sums: SUMS('js-icon-components-0.2.0.tgz') })).toEqual([
      'the release has no ichava-js-icon-components-0.2.0.tgz, the name tarballUrl() gives (it has js-icon-components-0.2.0.tgz)',
      'SHA256SUMS does not list ichava-js-icon-components-0.2.0.tgz',
    ]);
    expect(releaseNameProblems({ tag: 'v0.2.0', files: [] })).toEqual(['the release has no ichava-js-icon-components-0.2.0.tgz, the name tarballUrl() gives (it has no tarball)']);
    expect(releaseNameProblems({ tag: '0.2.0', files: [] })).toEqual(["'0.2.0' is not a vX.Y.Z or vX.Y.Z-rc.N release tag"]);
  });

  it('the script exits non-zero on a drifted name and zero on the right one', () => {
    const good = 'ichava-js-icon-components-0.2.0.tgz';
    writeFileSync(join(work, 'js-icon-components-0.2.0.tgz'), '');
    writeFileSync(join(work, 'SHA256SUMS'), SUMS('js-icon-components-0.2.0.tgz'));
    const run = () => spawnSync('node', [join(ROOT, 'scripts/check-release-name.mjs'), work, 'v0.2.0'], { encoding: 'utf8' });
    const red = run();
    expect(red.status).toBe(1);
    expect(red.stderr).toContain(`the release has no ${good}`);

    writeFileSync(join(work, good), '');
    writeFileSync(join(work, 'SHA256SUMS'), SUMS(good));
    expect(run().status).toBe(0);
  });
});

describe('release.yml', () => {
  it('runs on final and pre-release tags', () => {
    expect(workflow.on.push.tags).toEqual(['v*.*.*', 'v*.*.*-*']);
  });

  it('checks the tarball name against tarballUrl() after packing and before publishing', () => {
    const at = (match: (s: Step) => boolean) => steps.findIndex(match);
    const pack = at((s) => s.run?.includes('scripts/pack-tarball.mjs') === true);
    const check = at((s) => s.run?.trim() === 'node scripts/check-release-name.mjs release "$TAG"');
    const publish = at((s) => s.name === 'Publish');
    expect(pack).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(pack);
    expect(publish).toBeGreaterThan(check);
  });
});
