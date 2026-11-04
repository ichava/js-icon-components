# Svelte 5

`@ichava/js-icon-components/svelte` is the Svelte 5 flavour: one `.svelte` component per icon,
shipped as source in the Svelte convention.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/svelte/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/svelte/<pack>/<Name>.svelte` | the one icon, as a default export |
| `@ichava/js-icon-components/svelte` | the generic `Icon` component and the `SvelteIcon` type |

The deep import skips the pack index, which keeps a dev server from reading 6,000 modules.

## Usage

```svelte
<script>
  import IconMug from '@ichava/js-icon-components/svelte/tabler/IconMug.svelte';
</script>

<IconMug size={20} color="#7c3aed" strokeWidth={1.5} title="Coffee" class="me-2" />
```

Other attributes and event handlers go to the root `<svg>`; `class` merges with `ichava-icon`.

## Template

`src/svelte/Icon.svelte`. The build compiles it for client and server with `svelte/compiler` to
fail early, then ships the source; each per-icon file is a two-line wrapper that passes its data
in. `tests/svelte.test.ts` compiles both and renders three icons with `svelte/server`.

---

[← Docs index](../../README.md#documentation)
