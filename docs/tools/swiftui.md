# SwiftUI

`dist/assets/<pack>/swiftui.zip` is the SwiftUI export: an Xcode asset catalog, `Ichava<Pack>.xcassets`, with one image set per icon.

## Files

| Entry | Holds |
|---|---|
| `Ichava<Pack>.xcassets/Contents.json` | the catalog's own `info` |
| `Ichava<Pack>.xcassets/<slug>.imageset/<slug>.svg` | the icon, written from its checked tree |
| `Ichava<Pack>.xcassets/<slug>.imageset/Contents.json` | one universal SVG, `preserves-vector-representation: true`, and a rendering intent |
| `ATTRIBUTION.md`, `LICENSE` | the pack's attribution and licence |

Slugs are the [CSS mask](css-mask.md) export's.

## Usage

Unzip, drag `IchavaTabler.xcassets` into your Xcode target, then:

```swift
Image("mug")
    .foregroundStyle(.purple)
    .frame(width: 20, height: 20)
```

SVG in an asset catalog needs Xcode 12 and iOS 13, macOS 11 or later. The vector is kept, so the
image is sharp at any size.

## Template or original

An icon that paints in one colour only (`currentColor`, black, or nothing) gets
`template-rendering-intent: template`, so SwiftUI tints it with `foregroundStyle` like an SF Symbol.
An icon with colours of its own, a flag or an emoji, gets `original` and keeps them.

## Size

23.7 MB across the four packs, in 1.4 s.

## Tests

`tests/assets.test.ts` validates every `Contents.json` in the flag pack's catalog against the keys
Apple documents for asset catalogs (`tests/fixtures/xcassets-contents.json`), checks each image
set holds the file it names, and checks Tabler icons are `template` and a flag is `original`.

## Format id

`swiftui`, a native asset export (`native: true`) in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
