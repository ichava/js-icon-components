# Qwik

`@ichava/js-icon-components/qwik` is the Qwik flavour: one lightweight component per icon, rendered on the server and resumed with no icon code sent to the client.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/qwik` | `Icon`, `createIcon`, the types `QwikIcon` and `QwikIconProps` |
| `@ichava/js-icon-components/qwik/<pack>` | one component per icon, e.g. `IconMug` |

`@builder.io/qwik` 1.5 or newer is an optional peer.

## Usage

```tsx
import { component$ } from '@builder.io/qwik';
import { IconMug } from '@ichava/js-icon-components/qwik/tabler';

export const Badge = component$(() => <IconMug size={20} color="#7c3aed" title="Coffee" class="me-2" />);
```

The props are the shared ones (`size`, `color`, `strokeWidth`, `title`, and for illustrations
`primaryColor` and `variant`). Anything else goes to the root `<svg>`, and `class` is added to
`ichava-icon`.

## Why a lightweight component and not `component$`

An icon has no state and no handlers, so it needs no `$` boundary: Qwik documents a plain function
for exactly this. It also means the shipped module needs no optimizer pass of its own, so it is
plain JavaScript written with Qwik's `jsx()`. Your application's optimizer still sees it, inside
your own `component$`, and treats it as markup.

## Template

`src/qwik/index.ts`, compiled by `tsc`. `tests/qwik.test.ts` bundles it with esbuild, renders three
icons with Qwik's own server renderer (`@builder.io/qwik/server`), runs Qwik's optimizer over an
application component that uses an icon, and checks the template itself passes the optimizer with
no segment split off.

## Format id

`qwik`, listed in icon-browser's format registry since schema 1.6.0 and required by the registry guard.

---

[← Docs index](../../README.md#documentation)
