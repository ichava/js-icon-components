# PNG

`dist/assets/<pack>/png.zip` is the PNG export: every icon rasterised at 16, 24, 32, 48 and 64 pixels wide, in one zip per pack.

## Files

| Entry | Holds |
|---|---|
| `<size>/<slug>.png` | the icon at `<size>` pixels wide, its height following its viewBox (a 4x3 flag at 16 is 16×12) |
| `ATTRIBUTION.md`, `LICENSE` | the pack's attribution and licence, where it has them |

Slugs are the [CSS mask](css-mask.md) export's. `currentColor` rasterises as black, the colour an
SVG image has when nothing sets one.

## Why resvg

The rasteriser is `@resvg/resvg-js`, a development dependency only, so nothing reaches an
application. It is resvg, the Rust renderer, as prebuilt Node binaries per platform: no system
library, no canvas and no browser, and it renders the whole SVG feature set the policy admits. A
pure-JavaScript rasteriser would have needed a canvas implementation, and a headless browser would
have added a download of hundreds of megabytes to every git install. System fonts are not loaded,
so a render does not depend on the build machine.

## Zip

Written by `src/generator/zip.ts`, a short writer with no dependency: deflate where it helps,
store where it does not (most PNGs), and the same fixed timestamp on every entry, so the same input
gives the same bytes.

## Size and time

92.1 MB across the four packs, the largest export by far, in 14.3 s, most of a full build's
generation time. Tabler is 22.7 MB for 31,285 PNGs; OpenMoji 41.7 MB.

## Tests

`tests/assets.test.ts` opens the flag pack's zip and checks every icon is there at every size, and
that each PNG's header gives the right width and height; the count guard fails if one size holds a
different number of icons from another.

## Format id

`png-zip`, an asset export in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
