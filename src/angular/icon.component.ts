import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { rootAttributes, type IconChild, type IconData } from '../shared/index.ts';

/**
 * The Angular flavour's one template: a standalone component that takes an icon's data.
 *
 *   import { IchavaIcon } from '@ichava/js-icon-components/angular';
 *   import { IconMug } from '@ichava/js-icon-components/angular/tabler';
 *
 *   @Component({ imports: [IchavaIcon], template: '<ichava-ng-icon [icon]="mug" size="20" label="Coffee" />' })
 *   class Page { mug = IconMug; }
 *
 * Angular templates cannot name an element tag from data, so the SVG is built with `Renderer2`,
 * which works in the browser, on the server and under hydration, and never touches `innerHTML`.
 * The selector is `ichava-ng-icon`, not `ichava-icon`, so it never claims the Web Component's tag.
 * The build compiles this file with Angular's own compiler in partial mode, the format Angular
 * libraries ship, which an application's compiler links.
 */

export type { IconData, IconProps } from '../shared/index.ts';

@Component({
  selector: 'ichava-ng-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class IchavaIcon {
  readonly icon = input.required<IconData>();
  readonly size = input<number | string>();
  readonly color = input<string>();
  readonly strokeWidth = input<number | string>();
  /**
   * The accessible name. `label`, not `title`, for the Web Component's reason: `title` is a global
   * HTML attribute, and written statically on the host it would also add a native tooltip.
   */
  readonly label = input<string>();

  readonly #host = inject<ElementRef<Element>>(ElementRef);
  readonly #renderer = inject(Renderer2);

  constructor() {
    effect(() => this.#render());
  }

  #element(tag: string, attrs: Readonly<Record<string, string>>): Element {
    const el = this.#renderer.createElement(tag, 'svg') as Element;
    for (const [name, value] of Object.entries(attrs)) {
      if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
      if (name.startsWith('xlink:')) this.#renderer.setAttribute(el, name.slice(6), value, 'xlink');
      else this.#renderer.setAttribute(el, name, value);
    }
    return el;
  }

  #append(parent: Element, child: IconChild): void {
    if (typeof child === 'string') {
      this.#renderer.appendChild(parent, this.#renderer.createText(child));
      return;
    }
    const [tag, attrs, children] = child;
    const el = this.#element(tag, attrs);
    for (const c of children ?? []) this.#append(el, c);
    this.#renderer.appendChild(parent, el);
  }

  #render(): void {
    const icon = this.icon();
    const title = this.label();
    const svg = this.#element('svg', rootAttributes(icon, { size: this.size(), color: this.color(), strokeWidth: this.strokeWidth(), title }));
    if (title) {
      const t = this.#element('title', {});
      this.#renderer.appendChild(t, this.#renderer.createText(title));
      this.#renderer.appendChild(svg, t);
    }
    for (const child of icon.nodes) this.#append(svg, child);

    const host = this.#host.nativeElement;
    for (const old of Array.from(host.childNodes)) this.#renderer.removeChild(host, old);
    this.#renderer.appendChild(host, svg);
  }
}
