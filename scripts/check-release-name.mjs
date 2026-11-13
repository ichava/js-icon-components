// @ts-check
/**
 * Checks that a release attaches the full tarball under the exact name and tag `prepare` points a
 * reader to. `tarballUrl()` in prepare.mjs is what a `"install": "tarball"` refusal prints, and
 * the docs install from the same URL, so a release whose tarball is named any other way breaks
 * that command for every reader of it. Used by release.yml after packing, and by the tests.
 *
 *   node scripts/check-release-name.mjs <release-dir> <tag>
 *
 * `<tag>` is `vX.Y.Z` or `vX.Y.Z-rc.N`; a pre-release tarball carries the pre-release version.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tarballUrl } from './prepare.mjs';

/**
 * @param {{ tag: string, files: string[], sums?: string }} input
 *   `files` are the names in the release directory; `sums` is its SHA256SUMS text, when written.
 * @returns {string[]} the problems found; empty when the release matches `tarballUrl()`
 */
export function releaseNameProblems({ tag, files, sums }) {
  if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) return [`'${tag}' is not a vX.Y.Z or vX.Y.Z-rc.N release tag`];
  const url = tarballUrl(tag.slice(1));
  const name = basename(url);
  const problems = [];
  if (!url.endsWith(`/releases/download/${tag}/${name}`)) problems.push(`tarballUrl() points at ${url}, which is not a download from the ${tag} release`);
  if (!files.includes(name)) {
    const tgz = files.filter((f) => f.endsWith('.tgz'));
    problems.push(`the release has no ${name}, the name tarballUrl() gives (it has ${tgz.length === 0 ? 'no tarball' : tgz.join(', ')})`);
  }
  if (sums !== undefined && !sums.split('\n').some((line) => line.trim().endsWith(`  ${name}`))) problems.push(`SHA256SUMS does not list ${name}`);
  return problems;
}

function main() {
  const [dir, tag] = process.argv.slice(2);
  if (dir === undefined || tag === undefined) throw new Error('usage: check-release-name.mjs <release-dir> <tag>');
  const sumsFile = join(dir, 'SHA256SUMS');
  const problems = releaseNameProblems({ tag, files: readdirSync(dir), ...(existsSync(sumsFile) ? { sums: readFileSync(sumsFile, 'utf8') } : {}) });
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(`${join(dir, basename(tarballUrl(tag.slice(1))))}: matches ${tarballUrl(tag.slice(1))}`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
