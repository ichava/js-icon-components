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
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** The four generated flavours, by their format-registry id (icon-browser schema, `x-ichava-formats`). */
export const FLAVOURS = ['react', 'vue', 'svelte', 'webcomponent'] as const;
export type Flavour = (typeof FLAVOURS)[number];

/**
 * Generated flavours whose format id the registry does not list yet. They are built, tested and
 * exported like the four above, but the registry guard does not require them, and asserts they are
 * still missing there: once icon-browser lists one, that test fails and the id moves into FLAVOURS.
 */
export const PENDING_FLAVOURS = ['reactNative'] as const;
export type PendingFlavour = (typeof PENDING_FLAVOURS)[number];

/** Every flavour the generator writes, registered or not. */
export const ALL_FLAVOURS = [...FLAVOURS, ...PENDING_FLAVOURS] as const;
export type AnyFlavour = Flavour | PendingFlavour;

/**
 * Root attributes in SVG (kebab-case) spelling. Each flavour converts names only if its
 * renderer needs to (React camel-cases); none of them adds or drops an attribute.
 */
export function rootAttributes(icon: IconData, props: IconProps): Record<string, string> {
  const size = props.size ?? icon.size;
  const attrs: Record<string, string> = {
    xmlns: SVG_NS,
    ...icon.attrs,
    width: String(size),
    height: String(size),
    class: 'ichava-icon',
    role: 'img',
  };

  if (props.color !== undefined && props.color !== '') attrs.color = props.color;
  if (icon.stroked && props.strokeWidth !== undefined && props.strokeWidth !== '') {
    attrs['stroke-width'] = String(props.strokeWidth);
  }
  if (props.title === undefined || props.title === '') attrs['aria-hidden'] = 'true';

  return attrs;
}
