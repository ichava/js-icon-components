import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FLAVOURS, ASSET_TARGETS, FLAVOURS, GENERATOR_FORMATS, NATIVE_TARGETS, PENDING_FLAVOURS, TIER3_FLAVOURS } from '../src/shared/index.ts';
import { ROOT } from './helpers.ts';

/**
 * The format registry is icon-browser's schema (1.6.0+): `x-ichava-formats` lists every code tab,
 * copy format and export, each with the `delivery` that serves it. This repository owns two of
 * those deliveries: `generated` (a flavour here) and `asset` (an export under `dist/assets/`).
 * Both directions hold for both: every format the generator writes is in the registry with the
 * delivery it is written as, and every `generated` or `asset` format there is written here. The
 * `laravel` and `client` formats are served elsewhere and must not be claimed. So the browser never
 * advertises a tab or an export this package cannot serve.
 */
interface Format { id: string; delivery: string; copy: boolean; native?: boolean }

const schema = JSON.parse(readFileSync(join(ROOT, 'vendor/icon-browser.schema.json'), 'utf8')) as {
  version: string;
  'x-ichava-formats': Format[];
  $defs: { format: { enum: string[] } };
};
const registry = schema['x-ichava-formats'];
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { exports: Record<string, unknown> };

/** Subpath each flavour ships under. `webcomponent` is `./wc`, the only one that differs. Elm ships source, not a module. */
const SUBPATH: Record<(typeof ALL_FLAVOURS)[number], string> = {
  react: './react', vue: './vue', svelte: './svelte', webcomponent: './wc',
  reactNative: './react-native', angular: './angular', solid: './solid', preact: './preact', astro: './astro',
  qwik: './qwik', ember: './ember', elm: './elm',
};

describe('format registry', () => {
  it('read the whole 1.6.0 registry: 27 formats, every one with a delivery', () => {
    expect(schema.version).toBe('1.6.0');
    expect(registry).toHaveLength(27);
    expect(new Set(registry.map((f) => f.id)).size).toBe(27);
    expect(schema.$defs.format.enum).toHaveLength(27);
    expect(registry.every((f) => ['generated', 'asset', 'laravel', 'client'].includes(f.delivery))).toBe(true);
    expect(ALL_FLAVOURS).toHaveLength(12);
    expect(ASSET_TARGETS).toHaveLength(6);
    expect(FLAVOURS.length + PENDING_FLAVOURS.length + TIER3_FLAVOURS.length).toBe(ALL_FLAVOURS.length);
    expect(GENERATOR_FORMATS).toHaveLength(18);
  });

  it.each(ALL_FLAVOURS)('%s is a generated, copyable format in the registry and the enum', (flavour) => {
    const format = registry.find((f) => f.id === flavour);
    expect(format, `${flavour} is missing from x-ichava-formats`).toBeDefined();
    expect(format?.delivery).toBe('generated');
    expect(format?.copy).toBe(true);
    expect(schema.$defs.format.enum).toContain(flavour);
  });

  it.each(ASSET_TARGETS)('%s is an asset export in the registry and the enum', (target) => {
    const format = registry.find((f) => f.id === target);
    expect(format, `${target} is missing from x-ichava-formats`).toBeDefined();
    expect(format?.delivery).toBe('asset');
    expect(format?.native === true).toBe((NATIVE_TARGETS as readonly string[]).includes(target));
    expect(schema.$defs.format.enum).toContain(target);
  });

  it('every generated and asset format in the registry is written here, and nothing else is claimed', () => {
    const owned = registry.filter((f) => f.delivery === 'generated' || f.delivery === 'asset').map((f) => f.id);
    expect(owned.sort()).toEqual([...GENERATOR_FORMATS].sort());
    const elsewhere = registry.filter((f) => f.delivery === 'laravel' || f.delivery === 'client').map((f) => f.id);
    expect(elsewhere).toHaveLength(27 - GENERATOR_FORMATS.length);
    for (const id of elsewhere) expect(GENERATOR_FORMATS as readonly string[]).not.toContain(id);
  });

  it.each(ALL_FLAVOURS.filter((f) => f !== 'elm'))('%s has its entry point and pack subpath in package.json exports', (flavour) => {
    expect(pkg.exports).toHaveProperty([SUBPATH[flavour]]);
    expect(pkg.exports).toHaveProperty([`${SUBPATH[flavour]}/*`]);
  });

  it('the Elm source and the asset exports are reachable through package.json exports', () => {
    expect(pkg.exports).toHaveProperty(['./elm/*']);
    expect(pkg.exports).toHaveProperty(['./assets/*']);
  });
});
