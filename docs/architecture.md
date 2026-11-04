# Architecture

How a pinned pack becomes four flavours of components, and what keeps the output honest.

## Why a generator?

The icons already exist as SVG files in each pack, and the browser already shows a code tab for
React, Vue, Svelte and the Web Component. Writing those components by hand is out of the question
at 17,365 icons across four packs, and the alternatives each lose something:

- **Raw SVG strings plus `innerHTML`** ship whatever markup the source holds, and trip Trusted
  Types. Here the markup is parsed and checked at build time, and every flavour renders from the
  parsed tree, so no string of source markup reaches a page.
- **A runtime fetch from the API** makes an application depend on a server for its own icons and
  breaks offline builds. Here the input is a git commit, and the output is a module.
- **One package per flavour per pack** multiplies repositories and release cadences. Here one
  repository and one generator serve every pack and flavour, and adding either is configuration.

The generator writes data and one binding line per icon. The rendering code is four templates,
so a change to how icons render is one file, reviewed once, not thousands of regenerated ones.

## Pipeline

```text
packs.json ─▶ git at the pinned commit ─▶ SVG gate ─▶ id prefix ─▶ IconData ─▶ data/<pack>.js
                                                              ├▶ react/packs/<pack>.js   createIcon(data)
                                                              ├▶ vue/packs/<pack>.js     defineIcon(data)
                                                              ├▶ svelte/packs/<pack>/*.svelte
                                                              ├▶ wc/packs/<pack>.js      re-exports the data
                                                              └▶ <flavour>/<pack>/       ATTRIBUTION.md, LICENSE
```

| Part | File |
|---|---|
| Pack input | `src/generator/packs.ts` |
| SVG gate | `src/generator/sanitize.ts`, `src/generator/svgPolicy.ts` |
| Id prefixing | `src/generator/ids.ts` |
| Names | `src/generator/naming.ts` |
| Emit and count | `src/generator/generate.ts` |
| Shared contract | `src/shared/index.ts` (`IconData`, `IconProps`, `rootAttributes`) |
| Templates | `src/react/index.tsx`, `src/vue/Icon.vue`, `src/svelte/Icon.svelte`, `src/wc/index.ts`, `src/react-native/index.tsx`, `src/angular/icon.component.ts`, `src/solid/index.ts`, `src/preact/index.tsx`, `src/astro/Icon.astro` |

## Input is a pinned commit

Each pack in `packs.json` names a repository and a full commit SHA. The generator reads that
commit from git (`ls-tree`, then one `cat-file --batch`), never a working tree and never the live
API: from the sibling checkout when it holds the commit, otherwise from a shallow fetch of that one
commit into `.cache/packs/<id>`. A branch or tag is refused, because either could move under a
build.

## The SVG gate

It applies `ichava/core`'s `svg-policy.json` (vendored, digest-pinned): the element and attribute
allow-lists, `href` to a `#fragment` only, CSS values checked by the same functions
react-icon-browser uses (copied verbatim), and core's caps of 30,000 elements and 4,500,000 bytes.

It **rejects** where core strips. A runtime sanitiser must render something for a user who is
waiting; a build-time gate has no such user, so an icon the policy would alter fails the build and
names itself. Source `<title>`, `<desc>` and `<metadata>` are dropped, because the component's
`title` prop is the accessible name.

A pack may list an SVG the gate rejects under `exclude`, with a reason. The entry is a ceiling,
not a licence: an entry naming no file, or a file that now passes, fails the build.

## Ids

Every `id`, and every `url(#…)`, `href`, `xlink:href` and ARIA id reference to it, is rewritten to
`<pack>_<set>_<name>_<id>` after the gate, on the parsed tree. Pack and set ids cannot contain `_`
and the name has it replaced, so a prefix names one icon, and the export-name guard already
refuses two icons with one name. See [Packs](packs.md#ids-are-prefixed-per-icon).

## Artwork licences

The generator is MIT; the art keeps its licence. Each pack names its artwork's SPDX expression and
the files that travel with it, read at the pinned commit and copied to `dist/<flavour>/<pack>/`,
and every generated module opens with a `/*!` legal comment naming both. A CC-BY or CC-BY-SA pack
with no attribution files is refused when `packs.json` loads.

## The guards

| Guard | Test |
|---|---|
| Hostile SVGs are rejected (27 vectors) | `tests/sanitize.test.ts` |
| Per pack, output per flavour equals the input count from git, less listed exclusions, above `minIcons` | `tests/generate.test.ts` |
| No id repeats on a page holding two icons from one pack, or from two packs; every id carries its icon's prefix; prefixing breaks no reference | `tests/page-ids.test.ts`, `tests/ids.test.ts` |
| Every multi-colour flag and emoji renders every source colour, in order; three are snapshotted | `tests/colours.test.ts` |
| Attribution and licence files ship beside every flavour of every pack, and name the CC licence | `tests/generate.test.ts` |
| Every flavour is a `generated` format in icon-browser's registry, and the reverse; all nine, Tier 2 included | `tests/registry.test.ts` |
| Each template compiles with its framework's compiler, or type-checks where none applies, and renders three icons | `tests/<flavour>.test.ts` |
| No lock file is tracked | `tests/lockfile.test.ts` |
| Vendored policy and schema match their digests and siblings | `tests/vendored.test.ts` |

Each was seen failing before it was trusted, and each counts what it inspected so an empty input
cannot pass.

## Why a prebuilt tarball and a git build?

A git install has to compile: npm clones the repository, installs every development dependency
and runs `prepare`, because nothing generated is committed. That is a minute and a set of
compilers for output that is the same for every consumer of a tag. So `release.yml` builds it once
and attaches `npm pack` output to the release, and the default install is that tarball: nothing to
compile, no `git`, no configuration.

The git build stays for an application that wants less than everything or an unreleased commit.
`ICHAVA_ICONS_PACKS` and `ICHAVA_ICONS_FLAVOURS` (or `"ichava.icons"` in its `package.json`) limit
what the generator writes. Everything left out keeps its subpath as a stand-in module that exports
the real names, so a named import links, and throws naming the variable that adds it. The names are
local exports rather than an `export *`, because a bundler honouring `sideEffects: false` may skip
a module that only re-exports, and with it the throw. Exports are one map for every install, so a
missing subpath is never a missing file.

One package name for every tarball keeps the import paths the same whichever one is installed. The
cost is that two per-pack tarballs cannot sit side by side; the full tarball or a git build covers
that case.

## Tier 2 flavours

React Native (`reactNative`), Angular (`angular`), SolidJS (`solid`), Preact (`preact`) and Astro
(`astro`) are generated, counted, exported and tested like the first four. icon-browser's format
registry lists their ids since schema 1.5.0, so the registry guard (`tests/registry.test.ts`)
requires every one of the nine. They stay in `PENDING_FLAVOURS` (`src/shared/index.ts`) only because
the generator writes them through `PENDING_OUTPUTS`.

| Flavour | Compiled or checked by | Rendered by |
|---|---|---|
| React Native | `tsc`; esbuild TSX in the test | `react-dom/server`, with a host-element stand-in for `react-native-svg` |
| Angular | `ngc`, partial mode | `@angular/platform-server`, linked by `@angular/compiler` |
| SolidJS | `tsc` (no JSX: nothing for `babel-preset-solid` to compile) | Solid's server build, and its client build in jsdom |
| Preact | `tsc`; esbuild TSX with Preact's JSX runtime in the test | `preact-render-to-string` |
| Astro | `@astrojs/compiler-rs`, at build and in the test | Astro's container API |

## Illustrations

`IconData.kind` carries `illustration`, and the props are designed: `primaryColor` for the
accent and `variant` for the light and dark twins. They are not built yet, because no
illustration pack is public and an unused prop would be an untested one. The first illustration
pack in `packs.json` brings them, with snapshots, in the same change.

---

[← Docs index](../README.md#documentation)
