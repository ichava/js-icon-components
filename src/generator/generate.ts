import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { transform as transformAstro } from '@astrojs/compiler-rs';
import { buildSync, transformSync } from 'esbuild';
import { compile as compileSvelte } from 'svelte/compiler';
import { compileScript, compileTemplate, parse as parseSfc } from 'vue/compiler-sfc';
import { ALL_FLAVOURS, PENDING_FLAVOURS, type AnyFlavour, type IconData, type PendingFlavour } from '../shared/index.ts';
import { idPrefix, prefixIds } from './ids.ts';
import { assignNames } from './naming.ts';
import { listSvgs, loadPacks, readBlobs, readFileAt, resolveSource, type PackConfig, type SourceSvg } from './packs.ts';
import { sanitiseSvg, SvgRejected } from './sanitize.ts';

/**
 * Turns each pinned pack into one data module plus one module per flavour. The flavour code
 * itself is four templates (src/react, src/vue, src/svelte, src/wc); everything written here is
 * data and one binding call per icon, so a template change is one file, not thousands.
 */

export interface PackManifest {
  readonly id: string;
  readonly repository: string;
  readonly ref: string;
  /** SPDX expression for the artwork. */
  readonly licence: string;
  /** Source SVGs read at `ref`. */
  readonly inputs: number;
  /** Source paths left out by the pack's `exclude` list. `outputs` is `inputs - excluded.length`. */
  readonly excluded: string[];
  /** Icons written per built flavour. A selective build lists only the flavours it built. */
  readonly outputs: Partial<Record<AnyFlavour, number>>;
  /** Attribution and licence files, relative to `dist/`, one copy per flavour. */
  readonly attribution: string[];
}

export interface Manifest {
  /** The flavours this build wrote. Every flavour, unless the build was selective. */
  readonly flavours: readonly AnyFlavour[];
  /** The packs this build wrote. Every pack in packs.json, unless the build was selective. */
  readonly packs: PackManifest[];
  /** What a selective build left out. Their modules are stubs that throw naming the variable to set. */
  readonly unbuilt: { readonly packs: readonly string[]; readonly flavours: readonly AnyFlavour[] };
}

/** The packs and flavours one build writes. */
export interface Selection {
  readonly packs: readonly string[];
  readonly flavours: readonly AnyFlavour[];
}

/** The environment variables a selective build reads, also set by `scripts/prepare.mjs` from `"ichava.icons"`. */
export const SELECTION_ENV = { packs: 'ICHAVA_ICONS_PACKS', flavours: 'ICHAVA_ICONS_FLAVOURS' } as const;

export interface GenerateOptions {
  /** Package root: holds packs.json, src/ and the sibling checkouts' parent. */
  readonly root: string;
  /** Output directory, normally `<root>/dist`. The flavour runtimes from tsc must already be there. */
  readonly outDir: string;
  readonly packsFile?: string;
  /** Which packs and flavours to write. Default: all of them. */
  readonly selection?: Selection;
}

function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/**
 * The `.vue` and `.svelte` templates import `../shared/index.ts` for the type checker; the build
 * points them at the emitted `.js`. Exactly one such import, or the build stops.
 */
export function rewriteSharedImport(source: string, file: string): string {
  const from = "'../shared/index.ts'";
  const hits = source.split(from).length - 1;
  if (hits !== 1) throw new Error(`${file}: expected one import of ${from}, found ${hits}`);
  return source.replace(from, "'../shared/index.js'");
}

/** Compiles the Vue template with @vue/compiler-sfc, then strips TypeScript with esbuild. */
export function compileVue(source: string, filename: string): string {
  const { descriptor, errors } = parseSfc(source, { filename });
  if (errors.length > 0) throw new Error(`${filename}: ${errors.map(String).join('; ')}`);
  if (!descriptor.template) throw new Error(`${filename}: no <template>`);

  const id = 'ichava-icon';
  const script = compileScript(descriptor, { id, genDefaultAs: '_sfc_main' });
  const template = compileTemplate({
    id,
    filename,
    source: descriptor.template.content,
    compilerOptions: { bindingMetadata: script.bindings },
  });
  if (template.errors.length > 0) throw new Error(`${filename}: ${template.errors.map(String).join('; ')}`);

  const ts = `${script.content}\n${template.code}\n_sfc_main.render = render;\nexport default _sfc_main;\n`;
  return transformSync(ts, { loader: 'ts', format: 'esm', target: 'es2022' }).code;
}

/** Fails the build if the Svelte template does not compile, for the client or for the server. */
export function checkSvelte(source: string, filename: string): void {
  compileSvelte(source, { filename, generate: 'client' });
  compileSvelte(source, { filename, generate: 'server' });
}

/**
 * Fails the build if an Astro template does not compile. The options are the ones Astro 7 passes
 * itself (astro/dist/core/compile/compile.js) that change the emitted code.
 */
export function checkAstro(source: string, filename: string): void {
  const result = transformAstro(source, { filename, internalURL: 'astro/compiler-runtime', resultScopedSlot: true, resolvePath: (s: string) => s });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) throw new Error(`${filename}: ${errors.map((d) => d.text).join('; ')}`);
}

function emitRuntimes(root: string, outDir: string): void {
  const vueSource = rewriteSharedImport(readFileSync(join(root, 'src/vue/Icon.vue'), 'utf8'), 'src/vue/Icon.vue');
  write(join(outDir, 'vue/index.js'), compileVue(vueSource, 'Icon.vue'));
  write(
    join(outDir, 'vue/index.d.ts'),
    [
      "import type { DefineComponent, FunctionalComponent } from 'vue';",
      "import type { IconData, IconProps } from '../shared/index.js';",
      "export type { IconData, IconProps } from '../shared/index.js';",
      'export type VueIcon = FunctionalComponent<IconProps>;',
      'declare const Icon: DefineComponent<IconProps & { icon: IconData }>;',
      'export default Icon;',
      'export declare function defineIcon(icon: IconData): VueIcon;',
      '',
    ].join('\n'),
  );

  const svelteSource = rewriteSharedImport(readFileSync(join(root, 'src/svelte/Icon.svelte'), 'utf8'), 'src/svelte/Icon.svelte');
  checkSvelte(svelteSource, 'Icon.svelte');
  write(join(outDir, 'svelte/Icon.svelte'), svelteSource);
  write(join(outDir, 'svelte/index.js'), "export { default as Icon } from './Icon.svelte';\n");
  const svelteTypes = [
    "import type { Component } from 'svelte';",
    "import type { IconData, IconProps } from '../shared/index.js';",
    "export type { IconData, IconProps } from '../shared/index.js';",
    'export type SvelteIcon = Component<IconProps & Record<string, unknown>>;',
    'export declare const Icon: Component<IconProps & { icon: IconData } & Record<string, unknown>>;',
    '',
  ].join('\n');
  write(join(outDir, 'svelte/index.d.ts'), svelteTypes);
  write(join(outDir, 'svelte/icon.d.ts'), "import type { SvelteIcon } from './index.js';\ndeclare const icon: SvelteIcon;\nexport default icon;\n");

  // Astro components ship as source, as Svelte's do; the application's Astro compiles them.
  for (const file of ['Icon.astro', 'Nodes.astro']) {
    const source = rewriteSharedImport(readFileSync(join(root, `src/astro/${file}`), 'utf8'), `src/astro/${file}`);
    checkAstro(source, file);
    write(join(outDir, `astro/${file}`), source);
  }
  write(join(outDir, 'astro/index.js'), "export { default as Icon } from './Icon.astro';\n");
  write(
    join(outDir, 'astro/index.d.ts'),
    [
      "import type { IconData, IconProps } from '../shared/index.js';",
      "export type { IconData, IconProps } from '../shared/index.js';",
      'export type AstroIconProps = IconProps & { icon: IconData; class?: string; [attribute: string]: unknown };',
      '/** The Astro component. Import it in an `.astro` file and pass `icon`. */',
      'export declare function Icon(props: AstroIconProps): unknown;',
      '',
    ].join('\n'),
  );

  for (const runtime of ['react/index.js', 'wc/index.js', 'shared/index.js', 'react-native/index.js', 'angular/index.js', 'solid/index.js', 'preact/index.js']) {
    try {
      readFileSync(join(outDir, runtime));
    } catch {
      throw new Error(`${runtime} is missing from ${outDir}: run tsc -p tsconfig.build.json and ngc -p tsconfig.angular.json first`);
    }
  }
}

export interface NamedIcon {
  readonly exportName: string;
  readonly data: IconData;
}

export interface ReadPack {
  readonly icons: NamedIcon[];
  /** Source SVGs at `ref`, before exclusions. */
  readonly inputs: number;
  readonly excluded: string[];
}

/** Reads, checks and prefixes one pack. The `exclude` entries are honoured only while they are still rejected. */
export function readPackWithCounts(pack: PackConfig, root: string, options: { prefix?: boolean } = {}): ReadPack {
  const dir = resolveSource(pack, root);
  const all = listSvgs(dir, pack);
  if (all.length < pack.minIcons) {
    throw new Error(`${pack.id}: ${all.length} SVGs at ${pack.ref.slice(0, 12)}:${pack.path}, below the floor of ${pack.minIcons}`);
  }
  const excludes = new Map((pack.exclude ?? []).map((e) => [`${pack.path.replace(/\/$/, '')}/${e.path}`, e.reason]));
  for (const path of excludes.keys()) {
    if (!all.some((f) => f.path === path)) throw new Error(`${pack.id}: exclude entry ${path} names no SVG at ${pack.ref.slice(0, 12)}`);
  }
  const blobs = readBlobs(dir, all.map((f) => f.blob));
  for (const path of excludes.keys()) {
    const file = all.find((f) => f.path === path);
    try {
      sanitiseSvg(blobs.get(file?.blob as string) as string);
    } catch (e) {
      if (e instanceof SvgRejected) continue;
      throw e;
    }
    throw new Error(`${pack.id}: exclude entry ${path} now passes the policy; remove it from packs.json`);
  }
  const files = all.filter((f) => !excludes.has(f.path));
  const rejected: string[] = [];

  const icons = assignNames(files, pack.defaultSet).flatMap((file): NamedIcon[] => {
    try {
      const checked = sanitiseSvg(blobs.get(file.blob) as string);
      const svg = options.prefix === false ? checked : prefixIds(checked, idPrefix(pack.id, file.set, file.name));
      return [{
        exportName: file.exportName,
        data: {
          id: `${pack.id}:${file.set}/${file.name}`,
          pack: pack.id,
          set: file.set,
          name: file.name,
          kind: pack.kind,
          attrs: svg.rootAttrs,
          stroked: 'stroke-width' in svg.rootAttrs,
          size: svg.size,
          nodes: svg.nodes,
        },
      }];
    } catch (e) {
      if (!(e instanceof SvgRejected)) throw e;
      rejected.push(`${file.path}: ${e.message}`);
      return [];
    }
  });

  if (rejected.length > 0) {
    throw new Error(`${pack.id}: ${rejected.length} SVG(s) rejected by the policy:\n  ${rejected.slice(0, 20).join('\n  ')}`);
  }
  return { icons, inputs: all.length, excluded: [...excludes.keys()] };
}

export function readPack(pack: PackConfig, root: string, options: { prefix?: boolean } = {}): NamedIcon[] {
  return readPackWithCounts(pack, root, options).icons;
}

/**
 * Where each flavour the format registry does not list yet writes its pack modules, and how. A
 * `bind` flavour wraps each icon in a component with the named factory from its template; a data
 * flavour (one generic component that takes `icon`) re-exports each icon's data by name, so the
 * count guard reads one line per icon either way.
 */
export const PENDING_OUTPUTS: Readonly<Record<PendingFlavour, { readonly dir: string; readonly bind?: string; readonly type: string }>> = {
  reactNative: { dir: 'react-native', bind: 'createIcon', type: 'NativeIchavaIcon' },
  angular: { dir: 'angular', type: 'IconData' },
  solid: { dir: 'solid', bind: 'createIcon', type: 'SolidIcon' },
  preact: { dir: 'preact', bind: 'createIcon', type: 'PreactIcon' },
  astro: { dir: 'astro', type: 'IconData' },
};

/** Directories under dist/ that each get a copy of a pack's attribution files. */
export const ATTRIBUTION_DIRS: readonly string[] = ['data', 'react', 'vue', 'svelte', 'wc', ...PENDING_FLAVOURS.map((f) => PENDING_OUTPUTS[f].dir)];

/**
 * A legal comment (`/*!`), which bundlers keep, so the artwork's licence reaches a consumer's
 * bundle along with the icons. The generator's own code stays MIT; the art keeps its licence.
 */
const header = (pack: PackConfig, attributionFrom: string): string =>
  `// Generated by @ichava/js-icon-components from ${pack.repository} at ${pack.ref}. Do not edit.\n` +
  (pack.attribution.length > 0
    ? `/*! ${pack.id} artwork: ${pack.licence}. Attribution and licence: ${pack.attribution.map((f) => `${attributionFrom}/${f.split('/').pop()}`).join(', ')} */\n`
    : `/*! ${pack.id} artwork: ${pack.licence}. */\n`);

function emitAttribution(pack: PackConfig, root: string, outDir: string, dirs: readonly string[]): string[] {
  const dir = resolveSource(pack, root);
  const written: string[] = [];
  for (const file of pack.attribution) {
    const body = readFileAt(dir, pack, file);
    if (body.length === 0) throw new Error(`${pack.id}: ${file} is empty at ${pack.ref.slice(0, 12)}`);
    const name = file.split('/').pop() as string;
    for (const flavourDir of dirs) {
      const rel = `${flavourDir}/${pack.id}/${name}`;
      write(join(outDir, rel), body.toString('utf8'));
      written.push(rel);
    }
  }
  return written;
}

function emitPack(pack: PackConfig, icons: NamedIcon[], outDir: string, flavours: ReadonlySet<AnyFlavour>): void {
  // Modules sit at <flavour>/packs/<pack>.js (Svelte: <flavour>/packs/<pack>/index.js), the files at <flavour>/<pack>/.
  const h = header(pack, `../${pack.id}`);
  const names = icons.map((i) => i.exportName);
  const lines = (f: (name: string) => string): string => names.map(f).join('\n') + '\n';

  const hd = header(pack, `./${pack.id}`);
  write(join(outDir, `data/${pack.id}.js`), hd + icons.map((i) => `export const ${i.exportName} = ${JSON.stringify(i.data)};`).join('\n') + '\n');
  write(join(outDir, `data/${pack.id}.d.ts`), hd + "import type { IconData } from '../shared/index.js';\n" + lines((n) => `export declare const ${n}: IconData;`));

  const bind = (fn: string): string =>
    h + `import { ${fn} } from '../index.js';\nimport * as d from '../../data/${pack.id}.js';\n` + lines((n) => `export const ${n} = /*#__PURE__*/ ${fn}(d.${n});`);

  if (flavours.has('react')) {
    write(join(outDir, `react/packs/${pack.id}.js`), bind('createIcon'));
    write(join(outDir, `react/packs/${pack.id}.d.ts`), h + "import type { IchavaIcon } from '../index.js';\n" + lines((n) => `export declare const ${n}: IchavaIcon;`));
  }

  if (flavours.has('vue')) {
    write(join(outDir, `vue/packs/${pack.id}.js`), bind('defineIcon'));
    write(join(outDir, `vue/packs/${pack.id}.d.ts`), h + "import type { VueIcon } from '../index.js';\n" + lines((n) => `export declare const ${n}: VueIcon;`));
  }

  if (flavours.has('svelte')) {
    const svelteDir = join(outDir, `svelte/packs/${pack.id}`);
    const hs = header(pack, `../../${pack.id}`);
    for (const n of names) {
      write(
        join(svelteDir, `${n}.svelte`),
        `<script>\n  import Icon from '../../Icon.svelte';\n  import { ${n} as icon } from '../../../data/${pack.id}.js';\n  let props = $props();\n</script>\n\n<Icon {...props} {icon} />\n`,
      );
    }
    write(join(svelteDir, 'index.js'), hs + lines((n) => `export { default as ${n} } from './${n}.svelte';`));
    write(join(svelteDir, 'index.d.ts'), hs + "import type { SvelteIcon } from '../../index.js';\n" + lines((n) => `export declare const ${n}: SvelteIcon;`));
  }

  if (flavours.has('webcomponent')) {
    write(join(outDir, `wc/packs/${pack.id}.js`), h + `export * from '../../data/${pack.id}.js';\n`);
    write(join(outDir, `wc/packs/${pack.id}.d.ts`), h + `export * from '../../data/${pack.id}.js';\n`);
  }

  for (const flavour of PENDING_FLAVOURS) {
    if (!flavours.has(flavour)) continue;
    const { dir, bind: factory, type } = PENDING_OUTPUTS[flavour];
    if (factory !== undefined) {
      write(join(outDir, `${dir}/packs/${pack.id}.js`), bind(factory));
      write(join(outDir, `${dir}/packs/${pack.id}.d.ts`), h + `import type { ${type} } from '../index.js';\n` + lines((n) => `export declare const ${n}: ${type};`));
    } else {
      write(join(outDir, `${dir}/packs/${pack.id}.js`), h + `import * as d from '../../data/${pack.id}.js';\n` + lines((n) => `export const ${n} = d.${n};`));
      write(join(outDir, `${dir}/packs/${pack.id}.d.ts`), h + "import type { IconData } from '../../shared/index.js';\n" + lines((n) => `export declare const ${n}: IconData;`));
    }
  }
}

/** Counts what was written, from the files, so the count guard is not the generator agreeing with itself. */
export function countOutputs(outDir: string, packId: string, flavours: readonly AnyFlavour[] = ALL_FLAVOURS): Partial<Record<AnyFlavour, number>> {
  const exportsIn = (file: string): number => (readFileSync(join(outDir, file), 'utf8').match(/^export const Icon\w+ = /gm) ?? []).length;
  const count = (flavour: AnyFlavour): number => {
    if (flavour === 'svelte') return readdirSync(join(outDir, `svelte/packs/${packId}`)).filter((f) => /^Icon\w+\.svelte$/.test(f)).length;
    if (flavour === 'webcomponent') return exportsIn(`data/${packId}.js`);
    return exportsIn(`${FLAVOUR_DIRS[flavour]}/packs/${packId}.js`);
  };
  return Object.fromEntries(flavours.map((f) => [f, count(f)]));
}

/** Each flavour's directory under dist/, which is also its subpath: `webcomponent` is `wc`. */
export const FLAVOUR_DIRS: Readonly<Record<AnyFlavour, string>> = {
  react: 'react',
  vue: 'vue',
  svelte: 'svelte',
  webcomponent: 'wc',
  ...(Object.fromEntries(PENDING_FLAVOURS.map((f) => [f, PENDING_OUTPUTS[f].dir])) as Record<PendingFlavour, string>),
};

const list = (value: string | undefined): string[] => [...new Set((value ?? '').split(',').map((v) => v.trim()).filter(Boolean))];

/**
 * Reads a selection from the two variables. Unset or empty means every pack, or every flavour. A
 * flavour is named by its subpath (`wc`, `react-native`) or its registry id (`webcomponent`,
 * `reactNative`). An unknown name fails the build, listing the valid ones.
 */
export function parseSelection(env: { readonly packs?: string; readonly flavours?: string }, packIds: readonly string[]): Selection {
  const packs = list(env.packs);
  for (const p of packs) {
    if (!packIds.includes(p)) throw new Error(`${SELECTION_ENV.packs}: unknown pack "${p}". The packs are ${packIds.join(', ')}.`);
  }
  const byName = new Map<string, AnyFlavour>(ALL_FLAVOURS.flatMap((f) => [[f, f], [FLAVOUR_DIRS[f], f]] as [string, AnyFlavour][]));
  const flavours = list(env.flavours).map((name) => {
    const f = byName.get(name);
    if (f === undefined) throw new Error(`${SELECTION_ENV.flavours}: unknown flavour "${name}". The flavours are ${ALL_FLAVOURS.map((x) => FLAVOUR_DIRS[x]).join(', ')}.`);
    return f;
  });
  return {
    packs: packs.length === 0 ? [...packIds] : packIds.filter((p) => packs.includes(p)),
    flavours: flavours.length === 0 ? [...ALL_FLAVOURS] : ALL_FLAVOURS.filter((f) => flavours.includes(f)),
  };
}

/** The error an unbuilt module throws: what is missing, what was built, and the variable that adds it. */
export function unbuiltMessage(missing: { readonly pack?: string; readonly flavour?: AnyFlavour }, selection: Selection): string {
  const subject = [
    missing.pack === undefined ? '' : `the "${missing.pack}" pack`,
    missing.flavour === undefined ? '' : `the "${FLAVOUR_DIRS[missing.flavour]}" flavour`,
  ].filter(Boolean);
  const set = [
    missing.pack === undefined ? '' : `${SELECTION_ENV.packs}=${[...selection.packs, missing.pack].join(',')}`,
    missing.flavour === undefined ? '' : `${SELECTION_ENV.flavours}=${[...selection.flavours, missing.flavour].map((f) => FLAVOUR_DIRS[f]).join(',')}`,
  ].filter(Boolean);
  return (
    `@ichava/js-icon-components: ${subject.join(' and ')} ${subject.length > 1 ? 'were' : 'was'} not built by this install, ` +
    `which built the packs ${selection.packs.join(', ')} for the flavours ${selection.flavours.map((f) => FLAVOUR_DIRS[f]).join(', ')}. ` +
    `Reinstall with ${set.join(' and ')} (or the same list under "ichava.icons" in your package.json), ` +
    'or install the prebuilt release tarball, which has every pack and flavour.'
  );
}

/**
 * A module standing in for one that was not built. It exports every name the real one would, so a
 * named import links, and then throws `message` when it is evaluated. The names are local exports
 * rather than a re-export, so a bundler honouring `sideEffects: false` cannot skip the throw.
 */
export function stubModule(message: string, names: readonly string[]): string {
  return (
    '// Not built by this install. See the error below.\n' +
    'let unbuilt;\n' +
    `export {\n${names.map((n) => `  unbuilt as ${n},`).join('\n')}\n};\n` +
    `throw new Error(${JSON.stringify(message)});\n`
  );
}

/** The names a module exports, read by esbuild without bundling. */
function exportNames(file: string): string[] {
  const result = buildSync({ entryPoints: [file], bundle: false, write: false, metafile: true, format: 'esm', outdir: dirname(file), logLevel: 'silent' });
  return Object.values(result.metafile.outputs).flatMap((o) => o.exports);
}

/** A pack's export names, from its git listing alone: no SVG is read or checked. */
export function packNames(pack: PackConfig, root: string): string[] {
  const dir = resolveSource(pack, root);
  const excluded = new Set((pack.exclude ?? []).map((e) => `${pack.path.replace(/\/$/, '')}/${e.path}`));
  return assignNames(listSvgs(dir, pack).filter((f: SourceSvg) => !excluded.has(f.path)), pack.defaultSet).map((f) => f.exportName);
}

/** Writes the stand-ins for one pack: its data module when the pack is unbuilt, and each unbuilt flavour's module. */
function emitPackStubs(pack: PackConfig, names: readonly string[], outDir: string, selection: Selection, built: boolean): void {
  write(join(outDir, `unbuilt/${pack.id}.d.ts`), `// Not built by this install.\n${names.map((n) => `export declare const ${n}: never;`).join('\n')}\n`);
  const at = (file: string, message: string, depth: number): void => {
    write(join(outDir, `${file}.js`), stubModule(message, names));
    write(join(outDir, `${file}.d.ts`), `export * from '${'../'.repeat(depth)}unbuilt/${pack.id}.js';\n`);
  };
  if (!built) at(`data/${pack.id}`, unbuiltMessage({ pack: pack.id }, selection), 1);
  for (const flavour of ALL_FLAVOURS) {
    if (built && selection.flavours.includes(flavour)) continue;
    const missing = { ...(built ? {} : { pack: pack.id }), ...(selection.flavours.includes(flavour) ? {} : { flavour }) };
    if (flavour === 'svelte') at(`svelte/packs/${pack.id}/index`, unbuiltMessage(missing, selection), 3);
    else at(`${FLAVOUR_DIRS[flavour]}/packs/${pack.id}`, unbuiltMessage(missing, selection), 2);
  }
}

export function generate(options: GenerateOptions): Manifest {
  const packs = loadPacks(options.packsFile ?? join(options.root, 'packs.json'));
  const selection = options.selection ?? { packs: packs.map((p) => p.id), flavours: ALL_FLAVOURS };
  const flavours = new Set(selection.flavours);
  emitRuntimes(options.root, options.outDir);

  const manifest: Manifest = {
    flavours: selection.flavours,
    packs: [],
    unbuilt: { packs: packs.map((p) => p.id).filter((p) => !selection.packs.includes(p)), flavours: ALL_FLAVOURS.filter((f) => !flavours.has(f)) },
  };
  for (const pack of packs) {
    if (!selection.packs.includes(pack.id)) {
      emitPackStubs(pack, packNames(pack, options.root), options.outDir, selection, false);
      continue;
    }
    const { icons, inputs, excluded } = readPackWithCounts(pack, options.root);
    emitPack(pack, icons, options.outDir, flavours);
    if (flavours.size < ALL_FLAVOURS.length) emitPackStubs(pack, icons.map((i) => i.exportName), options.outDir, selection, true);
    const attribution = emitAttribution(pack, options.root, options.outDir, ['data', ...selection.flavours.map((f) => FLAVOUR_DIRS[f])]);
    const outputs = countOutputs(options.outDir, pack.id, selection.flavours);
    for (const flavour of selection.flavours) {
      if (outputs[flavour] !== inputs - excluded.length) {
        throw new Error(`${pack.id}: ${flavour} wrote ${outputs[flavour]} icons for ${inputs} inputs less ${excluded.length} excluded`);
      }
    }
    manifest.packs.push({ id: pack.id, repository: pack.repository, ref: pack.ref, licence: pack.licence, inputs, excluded, outputs, attribution });
  }

  // An unbuilt flavour's entry point (`./vue`) throws too, with the names its runtime exports.
  for (const flavour of manifest.unbuilt.flavours) {
    const file = join(options.outDir, FLAVOUR_DIRS[flavour], 'index.js');
    write(file, stubModule(unbuiltMessage({ flavour }, selection), exportNames(file)));
  }

  write(join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
