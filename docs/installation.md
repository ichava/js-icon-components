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
holds `dist/` for every pack and flavour and nothing else: no source, no tests, and no
dependencies. npm runs no build for a tarball, so no compiler, `git` or network access to the
packs is needed. Then import the flavour you use, as in the [README](../README.md#quick-start-guide-and-usage).

### One pack only

Each release also attaches one tarball per pack, built with every flavour:

```bash
npm install https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-tabler-0.1.0.tgz
```

The package name and import paths are the same as the full tarball's, so moving between them
changes one line. An import of another pack throws, naming the pack. Because the package name is
the same, an application installs one of these tarballs, not two: for two packs, use the full
tarball or a git build.

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
| `ICHAVA_ICONS_FLAVOURS=react,vue` | `"flavours": ["react", "vue"]` | builds only those flavours |
| `ICHAVA_ICONS_SKIP_BUILD=1` | `"skipBuild": true` | builds nothing |

Packs are `tabler`, `flag`, `emoji` and `openmoji`. Flavours are named by their subpath: `react`,
`vue`, `svelte`, `wc`, `react-native`, `angular`, `solid`, `preact` and `astro` (the registry ids
`webcomponent` and `reactNative` work too). Unset or empty means all of them; an unknown name fails
the install, listing the valid ones.

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
the four packs (17,365 icons) and nine flavours. Install times are wall-clock for a fresh
application; on disk is `du`, which is larger than the byte count because each small file takes at
least one 4 KB block.

| Install | Download | Unpacked | On disk | Files | Time |
|---|---:|---:|---:|---:|---:|
| Release tarball, full | 7.0 MB | 64.2 MB | 126 MB | 17,549 | 15 s |
| Release tarball, `tabler` | 1.7 MB | 17.3 MB | 40 MB | 6,404 | 4 s |
| Release tarball, `flag` | 2.1 MB | 12.4 MB | 14 MB | 679 | 1 s |
| Release tarball, `emoji` | 2.4 MB | 20.1 MB | 32 MB | 3,572 | 2 s |
| Release tarball, `openmoji` | 3.5 MB | 38.3 MB | 63 MB | 7,278 | 5 s |
| Git, every pack and flavour | | | 126 MB | 17,549 | 61 s |
| Git, `tabler` for `react` | | | 12 MB | 132 | 23 s |
| Git, `ICHAVA_ICONS_SKIP_BUILD=1` | | | 0 | 3 | 20 s |

About 20 seconds of every git install is npm installing the development dependencies in its
temporary clone, which no selection avoids; the rest is the build and copying the files out. In
`dist/` the icon data shared by every flavour is 40.0 MB of the full 64.2 MB, mostly the emoji,
whose artwork is detailed. None of it reaches an application bundle beyond the icons it imports.

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

Every peer is optional. Install only the one you use.

---

[← Docs index](../README.md#documentation)
