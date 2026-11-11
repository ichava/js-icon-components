import type { IconChild } from '../shared/index.ts';
import type { NamedIcon } from './generate.ts';

/**
 * The Elm flavour: one `Ichava.Icons.<Pack>` module per pack, one function per icon,
 *
 *   iconMug : List (Svg.Attribute msg) -> Svg msg
 *
 * built with elm/svg's `Svg.node` and elm/virtual-dom's attributes, from the same parsed tree every
 * flavour renders. Elm has no npm runtime, so the module ships as source under `dist/elm/` and an
 * application adds that directory to `source-directories` in its `elm.json`.
 *
 * The caller's attributes come after the defaults, so `Svg.Attributes.width "20"` replaces the
 * default width; the root carries `role="img"` and `aria-hidden="true"`, and a caller naming the
 * icon passes `VirtualDom.attribute "aria-hidden" "false"` with a `Svg.title` child of its own.
 */

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/**
 * Elm's parser keeps line and column positions in 16 bits, so a line of 65,536 characters or more
 * fails to parse (`UNFINISHED LIST`) even when the code is valid. Measured on the flag pack: its
 * 1x1 `bo` flag broke at its 329th path when written on one line. So every element and attribute
 * goes on its own line, and a string longer than this many characters is split into `++` pieces.
 */
export const ELM_STRING_PIECE = 2_000;

const escapeElm = (value: string): string =>
  `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? `\\u{${code.toString(16).padStart(4, '0')}}` : c;
    })
    .join('')}"`;

/** An Elm string literal. Elm has no raw strings, so backslash, quote and control characters are escaped. */
export function elmString(value: string, indent = ''): string {
  const chars = Array.from(value);
  if (chars.length <= ELM_STRING_PIECE) return escapeElm(value);
  const pieces: string[] = [];
  for (let n = 0; n < chars.length; n += ELM_STRING_PIECE) pieces.push(escapeElm(chars.slice(n, n + ELM_STRING_PIECE).join('')));
  return `(${pieces.join(`\n${indent}    ++ `)}\n${indent})`;
}

/** A list in elm-format's layout: one item per line, leading commas. */
function list(items: readonly string[], indent: string): string {
  if (items.length === 0) return '[]';
  return `[ ${items.join(`\n${indent}, `)}\n${indent}]`;
}

/** `IconMugFilled` → `iconMugFilled`: an Elm function name must start lower-case. */
export const elmName = (exportName: string): string => exportName.charAt(0).toLowerCase() + exportName.slice(1);

/** `tabler` → `Tabler`, `icon-sets` → `IconSets`: an Elm module name segment. */
export const elmModuleSegment = (packId: string): string =>
  packId.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

function attribute(name: string, value: string, indent: string): string {
  if (name.startsWith('xlink:')) return `VirtualDom.attributeNS ${elmString(XLINK_NS)} ${elmString(name)} ${elmString(value, indent)}`;
  if (name.startsWith('xml:')) return `VirtualDom.attributeNS ${elmString(XML_NS)} ${elmString(name)} ${elmString(value, indent)}`;
  return `a ${elmString(name)} ${elmString(value, indent)}`;
}

function child(node: IconChild, indent: string): string {
  if (typeof node === 'string') return `Svg.text ${elmString(node, indent)}`;
  const [tag, attrs, children] = node;
  const inner = `${indent}    `;
  const a = list(Object.entries(attrs).map(([n, v]) => attribute(n, v, `${inner}  `)), inner);
  const c = list((children ?? []).map((x) => child(x, `${inner}  `)), inner);
  return `Svg.node ${elmString(tag)}\n${inner}${a}\n${inner}${c}`;
}

/** Root defaults, in SVG spelling, as `rootAttributes` would give them with no props. */
function defaults(icon: NamedIcon): [string, string][] {
  const { attrs, size } = icon.data;
  return [
    ...Object.entries(attrs).filter(([n]) => n !== 'xmlns'),
    ['width', String(size)],
    ['height', String(size)],
    ['class', 'ichava-icon'],
    ['role', 'img'],
    ['aria-hidden', 'true'],
  ];
}

export function elmModule(packId: string, icons: readonly NamedIcon[], header: string): { path: string; source: string } {
  const moduleName = `Ichava.Icons.${elmModuleSegment(packId)}`;
  const names = icons.map((i) => elmName(i.exportName));
  const comment = header.split('\n').filter(Boolean).map((l) => l.replace(/^\/\/ ?/, '').replace(/^\/\*! ?/, '').replace(/ ?\*\/$/, '')).join('\n');
  const lines = [
    `module ${moduleName} exposing\n    ( ${names.join('\n    , ')}\n    )`,
    '',
    `{-| ${comment.replace(/-}/g, '- }')}`,
    '-}',
    '',
    'import Svg exposing (Svg)',
    'import VirtualDom',
    '',
    '',
    'a : String -> String -> Svg.Attribute msg',
    'a =',
    '    VirtualDom.attribute',
    '',
    '',
    'root : List ( String, String ) -> List (Svg.Attribute msg) -> List (Svg msg) -> Svg msg',
    'root defaults attrs children =',
    '    Svg.node "svg" (List.map (\\( k, v ) -> a k v) defaults ++ attrs) children',
  ];
  for (const icon of icons) {
    const name = elmName(icon.exportName);
    lines.push(
      '',
      '',
      `{-| ${icon.data.id} -}`,
      `${name} : List (Svg.Attribute msg) -> Svg msg`,
      `${name} attrs =`,
      '    root',
      `        ${list(defaults(icon).map(([n, v]) => `( ${elmString(n)}, ${elmString(v, '          ')} )`), '        ')}`,
      '        attrs',
      `        ${list(icon.data.nodes.map((n) => child(n, '          ')), '        ')}`,
    );
  }
  return { path: `Ichava/Icons/${elmModuleSegment(packId)}.elm`, source: lines.join('\n') + '\n' };
}
