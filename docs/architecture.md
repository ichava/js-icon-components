# Architecture

How a pinned pack becomes four flavours of components, and what keeps the output honest.

## Why a generator?

The icons already exist as SVG files in each pack, and the browser already shows a code tab for
React, Vue, Svelte and the Web Component. Writing those components by hand is out of the question
at 6,257 icons a pack, and the alternatives each lose something:

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
packs.json ─▶ git at the pinned commit ─▶ SVG gate ─▶ IconData ─▶ data/<pack>.js
                                                              ├▶ react/packs/<pack>.js   createIcon(data)
                                                              ├▶ vue/packs/<pack>.js     defineIcon(data)
                                                              ├▶ svelte/packs/<pack>/*.svelte
                                                              └▶ wc/packs/<pack>.js      re-exports the data
```

| Part | File |
|---|---|
| Pack input | `src/generator/packs.ts` |
| SVG gate | `src/generator/sanitize.ts`, `src/generator/svgPolicy.ts` |
| Names | `src/generator/naming.ts` |
| Emit and count | `src/generator/generate.ts` |
| Shared contract | `src/shared/index.ts` (`IconData`, `IconProps`, `rootAttributes`) |
| Templates | `src/react/index.tsx`, `src/vue/Icon.vue`, `src/svelte/Icon.svelte`, `src/wc/index.ts` |

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

## The guards

| Guard | Test |
|---|---|
| Hostile SVGs are rejected (27 vectors) | `tests/sanitize.test.ts` |
| Output per flavour equals the input count from git, above `minIcons` | `tests/generate.test.ts` |
| Every flavour is a `generated` format in icon-browser's registry, and the reverse | `tests/registry.test.ts` |
| No lock file is tracked | `tests/lockfile.test.ts` |
| Vendored policy and schema match their digests and siblings | `tests/vendored.test.ts` |

Each was seen failing before it was trusted, and each counts what it inspected so an empty input
cannot pass.

## Illustrations

`IconData.kind` carries `illustration`, and the props are designed: `primaryColor` for the
accent and `variant` for the light and dark twins. They are not built yet, because no
illustration pack is public and an unused prop would be an untested one. The first illustration
pack in `packs.json` brings them, with snapshots, in the same change.

---

[← Docs index](../README.md#documentation)
