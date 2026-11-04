# Preact

`@ichava/js-icon-components/preact` is the Preact flavour: one function component per icon, with no compat layer.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/preact/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/preact` | `Icon`, `createIcon`, the `PreactIconProps` and `PreactIcon` types |

`preact` 10.19 or newer is an optional peer.

## Usage

```tsx
import { IconMug } from '@ichava/js-icon-components/preact/tabler';
import { IconKe } from '@ichava/js-icon-components/preact/flag';

<IconMug size={20} color="#7c3aed" strokeWidth={1.5} title="Coffee" class="me-2" />
<IconKe size={32} title="Kenya" />
```

Preact takes SVG attribute names as written, so the icon data passes through unrenamed. Any other
attribute, a `ref` included, goes to the root `<svg>`, and `class` is added to `ichava-icon`.

## Preact or React through `preact/compat`?

The React flavour also runs on Preact through `preact/compat`. This flavour is for an application
that does not alias React to compat: it imports only from `preact`, and its components are plain
Preact function components.

## Template

`src/preact/index.tsx`, with `@jsxImportSource preact`, compiled by `tsc` in the build.
`tests/preact.test.ts` compiles it with esbuild's TSX compiler against Preact's JSX runtime and
renders three icons with `preact-render-to-string`.

## Format id

`preact`, pending: icon-browser's format registry does not list it yet.

---

[← Docs index](../../README.md#documentation)
