# @ichava/js-icon-components

[![Tests](https://github.com/ichava/js-icon-components/actions/workflows/ci.yml/badge.svg)](https://github.com/ichava/js-icon-components/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Two badges, not four: the package is not on npm (it installs from a GitHub release tarball or a
git tag), so there is no registry version to show, and lint runs in the same CI workflow as the
tests.

> Icon components for twelve frameworks, plus CSS mask, data URI, Flutter and SwiftUI exports, generated from Ichava icon packs pinned at a git commit.

Four packs: Tabler, flags, Twemoji and OpenMoji, 17,365 icons in all.

Node 24 or newer to install. The framework is an optional peer, for the flavour you use: React 18+, Vue 3.4+, Svelte 5, `react-native-svg` 15+, Angular 20+, SolidJS 1.8+, Preact 10.19+, Astro 5+, Qwik 1.5+ or Ember 6.3+. Elm and the exports need none.

| Kind | Targets | Where |
|---|---|---|
| Flavour (component) | React, Vue 3, Svelte 5, Web Component, React Native, Angular, SolidJS, Preact, Astro, Qwik, Ember | `@ichava/js-icon-components/<flavour>/<pack>` |
| Flavour (source) | Elm, one `Ichava.Icons.<Pack>` module per pack | `dist/elm/` |
| Export | CSS mask, data URI | `dist/assets/<pack>/icons.css`, `data-uri.json` |
| Native export | Flutter (`flutter_svg` assets), SwiftUI (`.xcassets`), both shipping the original SVG | `dist/assets/<pack>/flutter.zip`, `swiftui.zip` |

## Install

The prebuilt tarball from the GitHub release. Nothing is compiled on your machine and nothing
needs configuring:

```bash
npm install https://github.com/ichava/js-icon-components/releases/download/v0.1.0/ichava-js-icon-components-0.1.0.tgz
```

It has every pack, flavour and export (62 MB to download, most of it the CSS, data URI and native exports).
Each release also carries one tarball per pack, `ichava-js-icon-components-<pack>-0.1.0.tgz`
(`tabler`, `flag`, `emoji` or `openmoji`), installed as `@ichava/js-icon-components-<pack>` with
the same subpaths, so two packs install side by side:

```ts
import { IconMug } from '@ichava/js-icon-components-tabler/react/tabler';
import { IconKe } from '@ichava/js-icon-components-flag/react/flag';
```

Or build from a git tag. npm clones the repository, installs the compilers and runs `prepare`,
which needs `git` on the path. Choose what it builds with environment variables, or the same keys
under `"ichava": { "icons": { … } }` in your `package.json`:

```bash
ICHAVA_ICONS_PACKS=tabler ICHAVA_ICONS_FLAVOURS=react \
  npm install "github:ichava/js-icon-components#v0.1.0"
```

| Variable | `package.json` key | Effect |
|---|---|---|
| `ICHAVA_ICONS_PACKS=tabler,flag` | `"packs": ["tabler", "flag"]` | builds only those packs |
| `ICHAVA_ICONS_FLAVOURS=react,css-mask` | `"flavours": ["react", "css-mask"]` | builds only those flavours and exports |
| `ICHAVA_ICONS_SKIP_BUILD=1` | `"skipBuild": true` | builds nothing |

An import of a pack or flavour that was not built throws, naming the variable that adds it. See
[Installation](docs/installation.md) for the sizes and times of each.

## Quick start guide and usage

### Getting started

Nothing to configure. Import the flavour you use and the pack you want (`tabler`, `flag`,
`emoji` or `openmoji`); the frameworks are optional peers, so only the one you import has to be
installed. Exports are tree-shakeable, so a bundle carries the icons it imports and nothing else.

Twemoji (`emoji`) is CC-BY 4.0 and OpenMoji (`openmoji`) is CC-BY-SA 4.0: an application that ships
them takes on their attribution terms. Each pack's `ATTRIBUTION.md` ships at
`dist/<flavour>/<pack>/`; see [Packs](docs/packs.md).

### Usage

React:

```tsx
import { IconMug, IconMugFilled } from '@ichava/js-icon-components/react/tabler';

<IconMug size={20} strokeWidth={1.5} />
<IconMugFilled color="#7c3aed" title="Coffee" />
```

Flags and emoji keep their own colours:

```tsx
import { IconKe } from '@ichava/js-icon-components/react/flag';
import { IconGrinningFace } from '@ichava/js-icon-components/react/emoji';

<IconKe size={32} title="Kenya" />
<IconGrinningFace size={24} />
```

Vue 3:

```vue
<script setup lang="ts">
import { IconMug } from '@ichava/js-icon-components/vue/tabler';
</script>

<template><IconMug :size="20" title="Coffee" /></template>
```

Svelte 5, and the framework-free custom element:

```svelte
<script>
  import { IconMug } from '@ichava/js-icon-components/svelte/tabler';
</script>

<IconMug size={20} />
```

```ts
import { defineIchavaIcon, registerIcons } from '@ichava/js-icon-components/wc';
import { IconMug } from '@ichava/js-icon-components/wc/tabler';

registerIcons([IconMug]);
defineIchavaIcon(); // <ichava-icon name="tabler:outline/mug" size="20" label="Coffee"></ichava-icon>
```

React Native, Angular, SolidJS, Preact, Astro, Qwik and Ember take the same icons from their own subpath:

```tsx
import { IconMug } from '@ichava/js-icon-components/react-native/tabler';  // also /solid and /preact
<IconMug size={20} color="#7c3aed" />
```

```astro
---
import { Icon } from '@ichava/js-icon-components/astro';
import { IconMug } from '@ichava/js-icon-components/astro/tabler';  // Angular: <ichava-ng-icon [icon]="mug" />
---
<Icon icon={IconMug} size={20} title="Coffee" />
```

```tsx
import { IconMug } from '@ichava/js-icon-components/qwik/tabler';  // Ember: <Icon @icon={{IconMug}} @size={{20}} />
export default component$(() => <IconMug size={20} />);
```

Elm reads `dist/elm/` as a source directory, and the exports are files:

```elm
import Ichava.Icons.Tabler as Tabler
import Svg.Attributes

view = Tabler.iconMug [ Svg.Attributes.width "20" ]
```

```html
<link rel="stylesheet" href="node_modules/@ichava/js-icon-components/dist/assets/tabler/icons.css">
<span class="i-tabler-mug"></span>
```

Illustrations take `primaryColor` and `variant="dark"` in every component flavour; see
[Getting started](docs/getting-started.md).

The full walkthrough is in [docs/getting-started.md](docs/getting-started.md); everything else is
under [Documentation](#documentation).

## <a name="documentation"></a>Documentation

The documentation lives in this repository's [`docs/`](https://github.com/ichava/js-icon-components/tree/main/docs) folder.

### Guides

- [Installation](docs/installation.md) — the release tarball, the git build and its options, sizes and times
- [Getting started](docs/getting-started.md) — props, accessibility and export names in every flavour
- [Packs](docs/packs.md) — the four pinned packs, their licences, attribution and id prefixing
- [Architecture](docs/architecture.md) — why a generator, the pinned input, the SVG gate and the guards
- [Release](docs/release.md) — tagging, and moving a pack to a new commit

### Reference

- [React](docs/tools/react.md) — `@ichava/js-icon-components/react`
- [Vue 3](docs/tools/vue.md) — `@ichava/js-icon-components/vue`
- [Svelte 5](docs/tools/svelte.md) — `@ichava/js-icon-components/svelte`
- [Web Component](docs/tools/webcomponent.md) — `@ichava/js-icon-components/wc`
- [React Native](docs/tools/react-native.md) — `@ichava/js-icon-components/react-native`
- [Angular](docs/tools/angular.md) — `@ichava/js-icon-components/angular`
- [SolidJS](docs/tools/solid.md) — `@ichava/js-icon-components/solid`
- [Preact](docs/tools/preact.md) — `@ichava/js-icon-components/preact`
- [Astro](docs/tools/astro.md) — `@ichava/js-icon-components/astro`
- [Qwik](docs/tools/qwik.md) — `@ichava/js-icon-components/qwik`
- [Ember](docs/tools/ember.md) — `@ichava/js-icon-components/ember`
- [Elm](docs/tools/elm.md) — `dist/elm/Ichava/Icons/<Pack>.elm`
- [CSS mask](docs/tools/css-mask.md) — `dist/assets/<pack>/icons.css`
- [Data URI](docs/tools/data-uri.md) — `dist/assets/<pack>/data-uri.json`
- [Flutter](docs/tools/flutter.md) — `dist/assets/<pack>/flutter.zip`
- [SwiftUI](docs/tools/swiftui.md) — `dist/assets/<pack>/swiftui.zip`

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). This project follows the
[Contributor Covenant](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE). That covers the generator and templates, not the artwork: each pack
keeps its own licence. Tabler Icons and flag-icons are MIT, Twemoji is CC-BY 4.0 and OpenMoji is
CC-BY-SA 4.0. Each pack's `ATTRIBUTION.md`, and its licence text where the pack carries one, is
copied from the pinned commit to `dist/<flavour>/<pack>/` and `dist/assets/<pack>/`, and into every
zip.
