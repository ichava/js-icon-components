# SolidJS

`@ichava/js-icon-components/solid` is the SolidJS flavour: one component per icon, rendered with Solid's own runtime on the client and the server.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/solid/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/solid` | `Icon`, `createIcon`, the `SolidIconProps` and `SolidIcon` types |

`solid-js` 1.8 or newer is an optional peer.

## Usage

```tsx
import { IconMug } from '@ichava/js-icon-components/solid/tabler';
import { IconGrinningFace } from '@ichava/js-icon-components/solid/twemoji';

<IconMug size={20} color="#7c3aed" strokeWidth={1.5} title="Coffee" class="me-2" />
<IconGrinningFace size={24} />
```

Props are reactive: pass a signal's value and the icon updates in place. Any other SVG attribute
goes to the root `<svg>`, and `class` is added to `ichava-icon`.

## Why there is no JSX in the template

The template calls Solid's runtime (`createComponent`, `mergeProps`, `Dynamic`) directly instead
of using JSX. Solid's JSX has to be compiled differently for the client and for the server, so a
JSX template would have to ship twice and lean on an export condition. Written this way, one module
works in both: `solid-js/web` chooses its client or server build itself.

The client creates every SVG element in the SVG namespace through `Dynamic`, except `<title>`:
Solid treats `title` as an HTML element, and an HTML `<title>` inside an `<svg>` names nothing. The
template creates that one element with `createElementNS`.

## Template

`src/solid/index.ts`, compiled by `tsc`. With no JSX there is nothing for `babel-preset-solid` to
compile, so `tests/solid.test.ts` type-checks it and renders it twice. Solid's server build renders
three icons for the snapshot. Its client build renders in jsdom, where the test checks that every
element the SVG policy allows lands in the SVG namespace and that props update in place.

## Format id

`solid`, listed in icon-browser's format registry since schema 1.5.0 and required by the registry guard.

---

[← Docs index](../../README.md#documentation)
