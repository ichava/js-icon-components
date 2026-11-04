import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { transformSync } from 'esbuild';
import { compile as compileSvelte } from 'svelte/compiler';
import { compileScript, compileTemplate, parse as parseSfc } from 'vue/compiler-sfc';
import { FLAVOURS, type Flavour, type IconData } from '../shared/index.ts';
import { assignNames } from './naming.ts';
import { listSvgs, loadPacks, readBlobs, resolveSource, type PackConfig } from './packs.ts';
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
  readonly inputs: number;
  readonly outputs: Record<Flavour, number>;
}

export interface Manifest {
  readonly flavours: readonly Flavour[];
  readonly packs: PackManifest[];
}

export interface GenerateOptions {
  /** Package root: holds packs.json, src/ and the sibling checkouts' parent. */
  readonly root: string;
  /** Output directory, normally `<root>/dist`. The flavour runtimes from tsc must already be there. */
  readonly outDir: string;
  readonly packsFile?: string;
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

  for (const runtime of ['react/index.js', 'wc/index.js', 'shared/index.js']) {
    try {
      readFileSync(join(outDir, runtime));
    } catch {
      throw new Error(`${runtime} is missing from ${outDir}: run tsc -p tsconfig.build.json first`);
    }
  }
}

export interface NamedIcon {
  readonly exportName: string;
  readonly data: IconData;
}

export function readPack(pack: PackConfig, root: string): NamedIcon[] {
  const dir = resolveSource(pack, root);
  const files = listSvgs(dir, pack);
  if (files.length < pack.minIcons) {
    throw new Error(`${pack.id}: ${files.length} SVGs at ${pack.ref.slice(0, 12)}:${pack.path}, below the floor of ${pack.minIcons}`);
  }
  const blobs = readBlobs(dir, files.map((f) => f.blob));
  const rejected: string[] = [];

  const icons = assignNames(files, pack.defaultSet).flatMap((file): NamedIcon[] => {
    try {
      const svg = sanitiseSvg(blobs.get(file.blob) as string);
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
  return icons;
}

const header = (pack: PackConfig): string =>
  `// Generated by @ichava/js-icon-components from ${pack.repository} at ${pack.ref}. Do not edit.\n`;

function emitPack(pack: PackConfig, icons: NamedIcon[], outDir: string): void {
  const h = header(pack);
  const names = icons.map((i) => i.exportName);
  const lines = (f: (name: string) => string): string => names.map(f).join('\n') + '\n';

  write(join(outDir, `data/${pack.id}.js`), h + icons.map((i) => `export const ${i.exportName} = ${JSON.stringify(i.data)};`).join('\n') + '\n');
  write(join(outDir, `data/${pack.id}.d.ts`), h + "import type { IconData } from '../shared/index.js';\n" + lines((n) => `export declare const ${n}: IconData;`));

  const bind = (fn: string): string =>
    h + `import { ${fn} } from '../index.js';\nimport * as d from '../../data/${pack.id}.js';\n` + lines((n) => `export const ${n} = /*#__PURE__*/ ${fn}(d.${n});`);

  write(join(outDir, `react/packs/${pack.id}.js`), bind('createIcon'));
  write(join(outDir, `react/packs/${pack.id}.d.ts`), h + "import type { IchavaIcon } from '../index.js';\n" + lines((n) => `export declare const ${n}: IchavaIcon;`));

  write(join(outDir, `vue/packs/${pack.id}.js`), bind('defineIcon'));
  write(join(outDir, `vue/packs/${pack.id}.d.ts`), h + "import type { VueIcon } from '../index.js';\n" + lines((n) => `export declare const ${n}: VueIcon;`));

  const svelteDir = join(outDir, `svelte/packs/${pack.id}`);
  for (const n of names) {
    write(
      join(svelteDir, `${n}.svelte`),
      `<script>\n  import Icon from '../../Icon.svelte';\n  import { ${n} as icon } from '../../../data/${pack.id}.js';\n  let props = $props();\n</script>\n\n<Icon {...props} {icon} />\n`,
    );
  }
  write(join(svelteDir, 'index.js'), h + lines((n) => `export { default as ${n} } from './${n}.svelte';`));
  write(join(svelteDir, 'index.d.ts'), h + "import type { SvelteIcon } from '../../index.js';\n" + lines((n) => `export declare const ${n}: SvelteIcon;`));

  write(join(outDir, `wc/packs/${pack.id}.js`), h + `export * from '../../data/${pack.id}.js';\n`);
  write(join(outDir, `wc/packs/${pack.id}.d.ts`), h + `export * from '../../data/${pack.id}.js';\n`);
}

/** Counts what was written, from the files, so the count guard is not the generator agreeing with itself. */
export function countOutputs(outDir: string, packId: string): Record<Flavour, number> {
  const exportsIn = (file: string): number => (readFileSync(join(outDir, file), 'utf8').match(/^export const Icon\w+ = /gm) ?? []).length;
  return {
    react: exportsIn(`react/packs/${packId}.js`),
    vue: exportsIn(`vue/packs/${packId}.js`),
    svelte: readdirSync(join(outDir, `svelte/packs/${packId}`)).filter((f) => /^Icon\w+\.svelte$/.test(f)).length,
    webcomponent: exportsIn(`data/${packId}.js`),
  };
}

export function generate(options: GenerateOptions): Manifest {
  const packs = loadPacks(options.packsFile ?? join(options.root, 'packs.json'));
  emitRuntimes(options.root, options.outDir);

  const manifest: Manifest = { flavours: FLAVOURS, packs: [] };
  for (const pack of packs) {
    const icons = readPack(pack, options.root);
    emitPack(pack, icons, options.outDir);
    const outputs = countOutputs(options.outDir, pack.id);
    for (const flavour of FLAVOURS) {
      if (outputs[flavour] !== icons.length) {
        throw new Error(`${pack.id}: ${flavour} wrote ${outputs[flavour]} icons for ${icons.length} inputs`);
      }
    }
    manifest.packs.push({ id: pack.id, repository: pack.repository, ref: pack.ref, inputs: icons.length, outputs });
  }

  write(join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
