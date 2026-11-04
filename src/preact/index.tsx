/** @jsxImportSource preact */
import { h, type ComponentChild, type FunctionComponent, type JSX, type SVGAttributes } from 'preact';
import { rootAttributes, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

/**
 * The Preact flavour's one template. Every generated Preact icon is `createIcon(data)`. Preact
 * takes SVG attribute names as they are written (`stroke-width`, `class`, `xlink:href`), so the
 * data passes through unrenamed, and a `ref` reaches the `<svg>` as an ordinary prop.
 *
 * The React flavour also runs on Preact through `preact/compat`; this one needs no compat layer.
 */

export type { IconData, IconProps } from '../shared/index.ts';

export type PreactIconProps = IconProps & Omit<SVGAttributes<SVGSVGElement>, keyof IconProps>;
export type PreactIcon = FunctionComponent<PreactIconProps>;

function renderChild(child: IconChild): ComponentChild {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return h(tag, { ...attrs }, children?.map(renderChild));
}

export function Icon({ icon, size, color, strokeWidth, title, class: className, ...rest }: PreactIconProps & { icon: IconData }): JSX.Element {
  const root = rootAttributes(icon, { size, color, strokeWidth, title });
  // A caller's class adds to `ichava-icon` rather than replacing it, as in every flavour.
  const classes = className ? `${root.class} ${String(className)}` : root.class;
  return (
    <svg {...(root as Record<string, string>)} {...rest} class={classes}>
      {title ? <title>{title}</title> : null}
      {icon.nodes.map(renderChild)}
    </svg>
  );
}

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function createIcon(icon: IconData): PreactIcon {
  const component: PreactIcon = (props) => <Icon {...props} icon={icon} />;
  component.displayName = icon.id;
  return component;
}
