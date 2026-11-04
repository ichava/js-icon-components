# Changelog

All notable changes to `@ichava/js-icon-components` follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - TBD

First release.

### Added

- A generator that reads each pack in `packs.json` from git at a pinned commit (the sibling checkout when it holds the commit, else a shallow fetch) and writes one data module plus React, Vue 3, Svelte 5 and Web Component modules per pack. The first pack is `ichava/icon-sets-tabler` at `10a5f39c`: 6,257 icons per flavour.
- Four templates, one per flavour, each compiled by that framework's own compiler in its test and render-snapshotted for three icons. Every icon takes `size`, `color`, `title` and, on stroked icons, `strokeWidth`; it is `role="img"`, and `aria-hidden` unless titled.
- An SVG gate that applies `ichava/core`'s policy (allow-list, `#fragment` references only, 30,000 elements, 4,500,000 bytes) and rejects rather than strips, so one bad icon fails the build.
- Guard tests: hostile SVGs are rejected; the output count per flavour equals the input count, above a floor; every flavour is a `generated` format in icon-browser's format registry and the reverse; no lock file is tracked.
