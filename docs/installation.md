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

So `git` must be on the path and `github.com` reachable. Measured 2026-11-04 for the one pack,
Tabler at `10a5f39c`: the build takes about 1.5 seconds on an Apple-silicon laptop, and the
shallow fetch about 1 second.

## Size

`dist/` for the Tabler pack is about 7.5 MB in 6,300 files: 4.1 MB of icon data shared by every
flavour, about 0.8 MB each for the React and Vue binding modules, and 1.8 MB for the 6,257 small
Svelte wrappers; npm's packed tarball is 0.8 MB. None of that reaches an application bundle
beyond the icons it imports.

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
