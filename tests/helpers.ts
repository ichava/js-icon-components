import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, type BuildOptions } from 'esbuild';
import { readPack } from '../src/generator/generate.ts';
import { loadPacks, type PackConfig } from '../src/generator/packs.ts';
import type { IconData } from '../src/shared/index.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, '.cache', 'test');

export function tabler(): PackConfig {
  const pack = loadPacks(join(ROOT, 'packs.json')).find((p) => p.id === 'tabler');
  if (!pack) throw new Error('packs.json has no tabler entry');
  return pack;
}

let icons: Map<string, IconData> | undefined;

/** The three icons every render snapshot uses: stroked, filled, and a stroked brand mark. */
export const SAMPLE = ['IconMug', 'IconMugFilled', 'IconBrandGithub'] as const;

export function sampleIcons(): IconData[] {
  icons ??= new Map(readPack(tabler(), ROOT).map((i) => [i.exportName, i.data]));
  return SAMPLE.map((name) => {
    const icon = icons?.get(name);
    if (!icon) throw new Error(`${name} is not in the pinned tabler pack`);
    return icon;
  });
}

/** Bundles `options` to an ESM file under .cache/test and imports it, keeping framework packages external. */
export async function bundleAndImport<T>(name: string, options: BuildOptions): Promise<T> {
  mkdirSync(CACHE, { recursive: true });
  const outfile = join(CACHE, `${name}.mjs`);
  await build({ bundle: true, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'silent', ...options, outfile, write: true });
  return (await import(/* @vite-ignore */ `${pathToFileURL(outfile).href}?t=${Date.now()}`)) as T;
}
