import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

/**
 * The install docs must never promise a tag or a release that does not exist. Every tag a
 * reader is told to install (`#vX.Y.Z`, `/releases/download/vX.Y.Z/`, `/releases/tag/vX.Y.Z`) has
 * to be a tag in this repository. CI checks out with `fetch-tags: true` so a real tag is visible.
 *
 * `docs/release.md` is exempt: it documents how to cut a tag, so it names one before it exists.
 */
const EXEMPT = new Set(['docs/release.md']);
const TAG_REF = /(?:#|\/releases\/download\/|\/releases\/tag\/)(v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/g;

function docs(): string[] {
  const pages = readdirSync(join(ROOT, 'docs'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`);
  return ['README.md', ...pages].filter((f) => !EXEMPT.has(f));
}

const tags = new Set(execFileSync('git', ['tag', '-l'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));

describe('install docs', () => {
  const files = docs();

  it('reads the README and the docs pages', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)('%s names only tags that exist', (file) => {
    const named = [...readFileSync(join(ROOT, file), 'utf8').matchAll(TAG_REF)].map((m) => m[1] ?? '');
    expect(named.filter((tag) => !tags.has(tag))).toEqual([]);
  });

  it('the tag pattern finds a tag reference (positive control)', () => {
    expect([...'npm install "github:ichava/js-icon-components#v9.9.9"'.matchAll(TAG_REF)].map((m) => m[1])).toEqual(['v9.9.9']);
  });
});
