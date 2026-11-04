import { rootAttributes, SVG_NS, type IconChild, type IconData } from '../shared/index.ts';

/**
 * The Web Component flavour's one template: a framework-free custom element, no Lit, no shadow
 * root. The icon renders into the element's own children, so page CSS (`color`, `width`)
 * reaches it the way it reaches an inline SVG.
 *
 *   import { defineIchavaIcon, registerIcons } from '@ichava/js-icon-components/wc';
 *   import { IconMug } from '@ichava/js-icon-components/wc/tabler';
 *   registerIcons([IconMug]);
 *   defineIchavaIcon();
 *   // <ichava-icon name="tabler:outline/mug" size="20" label="Coffee"></ichava-icon>
 *
 * Or skip the registry and assign the data: `element.icon = IconMug`. Attributes: `name`, `size`,
 * `color`, `stroke-width`, and `label` for the accessible name. It is `label` and not `title`
 * because `title` is a global HTML attribute: on the host it would add a second, native tooltip.
 */

export type { IconData, IconProps } from '../shared/index.ts';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const registry = new Map<string, IconData>();

/** Makes icons resolvable by `name`. Explicit, so importing a pack module defines nothing. */
export function registerIcons(icons: readonly IconData[]): void {
  for (const icon of icons) registry.set(icon.id, icon);
}

function build(doc: Document, child: IconChild): Node {
  if (typeof child === 'string') return doc.createTextNode(child);
  const [tag, attrs, children] = child;
  const el = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'xlink:href') el.setAttributeNS(XLINK_NS, name, value);
    else if (name !== 'xmlns' && !name.startsWith('xmlns:')) el.setAttribute(name, value);
  }
  for (const c of children ?? []) el.append(build(doc, c));
  return el;
}

// Importing this module during server rendering must not throw: there is no HTMLElement there.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class IchavaIconElement extends Base {
  static readonly observedAttributes = ['name', 'size', 'color', 'stroke-width', 'label'];

  #icon: IconData | undefined;

  get icon(): IconData | undefined {
    return this.#icon;
  }

  set icon(value: IconData | undefined) {
    this.#icon = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  render(): void {
    if (!this.isConnected) return;
    const icon = this.#icon ?? registry.get(this.getAttribute('name') ?? '');
    if (!icon) {
      this.replaceChildren();
      return;
    }

    const doc = this.ownerDocument;
    const title = this.getAttribute('label') ?? undefined;
    const attrs = rootAttributes(icon, {
      size: this.getAttribute('size') ?? undefined,
      color: this.getAttribute('color') ?? undefined,
      strokeWidth: this.getAttribute('stroke-width') ?? undefined,
      title,
    });

    const svg = doc.createElementNS(SVG_NS, 'svg');
    for (const [name, value] of Object.entries(attrs)) if (name !== 'xmlns') svg.setAttribute(name, value);
    if (title) {
      const t = doc.createElementNS(SVG_NS, 'title');
      t.textContent = title;
      svg.append(t);
    }
    for (const child of icon.nodes) svg.append(build(doc, child));
    this.replaceChildren(svg);
  }
}

/** Defines the element once. Returns the tag, so `defineIchavaIcon('my-icon')` can rename it. */
export function defineIchavaIcon(tag = 'ichava-icon', registryHost: CustomElementRegistry = customElements): string {
  if (!registryHost.get(tag)) registryHost.define(tag, class extends IchavaIconElement {});
  return tag;
}
