import { createElement, forwardRef, type ForwardRefExoticComponent, type ReactNode, type RefAttributes, type SVGProps } from 'react';
import { rootAttributes, themed, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

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

function styleKey(name: string): string {
  if (name.startsWith('--')) return name;
  const camel = (s: string): string => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  if (name.startsWith('-ms-')) return camel(name.slice(1));
  if (name.startsWith('-')) {
    const rest = camel(name.slice(1));
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return camel(name);
}

/**
 * React takes `style` as an object and throws on a string, so a source `style="marker:none"` (the
 * flag pack has eight) is split into declarations. Custom properties keep their name; others are
 * camel-cased, with a vendor prefix capitalised (`-webkit-x` → `WebkitX`) as React expects. The
 * value was checked by the SVG policy before it reached the data.
 */
export function styleObject(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const declaration of css.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (name === '' || value === '') continue;
    out[styleKey(name)] = value;
  }
  return out;
}

function reactAttrs(attrs: Readonly<Record<string, string>>): Record<string, string | Record<string, string>> {
  const out: Record<string, string | Record<string, string>> = {};
  for (const [name, value] of Object.entries(attrs)) out[reactName(name)] = name === 'style' ? styleObject(value) : value;
  return out;
}

function renderChild(child: IconChild, key: number): ReactNode {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return createElement(tag, { key, ...reactAttrs(attrs) }, children?.map(renderChild));
}

export const Icon = forwardRef<SVGSVGElement, ReactIconProps & { icon: IconData }>(function Icon(
  { icon, size, color, strokeWidth, title, primaryColor, variant, className, ...rest },
  ref,
) {
  const root = reactAttrs(rootAttributes(icon, { size, color, strokeWidth, title, primaryColor, variant })) as Record<string, string>;
  // A caller's class adds to `ichava-icon` rather than replacing it, as Vue's fallthrough does.
  if (className) root.className = `${root.className} ${className}`;
  return (
    <svg {...root} {...rest} ref={ref}>
      {title ? <title>{title}</title> : null}
      {themed(icon, variant).nodes.map(renderChild)}
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
