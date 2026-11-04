import { createElement, forwardRef, type ForwardRefExoticComponent, type ReactNode, type RefAttributes, type SVGProps } from 'react';
import { rootAttributes, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

/**
 * The React flavour's one template. Every generated React icon is `createIcon(data)`, so this
 * file is the only React code in the package; the pack modules are data plus one call per icon.
 */

export type { IconData, IconProps } from '../shared/index.ts';

export type ReactIconProps = IconProps & Omit<SVGProps<SVGSVGElement>, keyof IconProps | 'ref'>;
export type IchavaIcon = ForwardRefExoticComponent<ReactIconProps & RefAttributes<SVGSVGElement>>;

/** SVG spelling to React's: `stroke-width` → `strokeWidth`, `class` → `className`. aria-* and data-* stay. */
function reactName(name: string): string {
  if (name === 'class') return 'className';
  if (name.startsWith('aria-') || name.startsWith('data-')) return name;
  return name.replace(/[:-]([a-z])/g, (_, c: string) => c.toUpperCase());
}

function reactAttrs(attrs: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) out[reactName(name)] = value;
  return out;
}

function renderChild(child: IconChild, key: number): ReactNode {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return createElement(tag, { key, ...reactAttrs(attrs) }, children?.map(renderChild));
}

export const Icon = forwardRef<SVGSVGElement, ReactIconProps & { icon: IconData }>(function Icon(
  { icon, size, color, strokeWidth, title, className, ...rest },
  ref,
) {
  const root = reactAttrs(rootAttributes(icon, { size, color, strokeWidth, title }));
  // A caller's class adds to `ichava-icon` rather than replacing it, as Vue's fallthrough does.
  if (className) root.className = `${root.className} ${className}`;
  return (
    <svg {...root} {...rest} ref={ref}>
      {title ? <title>{title}</title> : null}
      {icon.nodes.map(renderChild)}
    </svg>
  );
});

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function createIcon(icon: IconData): IchavaIcon {
  const component = forwardRef<SVGSVGElement, ReactIconProps>(function IchavaIcon(props, ref) {
    return <Icon {...props} icon={icon} ref={ref} />;
  });
  component.displayName = icon.id;
  return component;
}
