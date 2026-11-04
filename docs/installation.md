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

1. `tsc` compiles the generator, the shared contract and the React and Web Component templates.
2. The generator reads each pack in `packs.json` at its pinned commit, from a shallow `git fetch`
   of exactly that commit (or a sibling checkout, when one holds it), checks every SVG against the
   policy, and writes the data and flavour modules.

So `git` must be on the path and `github.com` reachable. Measured 2026-11-04 with the four packs
on an Apple-silicon laptop: the whole build takes about 5 seconds, and generating from a cold
cache, shallow-fetching all four pinned commits (9.5 MB of git objects), about 5 seconds too.

## Size

Measured 2026-11-04 with the four packs, `dist/` is 51.4 MB in 17,465 files (npm's figure). The icon
data shared by every flavour is 40.0 MB of it, mostly the emoji, whose artwork is detailed; the
React and Vue binding modules are about 2.7 MB each, and the 17,365 small Svelte wrappers 5.9 MB.
On disk that is about 114 MB, because each small file takes at least one 4 KB block. npm's packed
tarball is 6.0 MB. None of that reaches an application bundle beyond the icons it imports.

## Peers

| Flavour | Peer | Import |
|---|---|---|
| React | `react` 18 or newer | `@ichava/js-icon-components/react/<pack>` |
| Vue 3 | `vue` 3.4 or newer | `@ichava/js-icon-components/vue/<pack>` |
| Svelte 5 | `svelte` 5 | `@ichava/js-icon-components/svelte/<pack>` |
| Web Component | none | `@ichava/js-icon-components/wc/<pack>` |

All three peers are optional. Install only the one you use.

---

[← Docs index](../README.md#documentation)
