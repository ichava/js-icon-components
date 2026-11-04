import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { IconKind } from '../shared/index.ts';

/**
 * Pack input. Every pack is read from git at a pinned commit, never from the live API and never
 * from a working tree, so a build is reproducible and works offline once the commit is local.
 *
 * Source order: the sibling checkout named by `checkout` when it holds the commit, otherwise a
 * shallow fetch of exactly that commit into `.cache/packs/<id>`.
 */
export interface PackConfig {
  readonly id: string;
  readonly repository: string;
  /** A full 40-character commit SHA. A branch or tag would let the input move under the build. */
  readonly ref: string;
  readonly checkout?: string;
  /** Directory in the pack holding one sub-directory per set. */
  readonly path: string;
  readonly sets: readonly string[];
  /** The set whose names carry no suffix (`outline` → `IconMug`, `filled` → `IconMugFilled`). */
  readonly defaultSet: string;
  readonly kind: IconKind;
  /** Floor for the input count. A path that stops matching fails here instead of building nothing. */
  readonly minIcons: number;
  /**
   * True when each set holds one level of category directories (`<set>/<category>/<name>.svg`), as
   * the emoji packs do. The category is not part of the name, so a name must be unique per set.
   */
  readonly categories?: boolean;
  /** SPDX expression for the artwork (not the pack's PHP code), e.g. `CC-BY-SA-4.0`. */
  readonly licence: string;
  /**
   * Files in the pack repository, read at `ref`, that must travel with the artwork: its
   * `ATTRIBUTION.md` and, where the pack carries one, the artwork's licence text. Written beside
   * every flavour's modules as `dist/<flavour>/<pack>/<basename>`.
   */
  readonly attribution: readonly string[];
  /**
   * Source SVGs the policy rejects and that are knowingly left out, each with its reason. An entry
   * that names no file, or a file that now passes, fails the build: an exemption is a ceiling.
   */
  readonly exclude?: readonly { readonly path: string; readonly reason: string }[];
}

/** Whether the artwork's licence carries an attribution condition the generated files must honour. */
export function needsAttribution(pack: Pick<PackConfig, 'licence'>): boolean {
  return /\bCC-BY/.test(pack.licence);
}

export interface SourceSvg {
  readonly set: string;
  readonly name: string;
  readonly path: string;
  readonly blob: string;
}

const ID = /^[a-z][a-z0-9-]*$/;
/** Set ids may start with a digit: the flag pack's sets are `4x3` and `1x1`. */
const SET_ID = /^[a-z0-9][a-z0-9-]*$/;

export function loadPacks(file: string): PackConfig[] {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { packs?: unknown };
  if (!Array.isArray(raw.packs) || raw.packs.length === 0) throw new Error(`${file}: "packs" must be a non-empty array`);

  const seen = new Set<string>();
  return raw.packs.map((p: PackConfig, n: number) => {
    const where = `${file}: packs[${n}]`;
    if (!ID.test(p.id ?? '')) throw new Error(`${where}: id must match ${ID}`);
    if (seen.has(p.id)) throw new Error(`${where}: duplicate id ${p.id}`);
    seen.add(p.id);
    if (!/^[0-9a-f]{40}$/.test(p.ref ?? '')) throw new Error(`${where}: ref must be a full commit SHA`);
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(p.repository ?? '')) throw new Error(`${where}: repository must be an https GitHub URL`);
    if (!Array.isArray(p.sets) || p.sets.length === 0 || !p.sets.every((s) => SET_ID.test(s))) throw new Error(`${where}: sets must be ids`);
    if (!p.sets.includes(p.defaultSet)) throw new Error(`${where}: defaultSet must be one of sets`);
    if (p.kind !== 'icon' && p.kind !== 'illustration') throw new Error(`${where}: kind must be icon or illustration`);
    if (!Number.isInteger(p.minIcons) || p.minIcons < 1) throw new Error(`${where}: minIcons must be a positive integer`);
    if (typeof p.path !== 'string' || p.path === '' || p.path.includes('..')) throw new Error(`${where}: path must be a relative path`);
    if (typeof p.licence !== 'string' || p.licence.trim() === '') throw new Error(`${where}: licence must be the artwork's SPDX expression`);
    if (!Array.isArray(p.attribution) || p.attribution.some((f) => typeof f !== 'string' || f === '' || f.includes('..') || f.startsWith('/'))) {
      throw new Error(`${where}: attribution must list relative paths in the pack repository`);
    }
    if (needsAttribution(p) && p.attribution.length === 0) throw new Error(`${where}: a ${p.licence} pack must list its attribution files`);
    const basenames = p.attribution.map((f) => f.split('/').pop());
    if (new Set(basenames).size !== basenames.length) throw new Error(`${where}: attribution files must have distinct basenames`);
    for (const e of p.exclude ?? []) {
      if (typeof e.path !== 'string' || typeof e.reason !== 'string' || e.reason.trim() === '') throw new Error(`${where}: every exclude entry needs a path and a reason`);
    }
    return p;
  });
}

function git(dir: string, args: string[], input?: string): Buffer {
  return execFileSync('git', ['-C', dir, ...args], { input, maxBuffer: 512 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

function hasCommit(dir: string, ref: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    git(dir, ['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Returns a git directory that holds `pack.ref`, fetching it if no local copy does. */
export function resolveSource(pack: PackConfig, root: string): string {
  if (pack.checkout !== undefined) {
    const sibling = resolve(root, pack.checkout);
    if (hasCommit(sibling, pack.ref)) return sibling;
  }

  const cache = join(root, '.cache', 'packs', pack.id);
  if (!hasCommit(cache, pack.ref)) {
    mkdirSync(cache, { recursive: true });
    if (!existsSync(join(cache, '.git'))) git(cache, ['init', '--quiet']);
    git(cache, ['fetch', '--quiet', '--depth', '1', '--no-tags', pack.repository, pack.ref]);
    if (!hasCommit(cache, pack.ref)) throw new Error(`${pack.id}: fetched ${pack.repository} but ${pack.ref} is still missing`);
  }
  return cache;
}

/**
 * Every `<path>/<set>/<name>.svg` (or `<path>/<set>/<category>/<name>.svg` with `categories`) at the
 * pinned commit, sorted, for the configured sets.
 */
export function listSvgs(dir: string, pack: PackConfig): SourceSvg[] {
  const out = git(dir, ['ls-tree', '-r', '-z', '--full-tree', pack.ref, '--', pack.path]).toString('utf8');
  const sets = new Set(pack.sets);
  const prefix = `${pack.path.replace(/\/$/, '')}/`;
  const files: SourceSvg[] = [];

  for (const entry of out.split('\0')) {
    const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
    if (!m || !m[2]?.startsWith(prefix)) continue;
    const rel = (pack.categories === true ? /^([^/]+)\/[^/]+\/([^/]+)\.svg$/ : /^([^/]+)\/([^/]+)\.svg$/).exec(m[2].slice(prefix.length));
    if (!rel || !sets.has(rel[1] as string)) continue;
    files.push({ set: rel[1] as string, name: rel[2] as string, path: m[2], blob: m[1] as string });
  }
  return files.sort((a, b) => (a.set === b.set ? a.name.localeCompare(b.name, 'en') : a.set.localeCompare(b.set, 'en')));
}

/** Reads one file at the pinned commit. Fails naming the path when the commit does not have it. */
export function readFileAt(dir: string, pack: PackConfig, path: string): Buffer {
  try {
    return git(dir, ['cat-file', 'blob', `${pack.ref}:${path}`]);
  } catch {
    throw new Error(`${pack.id}: ${path} does not exist at ${pack.ref.slice(0, 12)}`);
  }
}

/** Reads blobs in one `git cat-file --batch` round trip. */
export function readBlobs(dir: string, blobs: readonly string[]): Map<string, string> {
  const unique = [...new Set(blobs)];
  const buf = git(dir, ['cat-file', '--batch'], unique.join('\n') + '\n');
  const out = new Map<string, string>();
  let at = 0;
  for (const sha of unique) {
    const nl = buf.indexOf(0x0a, at);
    const header = buf.subarray(at, nl).toString('utf8');
    const m = /^([0-9a-f]{40}) blob (\d+)$/.exec(header);
    if (!m || m[1] !== sha) throw new Error(`git cat-file: unexpected header "${header}" for ${sha}`);
    const size = Number(m[2]);
    out.set(sha, buf.subarray(nl + 1, nl + 1 + size).toString('utf8'));
    at = nl + 1 + size + 1;
  }
  return out;
}
