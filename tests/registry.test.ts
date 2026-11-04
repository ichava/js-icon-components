import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAVOURS, PENDING_FLAVOURS } from '../src/shared/index.ts';
import { ROOT } from './helpers.ts';

/**
 * The format registry is icon-browser's schema (1.4.0+): `x-ichava-formats` lists every code tab
 * and copy format, with `delivery: "generated"` for the ones this repository builds. Both
 * directions hold: every flavour here is a generated format there, and every generated format
 * there is a flavour here. So the browser never advertises a tab this package cannot serve.
 */
interface Format { id: string; delivery: string; copy: boolean }

const schema = JSON.parse(readFileSync(join(ROOT, 'vendor/icon-browser.schema.json'), 'utf8')) as {
  'x-ichava-formats': Format[];
  $defs: { format: { enum: string[] } };
};
const registry = schema['x-ichava-formats'];
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { exports: Record<string, unknown> };

/** Subpath each flavour ships under. `webcomponent` is `./wc`, the only one that differs. */
const SUBPATH: Record<(typeof FLAVOURS)[number] | (typeof PENDING_FLAVOURS)[number], string> = {
  react: './react', vue: './vue', svelte: './svelte', webcomponent: './wc',
  reactNative: './react-native', angular: './angular', solid: './solid',
};

describe('format registry', () => {
  it('read a registry of a plausible size', () => {
    expect(registry.length).toBeGreaterThanOrEqual(10);
    expect(FLAVOURS.length).toBe(4);
  });

  it.each(FLAVOURS)('%s is a generated, copyable format in the registry and the enum', (flavour) => {
    const format = registry.find((f) => f.id === flavour);
    expect(format, `${flavour} is missing from x-ichava-formats`).toBeDefined();
    expect(format?.delivery).toBe('generated');
    expect(format?.copy).toBe(true);
    expect(schema.$defs.format.enum).toContain(flavour);
  });

  it('every generated format in the registry is a flavour here', () => {
    const generated = registry.filter((f) => f.delivery === 'generated').map((f) => f.id);
    expect(generated.sort()).toEqual([...FLAVOURS].sort());
  });

  // A generated flavour the registry does not list yet is built and tested here but kept out of the
  // required set above. Once icon-browser lists it (and the vendored schema copy is refreshed), this
  // fails: move the id from PENDING_FLAVOURS into FLAVOURS so the registry guard covers it.
  it.each(PENDING_FLAVOURS)('%s is not in the registry yet, so it stays pending', (flavour) => {
    expect(registry.find((f) => f.id === flavour)).toBeUndefined();
    expect(schema.$defs.format.enum).not.toContain(flavour);
  });

  it.each([...FLAVOURS, ...PENDING_FLAVOURS])('%s has its entry point and pack subpath in package.json exports', (flavour) => {
    expect(pkg.exports).toHaveProperty([SUBPATH[flavour]]);
    expect(pkg.exports).toHaveProperty([`${SUBPATH[flavour]}/*`]);
  });
});
