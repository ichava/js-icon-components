import { jsx, type FunctionComponent, type JSXOutput } from '@builder.io/qwik';
import { rootAttributes, themed, type IconChild, type IconData, type IconProps } from '../shared/index.ts';

/**
 * The Qwik flavour's one template. Each icon is a lightweight component (a plain function, no
 * `component$`), the form Qwik documents for markup with no state of its own: it renders on the
 * server, is resumed without shipping any icon code to the client, and needs no optimizer pass
 * over this package. An application's optimizer still accepts it inside its own `component$`.
 * Written with `jsx()` rather than JSX syntax, so the shipped module is plain JavaScript.
 *
 *   import { IconMug } from '@ichava/js-icon-components/qwik/tabler';
 *   export default component$(() => <IconMug size={20} title="Coffee" />);
 */

export type { IconData, IconProps } from '../shared/index.ts';

export type QwikIconProps = IconProps & { class?: string; [attribute: string]: unknown };
export type QwikIcon = FunctionComponent<QwikIconProps>;

function node(child: IconChild): JSXOutput {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  return jsx(tag, { ...attrs, children: children?.map(node) });
}

export const Icon: FunctionComponent<QwikIconProps & { icon: IconData }> = ({ icon, size, color, strokeWidth, title, primaryColor, variant, class: className, ...rest }) => {
  const shown = themed(icon, variant);
  const root = rootAttributes(icon, { size, color, strokeWidth, title, primaryColor, variant });
  // A caller's class adds to `ichava-icon` rather than replacing it, as in every flavour.
  const classes = className ? `${root.class} ${className}` : root.class;
  return jsx('svg', {
    ...root,
    ...rest,
    class: classes,
    children: [title ? jsx('title', { children: title }) : null, ...shown.nodes.map(node)],
  });
};

/** One named component per icon. Pure, so an unused icon is dropped by the bundler. */
export function createIcon(icon: IconData): QwikIcon {
  return (props) => jsx(Icon, { ...props, icon });
}
