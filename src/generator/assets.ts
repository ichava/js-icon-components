import { serialiseSvg, SVG_NS, type AssetTarget, type IconChild, type IconData } from '../shared/index.ts';
import { elmModuleSegment } from './elm.ts';
import type { NamedIcon } from './generate.ts';
import { zip, type ZipEntry } from './zip.ts';

/**
 * The asset exports. Each writes files, not a module, under `dist/assets/<pack>/`, from the same
 * sanitised, parsed tree every flavour renders: nothing here reads source text, so the encoders
 * only ever see what the policy accepted.
 *
 *   css-mask    icons.css         one `.i-<pack>-<slug>` class per icon (mask-image, data URI)
 *   data-uri    data-uri.json     { "<slug>": "data:image/svg+xml,…" }
 *   flutter     flutter.zip       assets/ichava/<pack>/<set>/<name>.svg, lib/ichava_<pack>_icons.dart, pubspec.fragment.yaml
 *   swiftui     swiftui.zip       Ichava<Pack>.xcassets with one imageset per icon
 *
 * Every file they write is SVG, or CSS, JSON, Dart or YAML that carries or indexes SVG, plus the
 * pack's attribution files (tests/assets.test.ts holds this): the ecosystem is strictly SVG.
 */

/** Where each target writes, relative to `dist/assets/<pack>/`. */
export const ASSET_FILES: Readonly<Record<AssetTarget, readonly string[]>> = {
  'css-mask': ['icons.css'],
  'data-uri': ['data-uri.json'],
  flutter: ['flutter.zip'],
  swiftui: ['swiftui.zip'],
};

/** `mug` in the default set is `mug`; in `filled` it is `mug-filled`. Lower-case, `[a-z0-9-]`. */
export function slug(icon: IconData, defaultSet: string): string {
  const raw = icon.set === defaultSet ? icon.name : `${icon.name}-${icon.set}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Slugs for a pack, failing on a collision rather than renaming one of the two. */
export function slugs(icons: readonly NamedIcon[], defaultSet: string): string[] {
  const seen = new Map<string, string>();
  return icons.map((i) => {
    const s = slug(i.data, defaultSet);
    if (s === '') throw new Error(`${i.data.id}: no slug can be derived from its name`);
    const other = seen.get(s);
    if (other !== undefined) throw new Error(`asset slug "${s}" is claimed by both ${other} and ${i.data.id}`);
    seen.set(s, i.data.id);
    return s;
  });
}

const usesXlink = (nodes: readonly IconChild[]): boolean =>
  nodes.some((n) => typeof n !== 'string' && (Object.keys(n[1]).some((a) => a.startsWith('xlink:')) || usesXlink(n[2] ?? [])));

/**
 * A standalone SVG document for an icon: its own attributes, its source size, no component props.
 * A file or a data URI is parsed as XML, so the `xlink` prefix the tree may use is declared again
 * (the sanitiser drops namespace declarations from the root, which inline SVG does not need).
 */
export function standaloneSvg(icon: { readonly attrs: Readonly<Record<string, string>>; readonly size: number; readonly nodes: readonly IconChild[] }): string {
  const xlink = usesXlink(icon.nodes) || Object.keys(icon.attrs).some((a) => a.startsWith('xlink:'));
  // A file has no layout box to sit in, so its height follows the viewBox: a 4x3 flag is 4x3.
  const vb = (icon.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const height = vb.length === 4 && (vb[2] as number) > 0 && (vb[3] as number) > 0 ? Math.round(((icon.size * (vb[3] as number)) / (vb[2] as number)) * 1000) / 1000 : icon.size;
  return serialiseSvg(
    { xmlns: SVG_NS, ...(xlink ? { 'xmlns:xlink': 'http://www.w3.org/1999/xlink' } : {}), ...icon.attrs, width: String(icon.size), height: String(height) },
    icon.nodes,
  );
}

/**
 * `data:image/svg+xml,…`, percent-encoded rather than base64 (smaller, and the form
 * mini-svg-data-uri and @iconify/tailwind use). The result never holds a double quote, a backslash
 * or a line break, so it cannot end the double-quoted `url("…")` the CSS export writes, nor a JSON
 * string. To save bytes, attribute quotes become single quotes when the SVG has none of its own; a
 * few characters `encodeURIComponent` escapes are put back, none of them special inside `url("…")`.
 */
export function svgDataUri(svg: string): string {
  const quoted = svg.includes("'") ? svg : svg.replace(/"/g, "'");
  const encoded = encodeURIComponent(quoted)
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%2C/g, ',')
    .replace(/%3B/g, ';');
  return `data:image/svg+xml,${encoded}`;
}

const cssComment = (header: string): string => `/*! ${header.replace(/\*\//g, '* /')} */\n`;

export function cssMask(packId: string, icons: readonly NamedIcon[], names: readonly string[], header: string): string {
  const prefix = `i-${packId}-`;
  const rules = icons.map((icon, n) => `.${prefix}${names[n]}{--ichava-mask:url("${svgDataUri(standaloneSvg(icon.data))}")}`);
  return (
    cssComment(header) +
    `/* One class per icon: <span class="${prefix}${names[0] ?? 'name'}"></span>. It paints with currentColor and sizes with font-size. */\n` +
    `:where([class^="${prefix}"],[class*=" ${prefix}"]){display:inline-block;width:1em;height:1em;vertical-align:-0.125em;background-color:currentColor;` +
    '-webkit-mask:var(--ichava-mask) no-repeat center/contain;mask:var(--ichava-mask) no-repeat center/contain}\n' +
    rules.join('\n') +
    '\n'
  );
}

export function dataUriMap(icons: readonly NamedIcon[], names: readonly string[]): string {
  return JSON.stringify(Object.fromEntries(icons.map((icon, n) => [names[n], svgDataUri(standaloneSvg(icon.data))])), null, 1) + '\n';
}

const dartName = (exportName: string): string => exportName.charAt(0).toLowerCase() + exportName.slice(1);

export function flutterZip(packId: string, icons: readonly NamedIcon[], sets: readonly string[], header: string, attribution: readonly ZipEntry[]): Buffer {
  const base = `assets/ichava/${packId}`;
  const path = (icon: NamedIcon): string => `${base}/${icon.data.set}/${icon.data.name}.svg`;
  const dart = [
    ...header.split('\n').filter(Boolean).map((l) => `// ${l.replace(/^\/\/ ?/, '').replace(/^\/\*! ?/, '').replace(/ ?\*\/$/, '')}`),
    '//',
    "// Asset paths for flutter_svg: SvgPicture.asset(iconMug, colorFilter: ColorFilter.mode(color, BlendMode.srcIn)).",
    '// Add the assets block of pubspec.fragment.yaml to your pubspec.yaml.',
    '',
    ...icons.map((icon) => `const String ${dartName(icon.exportName)} = '${path(icon)}';`),
    '',
  ].join('\n');
  const pubspec = [
    `# Merge into your app's pubspec.yaml. The SVGs are ${packId} artwork; see ${base}/ for its licence.`,
    'dependencies:',
    '  flutter_svg: ^2.0.0',
    'flutter:',
    '  assets:',
    ...sets.filter((s) => icons.some((i) => i.data.set === s)).map((s) => `    - ${base}/${s}/`),
    '',
  ].join('\n');
  return zip([
    { path: `lib/ichava_${packId.replace(/-/g, '_')}_icons.dart`, data: dart },
    { path: 'pubspec.fragment.yaml', data: pubspec },
    ...attribution.map((a) => ({ path: `${base}/${a.path}`, data: a.data })),
    ...icons.map((icon) => ({ path: path(icon), data: standaloneSvg(icon.data) + '\n' })),
  ]);
}

const PAINT = /^(?:fill|stroke|stop-color|color|flood-color|lighting-color)$/;
const NEUTRAL = new Set(['none', 'currentcolor', 'inherit', 'transparent', 'black', '#000', '#000000']);

/**
 * Whether an icon paints in one colour only (`currentColor`, black, or nothing), which is when Xcode
 * may draw it as a template image, tinted by the view from its alpha. An icon with a colour of its
 * own keeps it: `original`.
 */
export function isMonochrome(icon: IconData): boolean {
  const values: string[] = [];
  const visit = (attrs: Readonly<Record<string, string>>): void => {
    for (const [name, value] of Object.entries(attrs)) {
      if (PAINT.test(name)) values.push(value);
      if (name === 'style') for (const m of value.matchAll(/(?:^|;)\s*(fill|stroke|stop-color|color)\s*:\s*([^;]+)/gi)) values.push(m[2] as string);
    }
  };
  visit(icon.attrs);
  const walk = (nodes: readonly IconChild[]): void => {
    for (const n of nodes) {
      if (typeof n === 'string') continue;
      visit(n[1]);
      walk(n[2] ?? []);
    }
  };
  walk(icon.nodes);
  // An unpainted shape is black, SVG's initial fill: one colour, which a template tints as well.
  return values.every((v) => NEUTRAL.has(v.trim().toLowerCase()));
}

export function swiftuiZip(packId: string, icons: readonly NamedIcon[], names: readonly string[], attribution: readonly ZipEntry[] = []): Buffer {
  const catalog = `Ichava${elmModuleSegment(packId)}.xcassets`;
  const info = { author: 'xcode', version: 1 };
  const entries: ZipEntry[] = [...attribution, { path: `${catalog}/Contents.json`, data: JSON.stringify({ info }, null, 2) + '\n' }];
  icons.forEach((icon, n) => {
    const name = names[n] as string;
    const contents = {
      images: [{ filename: `${name}.svg`, idiom: 'universal' }],
      info,
      properties: { 'preserves-vector-representation': true, 'template-rendering-intent': isMonochrome(icon.data) ? 'template' : 'original' },
    };
    entries.push(
      { path: `${catalog}/${name}.imageset/Contents.json`, data: JSON.stringify(contents, null, 2) + '\n' },
      { path: `${catalog}/${name}.imageset/${name}.svg`, data: standaloneSvg(icon.data) + '\n' },
    );
  });
  return zip(entries);
}
