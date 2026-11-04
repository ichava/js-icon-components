# Android VectorDrawable

`dist/assets/<pack>/android-vd.zip` is the Android export: one VectorDrawable XML per icon, converted from the icon's parsed tree, with every icon that cannot convert exactly listed and left out.

## Files

| File | Holds |
|---|---|
| `android-vd.zip` → `res/drawable/ichava_<pack>_<slug>.xml` | one drawable per convertible icon, resource names in `[a-z0-9_]` |
| `android-vd-skipped.json` | `{ pack, written, skipped: [{ id, reason }] }` |

## Usage

Unzip into your module's `src/main/`, then:

```xml
<ImageView
    android:layout_width="24dp"
    android:layout_height="24dp"
    android:contentDescription="@string/coffee"
    app:srcCompat="@drawable/ichava_tabler_mug" />
```

`currentColor` becomes `?attr/colorControlNormal`, so a Tabler icon takes the theme's icon colour;
`app:tint` recolours it.

## What it converts

The converter is `src/native/vectordrawable.ts`. VectorDrawable is smaller than SVG: paths and
groups, and no inheritance. So it:

- turns `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon` into path data;
- re-writes path data with a separator between every number, so compact arc flags such as
  `a1 1 0 011 1` read the same on older Android parsers;
- resolves inherited `fill`, `stroke`, widths, caps, joins, opacities and `fill-rule` down to
  each path, and `style` declarations over attributes;
- maps `transform` to nested `<group>`s: `translate`, `scale`, `rotate` (with a pivot), and any
  `matrix` without skew, decomposed into scale, rotation and translation;
- writes a `paint-order="stroke"` shape as two paths, stroke first;
- accepts CSS named colours, `#rgb`, `#rrggbb`, `#rrggbbaa` and `rgb()`, and lengths in `px` or `pt`;
- drops shapes that paint nothing, such as Tabler's invisible 24×24 bounding path.

## What it refuses

It refuses rather than approximates. A gradient or pattern (`url(#…)` paint), `<defs>`, `<use>`,
`<clipPath>` or `clip-path`, `mask`, `filter`, text, dashes, a skewed matrix, opacity on a group of
several shapes or on a shape with both fill and stroke: each throws with the construct named, and
the icon goes into `android-vd-skipped.json` instead of a drawable that draws something else.

Measured on the pinned packs:

| Pack | Icons | Written | Skipped | Why skipped |
|---|---:|---:|---:|---|
| Tabler | 6,257 | 6,257 | 0 | |
| flag | 542 | 281 | 261 | `<defs>` 163, `<use>` 89, skewed `matrix` 6, `<clipPath>` 2, `clip-path` 1 |
| Twemoji | 3,435 | 3,432 | 3 | `<defs>` 3 |
| OpenMoji | 7,131 | 7,120 | 11 | dashes 6, skewed `matrix` 4, opacity on fill and stroke 1 |

## Size

16.4 MB across the four packs, in 1.8 s.

## Tests

`tests/vectordrawable.test.ts`: golden XML for five Tabler icons; every drawable written for the
Tabler and flag packs parsed as XML and checked against VectorDrawable's own element and attribute
names; a gradient, a mask, a filter and dashes each refused with its name; arc flags, transforms,
inherited paint and `paint-order` converted exactly. The count guard checks written plus skipped
equals the pack.

## Format id

`android-vd`, a native asset export (`native: true`) in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
