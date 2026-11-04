import { createElement, forwardRef, type ComponentType, type ForwardRefExoticComponent, type ReactNode, type RefAttributes } from 'react';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, FeBlend, FeColorMatrix, FeComponentTransfer, FeComposite, FeConvolveMatrix,
  FeDiffuseLighting, FeDisplacementMap, FeDropShadow, FeFlood, FeFuncA, FeFuncB, FeFuncG, FeFuncR, FeGaussianBlur,
  FeMerge, FeMergeNode, FeMorphology, FeOffset, FeSpecularLighting, FeTile, FeTurbulence, Filter, G, Line,
  LinearGradient, Mask, Path, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Symbol as SvgSymbol, Text,
  TextPath, TSpan, Use, type SvgProps,
} from 'react-native-svg';
import { rootAttributes, themed, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

/**
 * The React Native flavour's one template, on `react-native-svg`. Every generated icon is
 * `createIcon(data)`. Each SVG element maps to its react-native-svg component; attribute names
 * take React's camel case, and a `style` string is split into props, since react-native-svg reads
 * presentation from props.
 *
 * Accessibility follows React Native's props rather than the DOM's: `accessibilityRole="image"`,
 * hidden from assistive technology unless `title` is given, which becomes `accessibilityLabel`.
 */

export type { IconData, IconProps } from '../shared/index.ts';

export type NativeIconProps = IconProps & Omit<SvgProps, keyof IconProps | 'ref'>;
export type NativeIchavaIcon = ForwardRefExoticComponent<NativeIconProps & RefAttributes<Svg>>;

/** Every element the SVG policy allows, by its react-native-svg component. `switch` renders as a group. */
export const ELEMENTS: Readonly<Record<string, ComponentType<Record<string, unknown>>>> = {
  svg: Svg, g: G, switch: G, defs: Defs, symbol: SvgSymbol, use: Use,
  path: Path, circle: Circle, ellipse: Ellipse, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon,
  text: Text, tspan: TSpan, textPath: TextPath,
  linearGradient: LinearGradient, radialGradient: RadialGradient, stop: Stop, pattern: Pattern, mask: Mask, clipPath: ClipPath,
  filter: Filter, feBlend: FeBlend, feColorMatrix: FeColorMatrix, feComponentTransfer: FeComponentTransfer,
  feComposite: FeComposite, feConvolveMatrix: FeConvolveMatrix, feDiffuseLighting: FeDiffuseLighting,
  feDisplacementMap: FeDisplacementMap, feDropShadow: FeDropShadow, feFlood: FeFlood, feFuncA: FeFuncA,
  feFuncB: FeFuncB, feFuncG: FeFuncG, feFuncR: FeFuncR, feGaussianBlur: FeGaussianBlur, feMerge: FeMerge,
  feMergeNode: FeMergeNode, feMorphology: FeMorphology, feOffset: FeOffset, feSpecularLighting: FeSpecularLighting,
  feTile: FeTile, feTurbulence: FeTurbulence,
} as unknown as Record<string, ComponentType<Record<string, unknown>>>;

const camel = (name: string): string => name.replace(/[:-]([a-z])/g, (_, c: string) => c.toUpperCase());

/** SVG attributes to react-native-svg props. Web-only attributes are dropped; `xlink:href` is `href`. */
export function nativeProps(attrs: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'style') {
      for (const declaration of value.split(';')) {
        const colon = declaration.indexOf(':');
        const key = declaration.slice(0, colon).trim();
        const v = declaration.slice(colon + 1).trim();
        if (colon > 0 && v !== '' && !key.startsWith('-')) out[camel(key)] = v;
      }
    } else if (name === 'xlink:href') out.href = value;
    else if (name === 'class' || name === 'role' || name.startsWith('xmlns') || name.startsWith('xml:') || name.startsWith('aria-') || name.startsWith('data-')) continue;
    else out[camel(name)] = value;
  }
  return out;
}

function renderChild(child: IconChild, key: number): ReactNode {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  const element = ELEMENTS[tag];
  if (element === undefined) throw new Error(`react-native-svg has no component for <${tag}>`);
  return createElement(element, { key, ...nativeProps(attrs) }, children?.map(renderChild));
}

export const Icon = forwardRef<Svg, NativeIconProps & { icon: IconData }>(function Icon({ icon, size, color, strokeWidth, title, primaryColor, variant, ...rest }, ref) {
  // React Native has no CSS custom properties, so `primaryColor` reaches it as `color` alone.
  const root = rootAttributes(icon, { size, color: color ?? primaryColor, strokeWidth, title, variant });
  const named = title !== undefined && title !== '';
  return (
    <Svg
      {...nativeProps(root)}
      accessible={named}
      accessibilityRole="image"
      accessibilityLabel={named ? title : undefined}
      accessibilityElementsHidden={!named}
      importantForAccessibility={named ? 'yes' : 'no-hide-descendants'}
      {...rest}
      ref={ref}
    >
      {themed(icon, variant).nodes.map(renderChild)}
    </Svg>
  );
});

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function createIcon(icon: IconData): NativeIchavaIcon {
  const component = forwardRef<Svg, NativeIconProps>(function IchavaIcon(props, ref) {
    return <Icon {...props} icon={icon} ref={ref} />;
  });
  component.displayName = icon.id;
  return component;
}
