# Installation

Two ways in: the prebuilt tarball from a GitHub release (the default, nothing to build or
configure), or a build from a git tag that you can limit to the packs and flavours you use.

## From the release tarball

```bash
npm install https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-0.1.0.tgz
```

```json
{
  "dependencies": {
    "@ichava/js-icon-components": "https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-0.1.0.tgz"
  }
}
```

The tarball is `npm pack` output, built once by `release.yml` when the release is tagged. It
holds `dist/` for every pack, flavour and asset export and nothing else: no source, no tests, and no
dependencies. npm runs no build for a tarball, so no compiler, `git` or network access to the
packs is needed. Then import the flavour you use, as in the [README](../README.md#quick-start-guide-and-usage).

### One pack only

Each release also attaches one tarball per pack, built with every flavour and export. Each is its
own package, `@ichava/js-icon-components-<pack>`, with the same subpaths as the full one, so two
or more install side by side:

```bash
npm install \
  https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-tabler-0.1.0.tgz \
  https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-flag-0.1.0.tgz
```

```ts
import { IconMug } from '@ichava/js-icon-components-tabler/react/tabler';
import { IconKe } from '@ichava/js-icon-components-flag/react/flag';
```

An import of another pack from a per-pack package throws, naming the pack. Moving from a per-pack
tarball to the full one changes the package name in your imports. Until this release every per-pack
tarball shared the full package's name, so npm kept only one of them; `tests/per-pack-tarball.test.ts`
installs two and imports from both.

`SHA256SUMS` on the release lists the checksum of every tarball.

## From a git tag

```bash
npm install "github:ichava/js-icon-components#v0.1.0"
```

npm clones the repository, installs its development dependencies (the compilers) in a temporary
directory and runs `prepare`, which is `scripts/prepare.mjs`:

1. If `dist/` is already built, it does nothing.
2. If `ICHAVA_ICONS_SKIP_BUILD=1`, it does nothing.
3. Otherwise it runs `npm run build`: `tsc` and Angular's `ngc` compile the templates, then the
   generator reads each selected pack at its pinned commit, from a shallow `git fetch` of exactly
   that commit, checks every SVG against the policy and writes the modules.

So `git` must be on the path and `github.com` reachable. Only `dist/` reaches your
`node_modules`; the compilers stay in npm's temporary clone. Pin a tag, never a branch: a tag is
final and never moves.

### Choosing what to build

| Variable | `package.json` key | Effect |
|---|---|---|
| `ICHAVA_ICONS_PACKS=tabler,flag` | `"packs": ["tabler", "flag"]` | builds only those packs |
| `ICHAVA_ICONS_FLAVOURS=react,css-mask` | `"flavours": ["react", "css-mask"]` | builds only those flavours and exports |
| `ICHAVA_ICONS_SKIP_BUILD=1` | `"skipBuild": true` | builds nothing |

Packs are `tabler`, `flag`, `emoji` and `openmoji`. Flavours are named by their subpath: `react`,
`vue`, `svelte`, `wc`, `react-native`, `angular`, `solid`, `preact`, `astro`, `qwik`, `ember` and
`elm` (the registry ids `webcomponent` and `reactNative` work too). The asset exports go in the same
list, by registry id: `css-mask`, `data-uri`, `flutter`, `swiftui` and `android-vd`. There is no
PNG export: `png-zip` was dropped with icon-browser's schema 1.7.0 (owner decision, 2026-11-04).
Unset or empty means everything; a list builds exactly what it names, so `react` alone builds no
export and `css-mask` alone builds no flavour. An unknown name fails the install, listing the valid
ones. An Elm module or an export that was not built is simply absent: neither is a JavaScript module,
so neither has a stand-in.

The keys live under `"ichava"` → `"icons"` in the installing application's `package.json`, as an
array or a comma-separated string. A variable that is set wins over the file:

```json
{
  "ichava": {
    "icons": { "packs": ["tabler"], "flavours": ["react"] }
  }
}
```

npm installs a git dependency only once, so after changing the selection remove
`node_modules/@ichava/js-icon-components` and install again.

### What an unbuilt import does

A pack or flavour left out still has its subpath, as a stand-in module. It exports every name the
real one would, so a named import links, then throws when it is evaluated:

```text
Error: @ichava/js-icon-components: the "vue" flavour was not built by this install, which built
the packs tabler for the flavours react. Reinstall with ICHAVA_ICONS_FLAVOURS=react,vue (or the
same list under "ichava.icons" in your package.json), or install the prebuilt release tarball,
which has every pack and flavour.
```

The stand-ins take up to about 6 MB, a fraction of the icons they replace. Two imports have no stand-in
and fail with the bundler's own "not found" error instead: a per-icon Svelte deep import
(`/svelte/tabler/IconMug.svelte`) of a pack or flavour that was not built, because a stand-in per
icon would cost what the selection saves; and everything after `ICHAVA_ICONS_SKIP_BUILD=1`, which
writes no `dist/` at all.

## Size and time

Measured 2026-11-04 on an Apple-silicon laptop with Node 24.17 and npm 11.13, a warm npm cache,
the four packs (17,365 icons), twelve flavours and five asset exports, after the PNG export was dropped. Install times are wall-clock
for a fresh application, offline for a tarball and from GitHub for a git build; on disk is `du`, which is larger than the
byte count because each small file takes at least one 4 KB block.

| Install | Download | Unpacked | On disk | Files | Time |
|---|---:|---:|---:|---:|---:|
| Release tarball, full | 62.3 MB | 266.1 MB | 319 MB | 17,632 | 19 s |
| Release tarball, `tabler` | 9.8 MB | 45.3 MB | 67 MB | 6,450 | 7 s |
| Release tarball, `flag` | 9.2 MB | 31.8 MB | 32 MB | 721 | 2 s |
| Release tarball, `emoji` | 16.8 MB | 65.8 MB | 75 MB | 3,614 | 4 s |
| Release tarball, `openmoji` | 29.7 MB | 151.6 MB | 171 MB | 7,324 | 8 s |
| Git, every pack, flavour and export | | | 319 MB | 17,632 | 69 s |
| Git, `tabler` for `react,css-mask` | | | 17 MB | 166 | 24 s |
| Git, `ICHAVA_ICONS_SKIP_BUILD=1` | | | 0 | 3 | 17 s |

Before the Tier 3 flavours and the exports (0.1.0 as merged in #5), the full tarball was 7.0 MB to
download and 64.2 MB unpacked. The exports are most of the difference, and they are already
compressed (the zips) or large text (the CSS and JSON), so gzip barely shrinks the tarball:

| Export | All four packs | Generated in |
|---|---:|---:|
| CSS mask (`icons.css`) | 37.0 MB | 0.8 s |
| Data URI (`data-uri.json`) | 36.5 MB | 0.8 s |
| Flutter (`flutter.zip`) | 16.1 MB | 1.0 s |
| SwiftUI (`swiftui.zip`) | 23.7 MB | 1.4 s |
| Android (`android-vd.zip`) | 16.7 MB | 1.8 s |

The whole build (`npm run build`: `tsc`, `ngc`, then the generator for every pack, flavour and
export) takes about 15 s, of which generation is 11 to 12 s (27 s and 24 s while it still rasterised PNGs); a git build that names only the flavours it uses
writes no export at all. About 14 seconds of every git install is npm installing the development
dependencies in its temporary clone, which no selection avoids. None of this reaches an application bundle beyond the icons it imports.

## Peers

| Flavour | Peer | Import |
|---|---|---|
| React | `react` 18 or newer | `@ichava/js-icon-components/react/<pack>` |
| Vue 3 | `vue` 3.4 or newer | `@ichava/js-icon-components/vue/<pack>` |
| Svelte 5 | `svelte` 5 | `@ichava/js-icon-components/svelte/<pack>` |
| Web Component | none | `@ichava/js-icon-components/wc/<pack>` |
| React Native | `react-native-svg` 15 or newer | `@ichava/js-icon-components/react-native/<pack>` |
| Angular | `@angular/core` 20 or newer | `@ichava/js-icon-components/angular` and `/angular/<pack>` |
| SolidJS | `solid-js` 1.8 or newer | `@ichava/js-icon-components/solid/<pack>` |
| Preact | `preact` 10.19 or newer | `@ichava/js-icon-components/preact/<pack>` |
| Astro | `astro` 5 or newer | `@ichava/js-icon-components/astro` and `/astro/<pack>` |
| Qwik | `@builder.io/qwik` 1.5 or newer | `@ichava/js-icon-components/qwik/<pack>` |
| Ember | `ember-source` 6.3 or newer | `@ichava/js-icon-components/ember` and `/ember/<pack>` |
| Elm | `elm/svg` and `elm/virtual-dom` in your `elm.json` | `dist/elm/` as a source directory |
| Exports | none | `@ichava/js-icon-components/assets/<pack>/<file>` |

Every peer is optional. Install only the one you use.

---

[← Docs index](../README.md#documentation)
