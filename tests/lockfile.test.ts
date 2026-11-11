import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

/** A library tracks no lock file: consumers resolve their own tree, and CI resolves fresh. */
const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;

describe('no lock file is tracked', () => {
  const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '--cached'], { encoding: 'utf8' }).split('\n').filter(Boolean);

  it('read the index (not an empty listing)', () => {
    expect(tracked.length).toBeGreaterThanOrEqual(30);
  });

  it('tracks none', () => {
    expect(tracked.filter((f) => LOCKFILES.test(f))).toEqual([]);
  });

  it('ignores package-lock.json', () => {
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8')).toMatch(/^package-lock\.json$/m);
  });
});
