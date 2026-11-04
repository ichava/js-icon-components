# Vue 3

`@ichava/js-icon-components/vue` is the Vue 3 flavour: one functional component per icon.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/vue/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/vue` | the `Icon` component (default export), `defineIcon`, the `VueIcon` type |

## Usage

```vue
<script setup lang="ts">
import { IconMug } from '@ichava/js-icon-components/vue/tabler';
</script>

<template>
  <IconMug :size="20" color="#7c3aed" :stroke-width="1.5" title="Coffee" class="me-2" />
</template>
```

Attributes fall through to the root `<svg>`, and `class` merges with `ichava-icon`. Works in Nuxt
and in Inertia's Vue adapter unchanged.

## Template

`src/vue/Icon.vue`. The build compiles it with `@vue/compiler-sfc` (script and template) and
strips TypeScript with esbuild, so consumers need no SFC loader for it. `tests/vue.test.ts`
compiles it the same way and renders three icons with `vue/server-renderer`.

---

[← Docs index](../../README.md#documentation)
