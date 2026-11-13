# React

`@ichava/js-icon-components/react` is the React flavour: one `forwardRef` component per icon.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/react/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/react` | `Icon`, `createIcon`, the `ReactIconProps` and `IchavaIcon` types |

## Usage

```tsx
import { IconMug } from '@ichava/js-icon-components/react/tabler';

<IconMug size={20} color="#7c3aed" strokeWidth={1.5} title="Coffee" className="me-2" />
```

The ref is the `<svg>` element. Any SVG attribute in React spelling (`onClick`, `style`,
`className`) goes to the root; `className` is added to `ichava-icon`.

## From data

```tsx
import { Icon, createIcon } from '@ichava/js-icon-components/react';
import { IconMug as mug } from '@ichava/js-icon-components/data/tabler';

const Mug = createIcon(mug);
<Icon icon={mug} size={16} />
```

## Template

`src/react/index.tsx`. Compiled by `tsc` in the build and by esbuild in `tests/react.test.ts`,
which renders three icons with `react-dom/server`.

---

[← Docs index](../../README.md#documentation)
