# Getting started

Every flavour exposes the same icons under the same names, with the same four props.

## Export names

One rule for every flavour: `Icon` + the icon name in PascalCase, + the set name when it is not
the pack's default set. In Tabler, `outline` is the default:

| Source file | Export |
|---|---|
| `outline/mug.svg` | `IconMug` |
| `filled/mug.svg` | `IconMugFilled` |
| `outline/brand-github.svg` | `IconBrandGithub` |

Each icon also has a stable id, `<pack>:<set>/<name>` (`tabler:outline/mug`), which the Web
Component uses as its `name`.

## Props

| Prop | Type | Default | Effect |
|---|---|---|---|
| `size` | number or CSS length | the source size (24 for Tabler) | `width` and `height` |
| `color` | CSS colour | inherited | the SVG `color`, which `currentColor` paints with |
| `strokeWidth` | number or string | the source's | `stroke-width`; stroked icons only, ignored on filled ones |
| `title` | string | none | the accessible name, as a `<title>` element |
| `primaryColor` | CSS colour | none | illustrations: sets `--ichava-primary`, which an illustration paints its accent with, and `color` (an explicit `color` still wins) |
| `variant` | `'light'` or `'dark'` | `'light'` | illustrations: draws the dark theme twin when the pack carries one, else the item itself |

The Web Component takes `primary-color` and `variant` attributes; Ember takes `@primaryColor` and
`@variant`; React Native has no CSS custom properties, so `primaryColor` reaches it as `color`.

```tsx
<IconScene primaryColor="#e11d48" variant="dark" />
```

No public illustration pack ships yet (owner rule, 2026-10-30), so the props are exercised by a
test-only pack, `tests/fixtures/packs/illustration-demo`, three CC0 shapes drawn for the tests.

Anything else you pass (a class, a style, an event handler, a ref) goes to the root `<svg>`. A
class is added to `ichava-icon` rather than replacing it.

## Accessibility

Every icon renders `role="img"`. Without a `title` it is decorative and carries
`aria-hidden="true"`; with one, it is named by its `<title>` and exposed to assistive technology.
Give a title to an icon that stands alone (an icon-only button's icon, a status mark); leave it off
an icon beside a text label that already says the same thing.

## A first icon in each flavour

```tsx
// React
import { IconMug } from '@ichava/js-icon-components/react/tabler';
export const Coffee = () => <IconMug size={20} title="Coffee" />;
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { IconMug } from '@ichava/js-icon-components/vue/tabler';
</script>
<template><IconMug :size="20" title="Coffee" /></template>
```

```svelte
<!-- Svelte -->
<script>
  import { IconMug } from '@ichava/js-icon-components/svelte/tabler';
</script>
<IconMug size={20} title="Coffee" />
```

```html
<!-- Web Component -->
<script type="module">
  import { defineIchavaIcon, registerIcons } from '@ichava/js-icon-components/wc';
  import { IconMug } from '@ichava/js-icon-components/wc/tabler';
  registerIcons([IconMug]);
  defineIchavaIcon();
</script>
<ichava-icon name="tabler:outline/mug" size="20" label="Coffee"></ichava-icon>
```

The per-flavour details are under [Reference](../README.md#documentation).

---

[← Docs index](../README.md#documentation)
