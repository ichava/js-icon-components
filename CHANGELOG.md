# Changelog

All notable changes to `@ichava/js-icon-components` follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Three packs: `flag` (`ichava/icon-sets-flag` at `67075d3f`, 542 flags in `4x3` and `1x1`), `emoji` (`ichava/icon-sets-emoji` at `833f11fb`, the 3,435 Twemoji icons) and `openmoji` (`ichava/icon-sets-openmoji` at `d492519e`, 7,131 icons in `openmoji-color` and `openmoji-black`). `icon-sets-bundled` is not generated: it is private and for internal and client use only.
- Per-icon id prefixing: every `id`, and every `url(#…)`, `href`, `xlink:href` and ARIA id reference to it, becomes `<pack>_<set>_<name>_<id>`, so two icons on one page never share an id.
- Artwork licences travel with the icons: each pack's `ATTRIBUTION.md`, and its licence text where it has one, is copied from the pinned commit to `dist/<flavour>/<pack>/`; each generated module carries a `/*!` legal comment; `manifest.json` lists each pack's `licence`, `excluded` and `attribution`.
- `packs.json` fields `licence`, `attribution`, `categories` (one level of category directories) and `exclude` (rejected SVGs left out, each with a reason; a stale entry fails the build).
- Guards: output equals input per pack, less listed exclusions; no repeated id on a page of icons from one pack or two; every multi-colour flag and emoji keeps every source colour; attribution files present for every pack and flavour.

- Five flavours, each an optional peer with its own subpath, template, compile test and render snapshot: React Native on `react-native-svg` (`./react-native`), Angular as a standalone `ichava-ng-icon` component compiled by `ngc` in partial mode (`./angular`), SolidJS (`./solid`), Preact (`./preact`) and Astro (`./astro`, shipped as `.astro` source). Their format ids (`reactNative`, `angular`, `solid`, `preact`, `astro`) are not in icon-browser's registry yet, so they are listed as pending and the registry guard asserts they are still missing there.

### Fixed

- The React flavour passes a source `style` attribute as an object. React throws on a string, so the eight flag SVGs with `style="marker:none"` and similar could not render.

## [0.1.0] - TBD

First release.

### Added

- A generator that reads each pack in `packs.json` from git at a pinned commit (the sibling checkout when it holds the commit, else a shallow fetch) and writes one data module plus React, Vue 3, Svelte 5 and Web Component modules per pack. The first pack is `ichava/icon-sets-tabler` at `10a5f39c`: 6,257 icons per flavour.
- Four templates, one per flavour, each compiled by that framework's own compiler in its test and render-snapshotted for three icons. Every icon takes `size`, `color`, `title` and, on stroked icons, `strokeWidth`; it is `role="img"`, and `aria-hidden` unless titled.
- An SVG gate that applies `ichava/core`'s policy (allow-list, `#fragment` references only, 30,000 elements, 4,500,000 bytes) and rejects rather than strips, so one bad icon fails the build.
- Guard tests: hostile SVGs are rejected; the output count per flavour equals the input count, above a floor; every flavour is a `generated` format in icon-browser's format registry and the reverse; no lock file is tracked.
