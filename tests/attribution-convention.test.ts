import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveAttribution, type PackConfig } from '../src/generator/packs.ts';
import { CACHE } from './helpers.ts';

/**
 * A pack's attribution files are found by convention: its `ATTRIBUTION.md` and every file under
 * `resources/assets/svg/licenses/`. packs.json used to name each file, and a pack renaming its
 * licence (icon-sets-openmoji#8, LICENSE -> LICENSE.txt) broke the next pin bump. Here a throwaway
 * pack repository renames its licence between two commits, and both commits must still ship it.
 */

let repo: string;
let before: string;
let after: string;

const git = (...args: string[]): string =>
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();

const write = (rel: string, body: string): void => {
  mkdirSync(join(repo, rel, '..'), { recursive: true });
  writeFileSync(join(repo, rel), body);
};

beforeAll(() => {
  mkdirSync(CACHE, { recursive: true });
  repo = mkdtempSync(join(CACHE, 'attribution-'));
  git('init', '--quiet');
  write('resources/assets/svg/files/s/a.svg', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  write('ATTRIBUTION.md', '# Attribution\n');
  write('resources/assets/svg/licenses/art/LICENSE', 'Attribution-ShareAlike 4.0 International\n');
  git('add', '-A');
  git('commit', '--quiet', '--no-verify', '-m', 'one');
  before = git('rev-parse', 'HEAD');
  git('mv', 'resources/assets/svg/licenses/art/LICENSE', 'resources/assets/svg/licenses/art/LICENSE.txt');
  git('commit', '--quiet', '--no-verify', '-m', 'rename');
  after = git('rev-parse', 'HEAD');
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

const packAt = (ref: string, attribution?: string[]): PackConfig =>
  ({
    id: 'art', repository: 'https://github.com/ichava/icon-sets-art.git', ref, checkout: repo, path: 'resources/assets/svg/files',
    sets: ['s'], defaultSet: 's', kind: 'icon', minIcons: 1, licence: 'CC-BY-SA-4.0',
    ...(attribution === undefined ? {} : { attribution }),
  }) as PackConfig;

describe('attribution by convention', () => {
  it('ships a renamed licence file with no change to the pack entry', () => {
    expect(resolveAttribution(packAt(before), repo)).toEqual(['ATTRIBUTION.md', 'resources/assets/svg/licenses/art/LICENSE']);
    expect(resolveAttribution(packAt(after), repo)).toEqual(['ATTRIBUTION.md', 'resources/assets/svg/licenses/art/LICENSE.txt']);
  });

  it('keeps an explicit override, and fails when an entry matches no file', () => {
    expect(resolveAttribution(packAt(after, ['ATTRIBUTION.md']), repo)).toEqual(['ATTRIBUTION.md']);
    expect(() => resolveAttribution(packAt(after, ['ATTRIBUTION.md', 'resources/assets/svg/licenses/art/LICENSE']), repo)).toThrow(
      /attribution entry resources\/assets\/svg\/licenses\/art\/LICENSE matches no file/,
    );
  });
});
