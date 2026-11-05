# Packs

Four packs are generated, each read from git at a pinned commit and each keeping its own artwork licence.

## The pinned packs

| Pack | Repository | Commit | Sets (default first) | Icons | Artwork licence |
|---|---|---|---|---:|---|
| `tabler` | `ichava/icon-sets-tabler` | `10a5f39c` | `outline`, `filled` | 6,257 | MIT |
| `flag` | `ichava/icon-sets-flag` | `2d7b51ce` | `4x3`, `1x1` | 542 | MIT |
| `emoji` | `ichava/icon-sets-emoji` | `833f11fb` | `twemoji` | 3,435 | CC-BY-4.0 |
| `openmoji` | `ichava/icon-sets-openmoji` | `25280ae1` | `openmoji-color`, `openmoji-black` | 8,566 | CC-BY-SA-4.0 |

Counts are measured at those commits on 2026-11-04 (flag and openmoji on 2026-11-05). `packs.json` holds the full SHAs.

- **`emoji` is Twemoji only.** `icon-sets-emoji` also carries the two OpenMoji sets, but deprecates
  them there in favour of `icon-sets-openmoji`. Generating them twice would ship 7,132 icons twice.
- **`openmoji` leaves out two icons.** The `uncategorised/1f3f4-e0063-e0061-e0071-e0063-e007f.svg`
  flag in both sets keeps an unused `xmlns:sodipodi` declaration on `<svg>`, which the SVG gate
  rejects. Both are listed under `exclude` in `packs.json` with that reason, and the build fails if
  an entry stops being rejected, so the fix upstream brings them back. The high-speed train excluded
  before is fixed upstream (icon-sets-openmoji#4) and generated again.
- **`openmoji` includes `uncategorised/`**, the OpenMoji extras the Unicode taxonomy does not name,
  511 per set at `25280ae1`, under their upstream file names.
- **Not generated:** `icon-sets-bundled` is private and licensed for Simtabi's internal and client
  use only, so a public package cannot ship it; `icon-sets-metronic` is private and never shown
  publicly.

## Export names

The rule is the same in every pack: `Icon` + the name in PascalCase + the set when it is not the
default. Emoji sets nest one category directory deep, which is not part of the name.

| Source file | Export |
|---|---|
| `flag` `4x3/ke.svg` | `IconKe` |
| `flag` `1x1/ke.svg` | `IconKe1x1` |
| `emoji` `twemoji/smileys-emotion/grinning-face.svg` | `IconGrinningFace` |
| `openmoji` `openmoji-black/travel-places/rainbow.svg` | `IconRainbowOpenmojiBlack` |

```tsx
import { IconKe } from '@ichava/js-icon-components/react/flag';
import { IconGrinningFace } from '@ichava/js-icon-components/react/emoji';

<IconKe size={32} title="Kenya" />
<IconGrinningFace size={24} />
```

Multi-colour artwork keeps its own colours: `color` and `strokeWidth` only change what the source
paints with `currentColor` or strokes from the root, which flags and colour emoji do not.

## Attribution travels with the artwork

The generator's code is MIT. The artwork is not relicensed: each pack lists the files that must go
with it, read at the pinned commit, and the build copies them beside every flavour:

```text
dist/data/openmoji/ATTRIBUTION.md   dist/data/openmoji/LICENSE
dist/react/openmoji/ATTRIBUTION.md  dist/react/openmoji/LICENSE
dist/vue/openmoji/…  dist/svelte/openmoji/…  dist/wc/openmoji/…
```

Every generated module also opens with a legal comment, which bundlers keep:

```js
/*! openmoji artwork: CC-BY-SA-4.0. Attribution and licence: ../openmoji/ATTRIBUTION.md, ../openmoji/LICENSE */
```

**If you ship Twemoji or OpenMoji icons, you take on their licence.** CC-BY 4.0 asks for credit
and a link to the licence; CC-BY-SA 4.0 also asks that adapted artwork is shared under the same
licence. Each `ATTRIBUTION.md` gives the credit line its upstream asks for. `dist/manifest.json`
lists each pack's `licence` and every attribution file.

## Ids are prefixed per icon

Inline SVGs share the page's id space. Every OpenMoji icon defines `id="color"` and `id="line"`,
so without prefixing, the second icon on a page paints from the first one's definitions. Every
`id` is rewritten to `<pack>_<set>_<name>_<id>`, along with every reference to it: `url(#…)`,
`href` and `xlink:href`, and the ARIA id-list attributes. The prefix depends only on the pack, set
and name, so it is the same in every flavour and every build. The same icon rendered twice still
repeats its ids, harmlessly: both copies define the same content.

## Adding a pack

Add an entry to `packs.json`: `id`, `repository`, a full commit `ref`, `path`, `sets`,
`defaultSet`, `kind`, `minIcons`, the artwork `licence` as an SPDX expression and its
`attribution` files, plus `categories: true` when sets nest a category directory, and
`themeVariants: { "dark": "-dark" }` when a pack ships theme twins (`scene-dark.svg` beside
`scene.svg`), which then fold into their light item as `variants.dark`. A pack whose
licence is CC-BY or CC-BY-SA must list attribution files, or the build refuses it. Then add its
measured count to `tests/generate.test.ts`.

---

[← Docs index](../README.md#documentation)
