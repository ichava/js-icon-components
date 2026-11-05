import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

/**
 * Every file in vendor/ is a copy of another repository's canonical file, recorded in
 * vendor/source.json with its repository, path, commit and SHA-256. Never a path into a
 * sibling checkout at build time: that exists on one machine only.
 *
 * Each copy is pinned by digest, so an edit here fails everywhere, CI included. When the source
 * repository is checked out beside this one (or under ICHAVA_PACKAGES_DIR), the copy is also
 * compared with its canonical file and fails on drift; without that checkout the comparison is
 * skipped, not passed.
 */
interface Source {
  repository: string;
  path: string;
  commit: string;
  sha256: string;
}
const { files } = JSON.parse(readFileSync(join(ROOT, 'vendor/source.json'), 'utf8')) as { files: Record<string, Source> };
const COPIES = Object.entries(files).map(([file, src]) => ({ file, ...src }));
const PACKAGES = resolve(process.env.ICHAVA_PACKAGES_DIR || join(ROOT, '..'));

/** The canonical file in the sibling checkout, or null when that checkout is not on disk. */
function sibling(repository: string, path: string): string | null {
  const checkout = join(PACKAGES, repository.replace(/^ichava\//, ''));
  return existsSync(join(checkout, '.git')) ? join(checkout, path) : null;
}

describe('vendored copies', () => {
  it('records every file in vendor/, and nothing else', () => {
    const onDisk = readdirSync(join(ROOT, 'vendor')).filter((f) => f !== 'source.json').sort();
    expect(onDisk.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(files).sort()).toEqual(onDisk);
  });

  it.each(COPIES)('$file names its source: repository, path and a full commit', ({ repository, path, commit }) => {
    expect(repository).toMatch(/^ichava\/[a-z0-9.-]+$/);
    expect(path).not.toMatch(/^\.|\.\./);
    expect(commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it.each(COPIES)('$file matches its pinned digest', ({ file, sha256 }) => {
    expect(createHash('sha256').update(readFileSync(join(ROOT, 'vendor', file))).digest('hex')).toBe(sha256);
  });

  for (const { file, repository, path } of COPIES) {
    const canonical = sibling(repository, path);
    it.skipIf(canonical === null)(`${file} matches ${repository}'s ${path} in the sibling checkout`, () => {
      expect(readFileSync(join(ROOT, 'vendor', file), 'utf8')).toBe(readFileSync(canonical!, 'utf8'));
    });
  }
});
