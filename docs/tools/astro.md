# Astro

`@ichava/js-icon-components/astro` is the Astro flavour: one `Icon` component, shipped as `.astro` source, that takes an icon's data.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/astro` | `Icon` (also at `@ichava/js-icon-components/astro/Icon.astro`) |
| `@ichava/js-icon-components/astro/<pack>` | each icon's data by name, e.g. `IconMug` |

`astro` 5 or newer is an optional peer. Your application's Astro compiles the component, the way
Astro component libraries ship.

## Usage

```astro
---
import { Icon } from '@ichava/js-icon-components/astro';
import { IconMug } from '@ichava/js-icon-components/astro/tabler';
import { IconKe } from '@ichava/js-icon-components/astro/flag';
---
<Icon icon={IconMug} size={20} color="#7c3aed" title="Coffee" class="me-2" />
<Icon icon={IconKe} size={32} title="Kenya" />
```

The props are the shared four (`size`, `color`, `strokeWidth`, `title`) plus `icon`. Anything else
goes to the root `<svg>`, and `class` is added to `ichava-icon`. The icon renders on the server to
plain SVG markup and ships no JavaScript.

## Why one component and not one per icon

An Astro component is a compiled `.astro` file, so one component per icon would mean 17,365 more
source files in `dist/`, like the Svelte wrappers. Instead, the pack module exports each icon's
data by name, and one `Icon` draws any of them. Tree-shaking works the same way: a page carries the
data it imports.

## Template

`src/astro/Icon.astro` and `src/astro/Nodes.astro`, which draws the element tree, recursing through
`Astro.self`. The build checks both with Astro's compiler (`@astrojs/compiler-rs`, the one Astro 7
runs) and copies them to `dist/astro/`. `tests/astro.test.ts` compiles them with that compiler and
renders three icons with Astro's container API.

## Format id

`astro`, listed in icon-browser's format registry since schema 1.5.0 and required by the registry guard.

---

[← Docs index](../../README.md#documentation)
