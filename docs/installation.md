# Installation

Install from a git tag; `prepare` builds and generates `dist/` on your machine.

## From a git tag

```bash
npm install "github:ichava/js-icon-components#v0.1.0"
```

```json
{
  "dependencies": {
    "@ichava/js-icon-components": "github:ichava/js-icon-components#v0.1.0"
  }
}
```

There is no npm release yet. Pin a tag, never a branch: a tag is final and never moves.

## What the install does

npm clones the repository, installs its development dependencies and runs `prepare`, which is
`npm run build`:

1. `tsc` compiles the generator, the shared contract and the React, Web Component, React Native,
   SolidJS and Preact templates, and Angular's compiler (`ngc`, partial mode) the Angular one.
2. The generator reads each pack in `packs.json` at its pinned commit, from a shallow `git fetch`
   of exactly that commit (or a sibling checkout, when one holds it), checks every SVG against the
   policy, and writes the data and flavour modules.

So `git` must be on the path and `github.com` reachable. Measured 2026-11-04 with the four packs
on an Apple-silicon laptop: the whole build takes about 5 seconds, and generating from a cold
cache, shallow-fetching all four pinned commits (9.5 MB of git objects), about 5 seconds too.

## Size

Measured 2026-11-04 with the four packs and nine flavours, `dist/` is 64.2 MB in 17,549 files
(npm's figure). The icon data shared by every flavour is 40.0 MB of it, mostly the emoji, whose
artwork is detailed; each binding module set (React, Vue, React Native, SolidJS, Preact) is about
2.7 MB, the Angular and Astro data re-exports about 1.6 MB each, and the 17,365 small Svelte
wrappers 5.9 MB. On disk that is about 126 MB, because each small file takes at least one 4 KB
block. npm's packed tarball is 7.0 MB.

The install also fetches the development dependencies `prepare` builds with, as any git install
does: 734 packages, 574 MB, about 30 seconds from a warm npm cache. The frameworks among them are
there to compile and test the templates; an application installs only its own as a peer. None of that reaches an application bundle beyond the icons it imports.

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
