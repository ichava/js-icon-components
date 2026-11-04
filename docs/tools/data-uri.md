# Data URI

`dist/assets/<pack>/data-uri.json` is the data URI export: a JSON map from each icon's slug to its SVG as a `data:image/svg+xml,…` URI.

## Files

| File | Holds |
|---|---|
| `dist/assets/<pack>/data-uri.json` | `{ "<slug>": "data:image/svg+xml,…" }`, one entry per icon |

Slugs are the [CSS mask](css-mask.md) export's: `mug`, `mug-filled`, `ke-1x1`.

## Usage

```ts
import uris from '@ichava/js-icon-components/assets/tabler/data-uri.json' with { type: 'json' };

const img = new Image();
img.src = uris.mug;
```

Use it where markup cannot go: an `<img src>`, a CSS `background-image`, a canvas, an email.

## Encoding

Percent-encoding, not base64: it is smaller and readable, and it is what mini-svg-data-uri and
@iconify/tailwind write. Attribute quotes become single quotes when the SVG has none of its own, and
the characters that are safe inside `url("…")` (space, `=`, `:`, `/`, `,`, `;`) are left as they
are. The SVG is written from the parsed, policy-checked tree, never from source text: the encoder
only ever sees what the policy accepted. A standalone SVG is parsed as XML, so it carries the
`xmlns:xlink` declaration when the icon uses `xlink:href`, and its height follows its viewBox.

## Size

36.5 MB across the four packs, written in under a second.

## Tests

`tests/assets.test.ts`: a golden map for three icons, the URI decodes back to exactly the SVG
that was encoded, and the count guard.

## Format id

`data-uri`, an asset export in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
