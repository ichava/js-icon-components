/**
 * The framework-free contract every flavour renders: the icon data the generator emits, the
 * props every component accepts, and the one function that turns the two into root attributes.
 *
 * Plain data on purpose. A pack module is a list of `export const IconX = {...}` objects with no
 * side effects, so a bundler keeps only the icons an application imports.
 */

/** An element: tag, attributes, children. A string child is text (only inside `<text>`). */
export type IconNode = readonly [tag: string, attrs: Readonly<Record<string, string>>, children?: readonly IconChild[]];
export type IconChild = IconNode | string;

/** Mirrors core's `IconKind`. Illustrations stay hidden until a vetted public set exists. */
export type IconKind = 'icon' | 'illustration';

export interface IconData {
  /** Stable id, `<pack>:<set>/<name>`, e.g. `tabler:outline/mug`. */
  readonly id: string;
  readonly pack: string;
  readonly set: string;
  readonly name: string;
  readonly kind: IconKind;
  /** Root `<svg>` attributes from the source, minus width, height, class, xmlns and xlink. */
  readonly attrs: Readonly<Record<string, string>>;
  /** True when the root carries `stroke-width`, which is when `strokeWidth` applies. */
  readonly stroked: boolean;
  /** Width and height of the source in user units, used as the default `size`. */
  readonly size: number;
  readonly nodes: readonly IconChild[];
  /**
   * Theme twins, for illustrations whose pack declares them (`themeVariants` in packs.json, the
   * same `"dark": "-dark"` suffix rule as core's `theme_variants`). `scene-dark.svg` is not an item
   * of its own: it is `variants.dark` of `scene.svg`. Absent on every icon without a twin.
   */
  readonly variants?: Readonly<Partial<Record<IconVariant, IconTheme>>>;
}

/** The theme twins an illustration may carry. `light` is the item itself. */
export const ICON_VARIANTS = ['light', 'dark'] as const;
export type IconVariant = (typeof ICON_VARIANTS)[number];

/** One theme twin: its own root attributes and tree, already checked by the same policy. */
export interface IconTheme {
  readonly attrs: Readonly<Record<string, string>>;
  readonly nodes: readonly IconChild[];
}

/** The props every flavour accepts, by these names. */
export interface IconProps {
  /** Width and height. A number is pixels; a string is any CSS length. Default: the source size. */
  size?: number | string;
  /** Sets the SVG `color`, which `currentColor` paints with. Default: inherited. */
  color?: string;
  /** Overrides `stroke-width` on stroked icons; ignored on filled ones. */
  strokeWidth?: number | string;
  /** The accessible name. Without it the icon is decorative and hidden from assistive tech. */
  title?: string;
  /**
   * Illustrations: the brand colour. Sets the `--ichava-primary` custom property, which an
   * illustration paints its accent with (`fill="var(--ichava-primary, …)"`), and `color`, so a
   * `currentColor` accent follows it too. An explicit `color` still wins for `color`.
   */
  primaryColor?: string;
  /** Illustrations: which theme twin to draw. `dark` falls back to the item when it has no twin. */
  variant?: IconVariant;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** The four generated flavours, by their format-registry id (icon-browser schema, `x-ichava-formats`). */
export const FLAVOURS = ['react', 'vue', 'svelte', 'webcomponent'] as const;
export type Flavour = (typeof FLAVOURS)[number];

/**
 * The Tier 2 generated flavours. icon-browser's registry lists them since schema 1.5.0, so the
 * registry guard (`tests/registry.test.ts`) requires them like the four above; they stay a separate
 * list because the generator writes them through `PENDING_OUTPUTS`.
 */
export const PENDING_FLAVOURS = ['reactNative', 'angular', 'solid', 'preact', 'astro'] as const;
export type PendingFlavour = (typeof PENDING_FLAVOURS)[number];

/**
 * The Tier 3 generated flavours, listed by icon-browser's registry since schema 1.6.0. Qwik and
 * Ember are JavaScript modules like the others; Elm ships one source module per pack under
 * `dist/elm/`, which an `elm.json` `source-directories` entry reads, because Elm has no npm runtime.
 */
export const TIER3_FLAVOURS = ['qwik', 'ember', 'elm'] as const;
export type Tier3Flavour = (typeof TIER3_FLAVOURS)[number];

/** Every flavour the generator writes; the registry guard requires all of them. */
export const ALL_FLAVOURS = [...FLAVOURS, ...PENDING_FLAVOURS, ...TIER3_FLAVOURS] as const;
export type AnyFlavour = Flavour | PendingFlavour | Tier3Flavour;

/**
 * The asset exports, by their registry id (`delivery: "asset"`). Each writes files under
 * `dist/assets/<pack>/` rather than a module; the last two are the native targets
 * (`native: true` in the registry). Every one carries SVG: the ichava icon ecosystem is strictly
 * SVG (owner rule, 2026-11-04), so `android-vd` left with icon-browser's schema 1.8.0.
 */
export const ASSET_TARGETS = ['css-mask', 'data-uri', 'flutter', 'swiftui'] as const;
export type AssetTarget = (typeof ASSET_TARGETS)[number];
export const NATIVE_TARGETS = ['flutter', 'swiftui'] as const satisfies readonly AssetTarget[];

/** Every format the generator owns: the generated flavours and the asset exports. */
export const GENERATOR_FORMATS = [...ALL_FLAVOURS, ...ASSET_TARGETS] as const;

/**
 * The icon as `variant` draws it: the dark twin's attributes and tree when asked for and present,
 * else the icon itself. Every flavour renders what this returns, so the switch is one rule.
 */
export function themed(icon: IconData, variant: IconVariant | undefined): IconData {
  if (variant === undefined || variant === 'light') return icon;
  const twin = icon.variants?.[variant];
  return twin === undefined ? icon : { ...icon, attrs: twin.attrs, nodes: twin.nodes };
}

/**
 * Root attributes in SVG (kebab-case) spelling. Each flavour converts names only if its
 * renderer needs to (React camel-cases); none of them adds or drops an attribute.
 */
export function rootAttributes(source: IconData, props: IconProps): Record<string, string> {
  const icon = themed(source, props.variant);
  const size = props.size ?? icon.size;
  const attrs: Record<string, string> = {
    xmlns: SVG_NS,
    ...icon.attrs,
    width: String(size),
    height: String(size),
    class: 'ichava-icon',
    role: 'img',
  };

  if (props.primaryColor !== undefined && props.primaryColor !== '') {
    attrs.color = props.primaryColor;
    const own = (attrs.style ?? '').trim().replace(/;$/, '');
    attrs.style = `${own === '' ? '' : `${own};`}--ichava-primary:${props.primaryColor}`;
  }
  if (props.color !== undefined && props.color !== '') attrs.color = props.color;
  if (icon.stroked && props.strokeWidth !== undefined && props.strokeWidth !== '') {
    attrs['stroke-width'] = String(props.strokeWidth);
  }
  if (props.title === undefined || props.title === '') attrs['aria-hidden'] = 'true';

  return attrs;
}

const escapeAttr = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeText = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function serialiseChild(child: IconChild): string {
  if (typeof child === 'string') return escapeText(child);
  const [tag, attrs, children] = child;
  const open = `<${tag}${Object.entries(attrs).map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join('')}`;
  return children === undefined || children.length === 0 ? `${open}/>` : `${open}>${children.map(serialiseChild).join('')}</${tag}>`;
}

/**
 * SVG markup from a root's attributes and a tree, escaped. Written from the parsed tree, never
 * from source text, so it carries exactly what the policy checked. The Ember flavour renders with
 * it, and the asset exports encode it.
 */
export function serialiseSvg(attrs: Readonly<Record<string, string>>, nodes: readonly IconChild[], title?: string): string {
  const inner = (title ? `<title>${escapeText(title)}</title>` : '') + nodes.map(serialiseChild).join('');
  return `<svg${Object.entries(attrs).map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join('')}>${inner}</svg>`;
}

/** An icon as markup with the component props applied, as every flavour renders it. */
export function svgMarkup(icon: IconData, props: IconProps & { class?: string }): string {
  const attrs = rootAttributes(icon, props);
  if (props.class) attrs.class = `${attrs.class} ${props.class}`;
  return serialiseSvg(attrs, themed(icon, props.variant).nodes, props.title || undefined);
}
