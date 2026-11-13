#!/usr/bin/env node
// Canonical: ichava/js-ui-kernel config/check-config-drift.mjs. Copies must be
// byte-identical, and this script checks its own copy too: list it as one of the pairs.
//
// Usage: node scripts/check-config-drift.mjs <local>=<canonical> [<local>=<canonical> ...]
//
//   <local>      path in this repository, relative to the working directory
//   <canonical>  path inside ichava/js-ui-kernel, e.g. config/tsconfig.base.json
//
// Each canonical file is fetched from raw.githubusercontent.com and compared byte for byte.
// It fails on a mismatch, on a non-200 response, on an empty body and on an empty pair
// list, so it cannot pass by comparing nothing.
//
// ICHAVA_KERNEL_REF   git ref to compare against (default: main)
// ICHAVA_KERNEL_RAW   raw base URL (default: https://raw.githubusercontent.com/ichava/js-ui-kernel)
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_RAW = 'https://raw.githubusercontent.com/ichava/js-ui-kernel';

/** Parses `local=canonical` arguments. Throws on a malformed one. */
export function parsePairs(args) {
  return args.map((arg) => {
    const eq = arg.indexOf('=');
    if (eq <= 0 || eq === arg.length - 1) {
      throw new Error(`expected <local>=<canonical>, got "${arg}"`);
    }
    return { local: arg.slice(0, eq), canonical: arg.slice(eq + 1) };
  });
}

/**
 * Compares each pair. Returns { checked, failures }, where failures is a list of
 * human-readable reasons. `fetchImpl` and `readImpl` are injectable for tests.
 */
export async function checkDrift({
  pairs,
  ref = 'main',
  raw = DEFAULT_RAW,
  fetchImpl = globalThis.fetch,
  readImpl = (path) => readFile(path),
}) {
  const failures = [];
  if (pairs.length === 0) {
    failures.push('no files to compare: pass at least one <local>=<canonical> pair');
    return { checked: 0, failures };
  }

  let checked = 0;
  for (const { local, canonical } of pairs) {
    const url = `${raw}/${ref}/${canonical}`;
    let localBytes;
    try {
      localBytes = Buffer.from(await readImpl(local));
    } catch (error) {
      failures.push(`${local}: cannot read the local copy (${error.message})`);
      continue;
    }

    let response;
    try {
      response = await fetchImpl(url);
    } catch (error) {
      failures.push(`${local}: cannot fetch ${url} (${error.message})`);
      continue;
    }
    if (response.status !== 200) {
      failures.push(`${local}: ${url} answered ${response.status}, expected 200`);
      continue;
    }
    const remoteBytes = Buffer.from(await response.arrayBuffer());
    if (remoteBytes.length === 0) {
      failures.push(`${local}: ${url} returned an empty body`);
      continue;
    }

    checked += 1;
    if (!localBytes.equals(remoteBytes)) {
      failures.push(
        `${local}: differs from ${canonical} at ${ref} ` +
          `(${localBytes.length} bytes here, ${remoteBytes.length} canonical). ` +
          `Copy the canonical file over it; change the canonical in ichava/js-ui-kernel first.`,
      );
    }
  }
  return { checked, failures };
}

async function main() {
  let pairs;
  try {
    pairs = parsePairs(process.argv.slice(2));
  } catch (error) {
    console.error(`check-config-drift: ${error.message}`);
    return 2;
  }
  const ref = process.env.ICHAVA_KERNEL_REF || 'main';
  const raw = process.env.ICHAVA_KERNEL_RAW || DEFAULT_RAW;
  const { checked, failures } = await checkDrift({ pairs, ref, raw });

  for (const failure of failures) console.error(`check-config-drift: ${failure}`);
  if (failures.length > 0 || checked !== pairs.length) {
    console.error(`check-config-drift: FAILED, ${checked} of ${pairs.length} file(s) compared`);
    return 1;
  }
  console.log(`check-config-drift: ${checked} file(s) identical to ichava/js-ui-kernel@${ref}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
