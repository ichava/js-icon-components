import type { IconChild, IconNode } from '../shared/index.ts';

/**
 * Per-icon id prefixing. An inline SVG's ids live in the page's one id space, so two icons that
 * both define `id="color"` (every OpenMoji icon does) make the second icon's `url(#color)` paint
 * with the first icon's gradient, or with nothing once the first is hidden. Core prefixes ids for
 * the same reason.
 *
 * Every `id` becomes `<prefix><id>`, and so does every reference to one: `url(#…)` in any
 * attribute (paint, clip-path, mask, filter, style), `#…` in `href` / `xlink:href`, and the
 * whitespace-separated id lists of the ARIA relationship attributes. The prefix is a function of
 * pack, set and name alone, so a build is reproducible and the same icon has the same ids in every
 * flavour.
 *
 * The same icon rendered twice on one page still repeats its ids. Both copies define identical
 * content, so a reference resolves to the same paint whichever copy it reaches.
 */

export interface IdBearing {
  readonly rootAttrs: Record<string, string>;
  readonly nodes: IconChild[];
}

/** ARIA attributes whose value is a list of ids (WAI-ARIA 1.2, "ID reference list" and "ID reference"). */
const ARIA_ID_REFS = new Set([
  'aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details',
  'aria-errormessage', 'aria-flowto', 'aria-labelledby', 'aria-owns',
]);
const HREFS = new Set(['href', 'xlink:href']);
const URL_REF = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;

const safe = (s: string): string => s.replace(/[^A-Za-z0-9-]/g, '-');

/**
 * `<pack>_<set>_<name>_`. Pack and set ids cannot contain `_` and the name has it replaced, so the
 * prefix names exactly one icon: two icons can only share a prefix if they share pack, set and
 * name, which the export-name guard already refuses.
 */
export function idPrefix(pack: string, set: string, name: string): string {
  return `${pack}_${set}_${safe(name)}_`;
}

function rewriteAttrs(attrs: Readonly<Record<string, string>>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'id') out[name] = prefix + value;
    else if (HREFS.has(name) && value.startsWith('#')) out[name] = `#${prefix}${value.slice(1)}`;
    else if (ARIA_ID_REFS.has(name)) out[name] = value.trim().split(/\s+/).filter(Boolean).map((id) => prefix + id).join(' ');
    else out[name] = value.replace(URL_REF, (_m, q: string, id: string) => _m.replace(`${q}#${id}${q}`, `${q}#${prefix}${id}${q}`));
  }
  return out;
}

function rewriteNode(child: IconChild, prefix: string): IconChild {
  if (typeof child === 'string') return child;
  const [tag, attrs, children] = child;
  const next = rewriteAttrs(attrs, prefix);
  return children ? [tag, next, children.map((c) => rewriteNode(c, prefix))] : [tag, next];
}

/** Returns a copy with every id and id reference prefixed. The input is not modified. */
export function prefixIds<T extends IdBearing>(icon: T, prefix: string): T {
  return { ...icon, rootAttrs: rewriteAttrs(icon.rootAttrs, prefix), nodes: icon.nodes.map((c) => rewriteNode(c, prefix)) };
}

function walk(nodes: readonly IconChild[], visit: (node: IconNode) => void): void {
  for (const child of nodes) {
    if (typeof child === 'string') continue;
    visit(child);
    if (child[2]) walk(child[2], visit);
  }
}

/** Every `id` defined below the root. */
export function collectIds(nodes: readonly IconChild[]): Set<string> {
  const ids = new Set<string>();
  walk(nodes, ([, attrs]) => {
    if (attrs.id !== undefined) ids.add(attrs.id);
  });
  return ids;
}

/** Every id referenced by the root or a descendant, in document order, one entry per reference. */
export function collectRefs(icon: { readonly rootAttrs: Readonly<Record<string, string>>; readonly nodes: readonly IconChild[] }): string[] {
  const refs: string[] = [];
  const visit = (attrs: Readonly<Record<string, string>>): void => {
    for (const [name, value] of Object.entries(attrs)) {
      if (HREFS.has(name) && value.startsWith('#')) refs.push(value.slice(1));
      else if (ARIA_ID_REFS.has(name)) refs.push(...value.trim().split(/\s+/).filter(Boolean));
      else for (const m of value.matchAll(URL_REF)) refs.push(m[2] as string);
    }
  };
  visit(icon.rootAttrs);
  walk(icon.nodes, ([, attrs]) => visit(attrs));
  return refs;
}
