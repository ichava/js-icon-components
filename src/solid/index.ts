import { createComponent, createRenderEffect, mergeProps, splitProps, type Component, type JSX } from 'solid-js';
import { Dynamic, isServer } from 'solid-js/web';
import { rootAttributes, SVG_NS, themed, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

/**
 * The SolidJS flavour's one template. It is written with Solid's runtime functions rather than
 * JSX, so the same module renders on the client and on the server with no compile step of the
 * consumer's: `solid-js/web` picks its client or server build by export condition, and `Dynamic`
 * creates each element by name in the SVG namespace on the client, or as a string on the server.
 * Every generated Solid icon is `createIcon(data)`.
 */

export type { IconData, IconProps } from '../shared/index.ts';

export type SolidIconProps = IconProps & Omit<JSX.SvgSVGAttributes<SVGSVGElement>, keyof IconProps>;
export type SolidIcon = Component<SolidIconProps>;

function node(child: IconChild): JSX.Element {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return createComponent(Dynamic, mergeProps(attrs, { component: tag, children: children?.map(node) }));
}

/**
 * The `<title>`. Solid's client creates `title` in the HTML namespace, because the name is an HTML
 * element too, and an HTML `<title>` inside an `<svg>` names nothing. So the client builds it with
 * `createElementNS`; the server writes the same markup as a string.
 */
function title(text: () => string): JSX.Element {
  if (isServer) return createComponent(Dynamic, { component: 'title', get children() { return text(); } });
  const el = document.createElementNS(SVG_NS, 'title');
  createRenderEffect(() => {
    el.textContent = text();
  });
  return el as unknown as JSX.Element;
}

export function Icon(props: SolidIconProps & { icon: IconData }): JSX.Element {
  const [own, rest] = splitProps(props, ['icon', 'size', 'color', 'strokeWidth', 'title', 'primaryColor', 'variant', 'class']);
  const root = () =>
    rootAttributes(own.icon, { size: own.size, color: own.color, strokeWidth: own.strokeWidth, title: own.title, primaryColor: own.primaryColor, variant: own.variant });
  return createComponent(
    Dynamic,
    mergeProps(root, rest, {
      component: 'svg',
      // A caller's class adds to `ichava-icon` rather than replacing it, as in every flavour.
      get class() {
        return own.class ? `${root().class} ${own.class}` : root().class;
      },
      get children() {
        return [own.title ? title(() => own.title as string) : null, ...themed(own.icon, own.variant).nodes.map(node)];
      },
    }),
  );
}

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function createIcon(icon: IconData): SolidIcon {
  return (props) => createComponent(Icon, mergeProps(props, { icon }));
}
