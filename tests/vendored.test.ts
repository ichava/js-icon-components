import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers.ts';

/**
 * Two files are copies of another repository's canonical file. Each is pinned by digest, so an
 * edit here fails, and compared with the sibling checkout when one is on disk, so a stale copy
 * fails locally the moment the canonical file moves. Update the copy and the digest together.
 */
const COPIES = [
  {
    file: 'vendor/svg-policy.json',
    sha256: '950214c5828531987ecfa72f1055ab3491c3c664336eaca657cc04907400d390',
    canonical: '../core/resources/security/svg-policy.json',
  },
  {
    file: 'vendor/icon-browser.schema.json',
    sha256: '205a5dd111759ba462202577e022fbde7a2ca9a4f8217ad1cbde56f7e3d2d4fe',
    canonical: '../icon-browser/resources/schema/icon-browser.schema.json',
  },
];

describe('vendored copies', () => {
  it.each(COPIES)('$file matches its pinned digest', ({ file, sha256 }) => {
    expect(createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex')).toBe(sha256);
  });

  it.each(COPIES)('$file matches the sibling checkout when present', ({ file, canonical }) => {
    const sibling = join(ROOT, canonical);
    if (!existsSync(sibling)) return; // CI has no siblings; the digest pin above still holds.
    expect(readFileSync(join(ROOT, file), 'utf8')).toBe(readFileSync(sibling, 'utf8'));
  });
});
