# Web Component

`@ichava/js-icon-components/wc` is the framework-free flavour: one custom element, `<ichava-icon>`,
with no Lit and no shadow root.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/wc/<pack>` | the icon data, e.g. `IconMug` |
| `@ichava/js-icon-components/wc` | `defineIchavaIcon`, `registerIcons`, `IchavaIconElement` |

## Usage

```ts
import { defineIchavaIcon, registerIcons } from '@ichava/js-icon-components/wc';
import { IconMug, IconMugFilled } from '@ichava/js-icon-components/wc/tabler';

registerIcons([IconMug, IconMugFilled]);
defineIchavaIcon(); // or defineIchavaIcon('my-icon')
```

```html
<ichava-icon name="tabler:outline/mug" size="20" color="#7c3aed" stroke-width="1.5" label="Coffee"></ichava-icon>
```

Or skip the registry: `document.querySelector('ichava-icon').icon = IconMug`.

| Attribute | Prop it maps to |
|---|---|
| `name` | the icon id, `<pack>:<set>/<name>` |
| `size`, `color`, `stroke-width` | `size`, `color`, `strokeWidth` |
| `label` | `title`. Not `title`, which is a global HTML attribute and would add a second, native tooltip |
| `primary-color`, `variant` | illustrations: `primaryColor` and `variant` (`light` or `dark`) |

Registration is explicit, so importing a pack module defines nothing and the bundle keeps only the
icons registered. The icon renders into the element's children, so page CSS reaches it.

## Template

`src/wc/index.ts`. `tests/wc.test.ts` defines the element in jsdom with `customElements.define`
and snapshots three rendered icons.

---

[← Docs index](../../README.md#documentation)
