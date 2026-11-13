# React Native

`@ichava/js-icon-components/react-native` is the React Native flavour: one `forwardRef` component per icon, drawn with `react-native-svg`.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/react-native/<pack>` | one component per icon, e.g. `IconMug` |
| `@ichava/js-icon-components/react-native` | `Icon`, `createIcon`, `ELEMENTS`, the `NativeIconProps` and `NativeIchavaIcon` types |

`react-native-svg` 15 or newer is an optional peer: install it in the app that uses this flavour.

## Usage

```tsx
import { IconMug } from '@ichava/js-icon-components/react-native/tabler';
import { IconKe } from '@ichava/js-icon-components/react-native/flag';

<IconMug size={20} color="#7c3aed" strokeWidth={1.5} />
<IconKe size={32} title="Kenya" />
```

The ref is the `Svg` component. Any other `Svg` prop (`style`, `onPress`, `testID`) goes to the root.

## How it differs from React

- **Elements are components.** Each SVG element renders as its `react-native-svg` component
  (`path` → `Path`, `linearGradient` → `LinearGradient`); `switch` renders as a `G`. Every element
  the SVG policy allows has one, which `tests/react-native.test.ts` checks.
- **Attributes are props.** Names take React's camel case, `xlink:href` becomes `href`, and a
  `style` string is split into props, because `react-native-svg` reads presentation from props.
  Web-only attributes (`class`, `aria-*`, `data-*`, `xmlns`) are dropped.
- **Accessibility uses React Native's props.** Every icon has `accessibilityRole="image"`. Without
  a `title` it is hidden (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`);
  with one, the title is its `accessibilityLabel`. There is no `<title>` element.

## Template

`src/react-native/index.tsx`, compiled by `tsc` in the build and type-checked against
`react-native-svg`'s own types by `npm run typecheck`. `tests/react-native.test.ts` compiles it with
esbuild and renders three icons with `react-dom/server`. In that test, a stand-in for
`react-native-svg` renders each component as a host element named after it, because the real
package needs native modules that do not load in Node.

## Format id

`reactNative`, listed in icon-browser's format registry since schema 1.5.0 and required by the registry
guard (`tests/registry.test.ts`).

---

[← Docs index](../../README.md#documentation)
