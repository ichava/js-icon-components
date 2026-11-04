# Angular

`@ichava/js-icon-components/angular` is the Angular flavour: one standalone component, `IchavaIcon`, that takes an icon's data.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/angular` | `IchavaIcon`, a standalone component with the selector `ichava-ng-icon` |
| `@ichava/js-icon-components/angular/<pack>` | each icon's data by name, e.g. `IconMug` |

`@angular/core` 20 or newer is an optional peer.

## Usage

```ts
import { Component } from '@angular/core';
import { IchavaIcon } from '@ichava/js-icon-components/angular';
import { IconMug } from '@ichava/js-icon-components/angular/tabler';

@Component({
  selector: 'app-order',
  imports: [IchavaIcon],
  template: `<ichava-ng-icon [icon]="mug" [size]="20" color="#7c3aed" label="Coffee" />`,
})
export class OrderComponent {
  protected readonly mug = IconMug;
}
```

| Input | Type | Effect |
|---|---|---|
| `icon` (required) | `IconData` | the icon to draw |
| `size` | number or CSS length | `width` and `height`; default the source size |
| `color` | CSS colour | the SVG `color`, which `currentColor` paints with |
| `strokeWidth` | number or string | `stroke-width` on stroked icons only |
| `label` | string | the accessible name, as a `<title>`; without it the icon is `aria-hidden` |

The input is `label`, not `title`, for the Web Component's reason: written statically on the host,
`title` is a global HTML attribute and would add a native tooltip. The selector is
`ichava-ng-icon`, so it never claims the Web Component's `ichava-icon` tag.

## How it renders

The host is `display: contents` and holds one `<svg>`. Angular templates cannot take an element
name from data, so the component builds the SVG with `Renderer2`. That works in the browser, on
the server and under hydration, and it never uses `innerHTML`. It re-renders when an input changes.

## Template

`src/angular/icon.component.ts`. The build compiles it with Angular's compiler (`ngc -p
tsconfig.angular.json`) in partial mode, the format Angular libraries ship, which the application's
own compiler links. `tests/angular.test.ts` runs that compiler, links the output with
`@angular/compiler` and renders three icons with `@angular/platform-server`.

## Format id

`angular`, pending: icon-browser's format registry does not list it yet.

---

[← Docs index](../../README.md#documentation)
