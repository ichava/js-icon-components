# CSS mask

`dist/assets/<pack>/icons.css` is the CSS mask export: one class per icon that paints the icon in `currentColor` with `mask-image`, as unplugin-icons and @iconify/tailwind do.

## Files

| File | Holds |
|---|---|
| `dist/assets/<pack>/icons.css` | one shared rule and one `.i-<pack>-<slug>` class per icon |
| `@ichava/js-icon-components/assets/<pack>/icons.css` | the same file, through the package's exports |

The slug is the icon's name, plus `-<set>` outside the default set: `mug` is `.i-tabler-mug`,
`mug` in `filled` is `.i-tabler-mug-filled`, the 1x1 Kenyan flag is `.i-flag-ke-1x1`. A collision
fails the build, naming both icons.

## Usage

```ts
import '@ichava/js-icon-components/assets/tabler/icons.css';
```

```html
<span class="i-tabler-mug" style="color: #7c3aed; font-size: 20px"></span>
```

The icon is `1em` square and takes `color`, so it sizes with `font-size` and colours like text. A
mask keeps only the shape, so a multi-colour flag or emoji paints in one colour: use a component
flavour or the data URI export for those.

## How it is encoded

Each class sets `--ichava-mask: url("data:image/svg+xml,…")`, and one `:where(…)` rule applies it
to every class of the pack, with `-webkit-mask` for Safari. The SVG is written from the icon's
parsed, policy-checked tree and percent-encoded (see [Data URI](data-uri.md)); the result holds no
double quote, backslash or line break, so it cannot end the `url("…")` it sits in. A test plants an
attribute value of `") } body { background: red } …` and checks the sheet still parses as one rule.

## Size

Every pack's `icons.css` together is 37 MB uncompressed (Tabler 3.9 MB, OpenMoji 22.9 MB), written
in under a second. The file is plain text and compresses well; serve it with compression.

## Tests

`tests/assets.test.ts`: golden CSS for three icons, the break-out test above, the flag pack's file
parsed as CSS with one rule per icon plus the shared one, and the count guard.

## Format id

`css-mask`, an asset export (`delivery: "asset"`) in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
