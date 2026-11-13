import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, type BuildOptions } from 'esbuild';
import { buildIcons, readPack, type NamedIcon } from '../src/generator/generate.ts';
import { loadPacks, type PackConfig } from '../src/generator/packs.ts';
import type { IconData } from '../src/shared/index.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, '.cache', 'test');

export function packs(): PackConfig[] {
  return loadPacks(join(ROOT, 'packs.json'));
}

export function pack(id: string): PackConfig {
  const found = packs().find((p) => p.id === id);
  if (!found) throw new Error(`packs.json has no ${id} entry`);
  return found;
}

export const tabler = (): PackConfig => pack('tabler');

const byPack = new Map<string, Map<string, IconData>>();

/** Icons from any pinned pack by export name, read (and id-prefixed) as the generator reads them. */
export function iconsFrom(id: string, names: readonly string[]): IconData[] {
  let icons = byPack.get(id);
  if (!icons) {
    icons = new Map(readPack(pack(id), ROOT).map((i) => [i.exportName, i.data]));
    byPack.set(id, icons);
  }
  return names.map((name) => {
    const icon = icons.get(name);
    if (!icon) throw new Error(`${name} is not in the pinned ${id} pack`);
    return icon;
  });
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

/** The test-only illustration pack: three CC0 shapes drawn for these tests, two with a dark twin. */
export const ILLUSTRATION_DIR = join(ROOT, 'tests/fixtures/packs/illustration-demo');

export function illustrations(): NamedIcon[] {
  const dir = join(ILLUSTRATION_DIR, 'scenes');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => ({ set: 'scenes', name: f.replace(/\.svg$/, ''), path: `scenes/${f}`, svg: readFileSync(join(dir, f), 'utf8') }));
  return buildIcons({ id: 'illustration-demo', defaultSet: 'scenes', kind: 'illustration', themeVariants: { dark: '-dark' } }, files).icons;
}

/** A zip's entries by path, read from its central directory and inflated. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLength = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(body) : Buffer.from(body));
    at += 46 + nameLength + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return out;
}
