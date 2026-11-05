# Changelog

All notable changes to `@ichava/js-icon-components` follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Three Tier 3 flavours** (icon-browser schema 1.6.0, now 1.7.0, vendored with its digest): Qwik (`./qwik`, one lightweight component per icon; Qwik's server renderer and optimizer in the test), Ember (`./ember`, a template-only Glimmer component in template-tag format, compiled with content-tag and checked by the Glimmer precompiler) and Elm (`dist/elm/Ichava/Icons/<Pack>.elm`, one `Svg msg` function per icon, compiled with `elm make` from npm's `elm` package and run in jsdom in the test). `@builder.io/qwik` and `ember-source` are optional peers.
- **Five asset exports** under `dist/assets/<pack>/`, chosen in the same `ICHAVA_ICONS_FLAVOURS` list as the flavours: `icons.css` (CSS mask, one `.i-<pack>-<slug>` class per icon), `data-uri.json` (percent-encoded SVG data URIs), `flutter.zip` (SVG assets, Dart path constants and a `pubspec` fragment for `flutter_svg`), `swiftui.zip` (an `.xcassets` catalog, `template` rendering for one-colour icons, `original` otherwise) and `android-vd.zip` (VectorDrawable XML from `src/native/vectordrawable.ts`, with `android-vd-skipped.json` listing each icon it refuses and why: 0 of 6,257 Tabler, 261 of 542 flags, 3 of 3,435 Twemoji, 11 of 7,131 OpenMoji). Every export is written from the parsed, policy-checked tree, carries the pack's attribution, and is counted from its files by the count guard.
- **Illustration props.** `primaryColor` (sets `--ichava-primary` and `color`) and `variant: 'light' | 'dark'` in every component flavour (`primary-color` and `variant` attributes on the Web Component). `packs.json` takes `themeVariants: { "dark": "-dark" }`, core's twin rule: `scene-dark.svg` becomes `variants.dark` of `scene.svg`. Exercised in React, Vue, Svelte and the Web Component with a test-only pack of three CC0 shapes, `tests/fixtures/packs/illustration-demo`.
- `scripts/pack-tarball.mjs`, which `release.yml` and the tests both pack with.
- Guards: the registry guard reads all 26 formats of schema 1.7.0 and requires every `generated` and `asset` one (twelve flavours, five exports: 17 generator-owned formats) and none of the `laravel` or `client` ones; golden output and a structural check for each export (CSS parses, `pubspec` parses as YAML, `Contents.json` against Apple's documented keys, every drawable against VectorDrawable's names); Elm lines stay under the parser's 16-bit column limit; two per-pack tarballs install side by side.

### Changed

- **Each per-pack release tarball is its own package**, `@ichava/js-icon-components-<pack>`, with the same subpath exports; the full tarball keeps `@ichava/js-icon-components`. They used to share the full package's name, so npm kept only one: installing a second replaced the first. Imports from a per-pack tarball now name it (`@ichava/js-icon-components-tabler/react/tabler`). The tarball checker refuses a per-pack tarball with the shared name.
- The full release tarball is 62.3 MB to download and 266.1 MB unpacked (was 7.0 MB and 64.2 MB), almost all of it the asset exports, and installs offline in about 19 s. Per-pack tarballs are 9.2 to 29.7 MB (measured 2026-11-04, after the PNG export was dropped; with it the full tarball was 133.4 MB and 358 MB). A git build that lists only its flavours writes no export.
- `manifest.json` gains `assets`, `unbuilt.assets` and, per pack, `assets`, `variants` and `skipped`.

- **Prebuilt release tarballs, the default install.** `release.yml` builds once and attaches `ichava-js-icon-components-<version>.tgz` (`npm pack` output, every pack and flavour), one `ichava-js-icon-components-<pack>-<version>.tgz` per pack, and `SHA256SUMS`, each checked by `scripts/check-tarball.mjs`. `npm install <release URL>` needs no compiler, `git` or configuration. The workflow runs on a `v*` tag push or on dispatch with a `tag` input, and creates or updates that tag's release only.
- **A configurable git build.** `prepare` is now `scripts/prepare.mjs`: it builds only when `dist/` is missing, builds nothing on `ICHAVA_ICONS_SKIP_BUILD=1`, and otherwise builds the packs in `ICHAVA_ICONS_PACKS` for the flavours in `ICHAVA_ICONS_FLAVOURS`, falling back to `"ichava": { "icons": { … } }` in the installing application's `package.json`. Measured: a git install of `tabler` for `react` is 12 MB in 23 s, against 126 MB in 61 s for everything.
- A pack or flavour left out of a build keeps its subpath as a stand-in that exports the real names and throws naming the variable that adds it; `manifest.json` lists them under `unbuilt`.
- Guards: the packed tarball holds `dist/` for every pack and flavour and no source, tests or dependencies; it installs offline into a scratch application and imports an icon in every flavour with no compiler present; a selective build writes only what it selected, and its stand-ins throw.

- The registry guard requires all nine flavours. The five Tier 2 ids are in icon-browser's format registry since schema 1.5.0, so `tests/registry.test.ts` now asserts each is a generated, copyable format there and that no other generated format exists, and the vendored `vendor/icon-browser.schema.json` is refreshed to 1.5.0 (digest updated). The "stays pending" assertion is gone.
- Three packs: `flag` (`ichava/icon-sets-flag` at `67075d3f`, 542 flags in `4x3` and `1x1`), `emoji` (`ichava/icon-sets-emoji` at `833f11fb`, the 3,435 Twemoji icons) and `openmoji` (`ichava/icon-sets-openmoji` at `d492519e`, 7,131 icons in `openmoji-color` and `openmoji-black`). `icon-sets-bundled` is not generated: it is private and for internal and client use only.
- Per-icon id prefixing: every `id`, and every `url(#…)`, `href`, `xlink:href` and ARIA id reference to it, becomes `<pack>_<set>_<name>_<id>`, so two icons on one page never share an id.
- Artwork licences travel with the icons: each pack's `ATTRIBUTION.md`, and its licence text where it has one, is copied from the pinned commit to `dist/<flavour>/<pack>/`; each generated module carries a `/*!` legal comment; `manifest.json` lists each pack's `licence`, `excluded` and `attribution`.
- `packs.json` fields `licence`, `attribution`, `categories` (one level of category directories) and `exclude` (rejected SVGs left out, each with a reason; a stale entry fails the build).
- Guards: output equals input per pack, less listed exclusions; no repeated id on a page of icons from one pack or two; every multi-colour flag and emoji keeps every source colour; attribution files present for every pack and flavour.

- Five flavours, each an optional peer with its own subpath, template, compile test and render snapshot: React Native on `react-native-svg` (`./react-native`), Angular as a standalone `ichava-ng-icon` component compiled by `ngc` in partial mode (`./angular`), SolidJS (`./solid`), Preact (`./preact`) and Astro (`./astro`, shipped as `.astro` source). Their format ids (`reactNative`, `angular`, `solid`, `preact`, `astro`) are listed in icon-browser's registry from schema 1.5.0 and required by the registry guard.

### Removed

- **The PNG export (`png-zip`, `dist/assets/<pack>/png.zip`), by owner decision (2026-11-04).** It never shipped in a release. icon-browser's schema 1.7.0 (ichava/icon-browser#129) drops the id, re-vendored here with its digest; `ASSET_TARGETS`, `ASSET_FILES`, `pngZip`, `PNG_SIZES`, the count check, `scripts/check-tarball.mjs`, `docs/tools/png-zip.md` and the `@resvg/resvg-js` development dependency go with it. `ICHAVA_ICONS_FLAVOURS=png-zip` now fails as an unknown name. The full build takes about 15 s instead of 27 s.

### Fixed

- **The generator accepts `display`, `color` and `marker-*`, each behind a value guard** (parity with ichava/icon-sets-sync#85 and ichava/core#163). `vendor/svg-policy.json` is core's new policy (sha256 `7a7c07fd…`, pinned in `tests/vendored.test.ts`). `presentationValueIsSafe` in `src/generator/svgPolicy.ts` is the same as react-icon-browser's: `display` must be bare keywords, `color` must pass `cssValueIsSafe`, and `marker-*` must be `none` or `url(#id)`. Anything else is still rejected. Stray text is still rejected rather than stripped, so the openmoji `high-speed-train` exclusion stays. Regenerated output is byte-identical: no icon changed in the four shipped packs (17,532 dist files). Across all 142,247 pack SVGs, 14 decisions changed, all in icon-sets-bundled, which is not generated. `tests/presentation.test.ts`, with `tests/fixtures/svg/presentation-vectors.json` shared with core and react-icon-browser.
- The React flavour passes a source `style` attribute as an object. React throws on a string, so the eight flag SVGs with `style="marker:none"` and similar could not render.

## [0.1.0] - TBD

First release.

### Added

- A generator that reads each pack in `packs.json` from git at a pinned commit (the sibling checkout when it holds the commit, else a shallow fetch) and writes one data module plus React, Vue 3, Svelte 5 and Web Component modules per pack. The first pack is `ichava/icon-sets-tabler` at `10a5f39c`: 6,257 icons per flavour.
- Four templates, one per flavour, each compiled by that framework's own compiler in its test and render-snapshotted for three icons. Every icon takes `size`, `color`, `title` and, on stroked icons, `strokeWidth`; it is `role="img"`, and `aria-hidden` unless titled.
- An SVG gate that applies `ichava/core`'s policy (allow-list, `#fragment` references only, 30,000 elements, 4,500,000 bytes) and rejects rather than strips, so one bad icon fails the build.
- Guard tests: hostile SVGs are rejected; the output count per flavour equals the input count, above a floor; every flavour is a `generated` format in icon-browser's format registry and the reverse; no lock file is tracked.
