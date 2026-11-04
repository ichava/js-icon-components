import { svgMarkup, type IconData, type IconVariant } from '../shared/index.ts';

/**
 * The helper the Ember template calls. Glimmer cannot name an element from data, so the icon is
 * written as markup from its parsed, policy-checked tree (`svgMarkup`, every attribute escaped)
 * and the template emits it with `{{{ }}}`. Positional, as a plain-function helper is called.
 */
export function iconMarkup(
  icon: IconData,
  size?: number | string,
  color?: string,
  strokeWidth?: number | string,
  title?: string,
  className?: string,
  primaryColor?: string,
  variant?: IconVariant,
): string {
  return svgMarkup(icon, { size, color, strokeWidth, title, class: className, primaryColor, variant });
}
