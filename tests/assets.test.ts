import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { ASSET_FILES, cssMask, dataUriMap, isMonochrome, slugs, standaloneSvg, svgDataUri } from '../src/generator/assets.ts';
import { checkAssetCounts, countAssets, readPack, writeAssets, type NamedIcon } from '../src/generator/generate.ts';
import { ASSET_TARGETS, type AssetTarget } from '../src/shared/index.ts';
import { iconsFrom, pack, readZip, ROOT, SAMPLE } from './helpers.ts';

/**
 * The asset exports. Golden output for three icons where the format is text, a structural check
 * for each format (CSS parses, the JSON is a map of data URIs,
 * pubspec parses as YAML and names paths that exist, every Contents.json uses only Apple's
 * documented keys), and the count guard over a real build of the flag pack, proven able to fail.
 */

const sample = (): NamedIcon[] => iconsFrom('tabler', SAMPLE).map((data, n) => ({ exportName: SAMPLE[n] as string, data }));
let out: string;
let counts: Partial<Record<AssetTarget, number>>;
let flagIcons: number;
const asset = (file: string): Buffer => readFileSync(join(out, 'assets/flag', file));

beforeAll(() => {
  out = mkdtempSync(join(ROOT, '.cache', 'assets-'));
  // Every asset export of the flag pack, written and counted exactly as the generator does it.
  const icons = readPack(pack('flag'), ROOT);
  flagIcons = icons.length;
  ({ counts } = writeAssets(pack('flag'), icons, ROOT, out, new Set(ASSET_TARGETS)));
}, 300_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('css-mask', () => {
  it('matches the golden CSS for three icons', () => {
    const icons = sample();
    expect(cssMask('tabler', icons, slugs(icons, 'outline'), 'header')).toMatchSnapshot();
  });

  it('a quote or parenthesis inside an SVG cannot break out of url("…")', () => {
    const svg = standaloneSvg({ attrs: { viewBox: '0 0 1 1' }, size: 1, nodes: [['path', { d: 'M0 0', 'data-x': `") } body { background: red } .x { a: url('` }]] });
    const uri = svgDataUri(svg);
    expect(uri).not.toMatch(/["\\\n]/);
    const css = `.i{--m:url("${uri}")}`;
    const sheet = new JSDOM(`<style>${css}</style>`).window.document.styleSheets[0] as CSSStyleSheet;
    expect(sheet.cssRules).toHaveLength(1);
    // Decoding gives back exactly the SVG that was encoded (it holds a quote of its own, so no swap).
    expect(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))).toBe(svg);
    expect(svgDataUri('<svg a="1"/>')).toBe("data:image/svg+xml,%3Csvg a='1'/%3E");
  });

  it('parses as CSS with one rule per icon plus the shared one, in a real build', () => {
    const css = asset('icons.css').toString('utf8');
    const sheet = new JSDOM(`<style>${css}</style>`).window.document.styleSheets[0] as CSSStyleSheet;
    expect(sheet.cssRules.length).toBe(counts['css-mask'] as number + 1);
    expect(css).toContain('.i-flag-ke{');
  });
});

describe('data-uri', () => {
  it('maps each slug to a percent-encoded SVG data URI', () => {
    const icons = sample();
    const map = JSON.parse(dataUriMap(icons, slugs(icons, 'outline'))) as Record<string, string>;
    expect(Object.keys(map)).toEqual(['mug', 'mug-filled', 'brand-github']);
    for (const uri of Object.values(map)) {
      expect(uri.startsWith('data:image/svg+xml,%3Csvg')).toBe(true);
      expect(uri).not.toContain('base64');
    }
    expect(map).toMatchSnapshot();
  });
});

describe('flutter', () => {
  it('pubspec.fragment.yaml parses and every asset path the Dart file names exists', () => {
    const entries = readZip(asset('flutter.zip'));
    const pubspec = parseYaml((entries.get('pubspec.fragment.yaml') as Buffer).toString('utf8')) as { dependencies: Record<string, string>; flutter: { assets: string[] } };
    expect(pubspec.dependencies.flutter_svg).toBeDefined();
    expect(pubspec.flutter.assets).toEqual(['assets/ichava/flag/4x3/', 'assets/ichava/flag/1x1/']);
    const dart = (entries.get('lib/ichava_flag_icons.dart') as Buffer).toString('utf8');
    const paths = [...dart.matchAll(/^const String icon\w+ = '([^']+)';$/gm)].map((m) => m[1] as string);
    expect(paths).toHaveLength(counts.flutter as number);
    for (const p of paths) {
      expect(entries.has(p), p).toBe(true);
      expect(pubspec.flutter.assets.some((dir) => p.startsWith(dir))).toBe(true);
    }
    expect(dart).toContain("const String iconKe = 'assets/ichava/flag/4x3/ke.svg';");
  });
});

describe('swiftui', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/xcassets-contents.json'), 'utf8')) as {
    catalog: { keys: string[]; info: string[] };
    imageset: { keys: string[]; image: string[]; idiom: string[]; properties: string[]; 'template-rendering-intent': string[] };
  };

  it('every Contents.json uses only the keys Apple documents, and each imageset holds its SVG', () => {
    const entries = readZip(asset('swiftui.zip'));
    const root = JSON.parse((entries.get('IchavaFlag.xcassets/Contents.json') as Buffer).toString('utf8')) as Record<string, Record<string, unknown>>;
    expect(Object.keys(root).every((k) => schema.catalog.keys.includes(k))).toBe(true);
    expect(root.info).toEqual({ author: 'xcode', version: 1 });

    const sets = [...entries.keys()].filter((k) => k.endsWith('.imageset/Contents.json'));
    expect(sets).toHaveLength(counts.swiftui as number);
    for (const file of sets) {
      const c = JSON.parse((entries.get(file) as Buffer).toString('utf8')) as { images: Record<string, unknown>[]; properties: Record<string, unknown> };
      expect(Object.keys(c).every((k) => schema.imageset.keys.includes(k)), file).toBe(true);
      for (const image of c.images) {
        expect(Object.keys(image).every((k) => schema.imageset.image.includes(k))).toBe(true);
        expect(schema.imageset.idiom).toContain(image.idiom);
        expect(entries.has(file.replace('Contents.json', image.filename as string))).toBe(true);
      }
      expect(Object.keys(c.properties).every((k) => schema.imageset.properties.includes(k))).toBe(true);
      expect(schema.imageset['template-rendering-intent']).toContain(c.properties['template-rendering-intent']);
      expect(c.properties['preserves-vector-representation']).toBe(true);
    }
  });

  it('a monochrome icon renders as a template, one with colours of its own as original', () => {
    const [mug, mugFilled, github] = sample();
    expect([mug, mugFilled, github].map((i) => isMonochrome(i!.data))).toEqual([true, true, true]);
    const entries = readZip(asset('swiftui.zip'));
    const ke = JSON.parse((entries.get('IchavaFlag.xcassets/ke.imageset/Contents.json') as Buffer).toString('utf8')) as { properties: Record<string, string> };
    expect(ke.properties['template-rendering-intent']).toBe('original');
  });
});

describe('SVG only', () => {
  /**
   * The ichava icon ecosystem is strictly SVG (owner rule, 2026-11-04): an asset export writes SVG,
   * or CSS, JSON, Dart or YAML that carries or indexes SVG (Contents.json included), and the pack's
   * own attribution files. A raster or a non-SVG vector file (PNG, VectorDrawable XML, PDF) fails.
   */
  const SVG_BASED = /\.(svg|css|json|dart|yaml)$/;

  it('every file the asset exports write, and every entry in their zips, is SVG-based', () => {
    const attribution = new Set(pack('flag').attribution.map((f) => f.split('/').pop() as string));
    const dir = join(out, 'assets/flag');
    const files = readdirSync(dir);
    expect(files.sort()).toEqual(ASSET_TARGETS.flatMap((t) => ASSET_FILES[t]).sort());
    const written: string[] = [];
    for (const file of files) {
      if (file.endsWith('.zip')) written.push(...[...readZip(asset(file)).keys()].filter((k) => !k.endsWith('/')).map((k) => `${file}:${k}`));
      else written.push(file);
    }
    expect(written.length).toBeGreaterThan(flagIcons * 3);
    const bad = written.filter((w) => !SVG_BASED.test(w) && !attribution.has(w.split('/').pop()!.split(':').pop()!));
    expect(bad).toEqual([]);
  });

  it('owns no android-vd export: the targets are the four SVG-carrying ones', () => {
    expect([...ASSET_TARGETS]).toEqual(['css-mask', 'data-uri', 'flutter', 'swiftui']);
    expect(Object.keys(ASSET_FILES)).toEqual([...ASSET_TARGETS]);
  });
});

describe('the asset count guard', () => {
  it('counts every export from the files the build wrote', () => {
    expect(flagIcons).toBeGreaterThan(500);
    expect(Object.keys(counts)).toEqual([...ASSET_TARGETS]);
    for (const target of ASSET_TARGETS) expect(counts[target]).toBe(flagIcons);
  });

  it('fails on a short export: one class removed from icons.css is counted short, and the guard throws', () => {
    const css = asset('icons.css').toString('utf8');
    const copy = mkdtempSync(join(out, 'short-'));
    mkdirSync(join(copy, 'assets/flag'), { recursive: true });
    writeFileSync(join(copy, 'assets/flag/icons.css'), css.replace(/^\.i-flag-ke\{.*\n/m, ''));
    const short = countAssets(copy, 'flag', ['css-mask']);
    expect(short['css-mask']).toBe(flagIcons - 1);
    expect(() => checkAssetCounts('flag', short, flagIcons)).toThrow(`flag: the css-mask export holds ${flagIcons - 1} icons, expected ${flagIcons}`);
  });
});
