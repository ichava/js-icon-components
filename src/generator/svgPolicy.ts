// The SVG policy interpreter, copied from ichava/react-icon-browser
// src/modules/svg/domain/svgPolicy.ts at the commit vendor/source.json records under `interpreters`.
// Only this preamble differs: that package bundles the JSON through Vite, this one reads
// vendor/svg-policy.json (a byte copy of core/resources/security/svg-policy.json, pinned by
// digest). Everything after the marker is the source from its second line, pinned by digest in
// tests/vendored.test.ts, so the runtimes agree about what the policy means.
import { readFileSync } from 'node:fs';

const policy: unknown = JSON.parse(readFileSync(new URL('../../vendor/svg-policy.json', import.meta.url), 'utf8'));

// ---- vendored body: the source file from its second line, byte for byte ----

/**
 * Derives this runtime's sanitiser configuration from the shared SVG policy.
 *
 * `svg-policy.json` is a byte-identical copy of
 * `core/resources/security/svg-policy.json`, kept in sync by
 * `icon-sets-sync/.scripts/sync-svg-policy.mjs` and pinned by digest in
 * `svgPolicy.test.ts`. It is vendored rather than imported because this package
 * has no Composer dependency on `ichava/core` and cannot reach it at build time.
 *
 * Do not hand-edit the JSON here. Edit the canonical file, run the sync script,
 * update the pinned digest.
 */

export interface SvgPolicy {
  version: number;
  allowedTags: string[];
  allowedAttributes: string[];
  allowedAttributePrefixes: string[];
  forbiddenTags: string[];
  denyAttributePrefixes: string[];
  fragmentOnlyRefs: { attributes: string[]; allow: string };
  styleAttribute: { allow: string; block: string[] };
}

const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');

/** Whether the parsed policy has the shape this runtime interprets; checked once, at load. */
export function isSvgPolicy(value: unknown): value is SvgPolicy {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const refs = v.fragmentOnlyRefs as Record<string, unknown> | undefined;
  const style = v.styleAttribute as Record<string, unknown> | undefined;
  return (
    typeof v.version === 'number' &&
    ['allowedTags', 'allowedAttributes', 'allowedAttributePrefixes', 'forbiddenTags', 'denyAttributePrefixes'].every((k) => isStrings(v[k])) &&
    typeof refs === 'object' && refs !== null && isStrings(refs.attributes) && typeof refs.allow === 'string' &&
    typeof style === 'object' && style !== null && typeof style.allow === 'string' && isStrings(style.block)
  );
}

function loadPolicy(value: unknown): SvgPolicy {
  if (!isSvgPolicy(value)) throw new Error('svg-policy.json does not have the shape SvgPolicy describes');
  return value;
}

export const svgPolicy: SvgPolicy = loadPolicy(policy);

/**
 * The by-name allow-list, which is NOT simply `policy.allowedAttributes`.
 *
 * The policy separates attributes that are safe by name from those safe only
 * after a value check, and puts the second kind in their own blocks: `style`
 * under `styleAttribute`, `href`/`xlink:href` under `fragmentOnlyRefs`. A
 * consumer that reads only `allowedAttributes` therefore strips `style` -- the
 * sole paint source for 261 of the 501 icons in one private pack, which then render as solid
 * black shapes.
 *
 * That is not hypothetical: it is exactly how this runtime was wrong before
 * being wired to the policy, and the identical mistake was made and caught on
 * the PHP side the same day. Merging them here keeps the three runtimes
 * agreeing about what the policy means, not just about what it says.
 *
 * Being on this list means "the name may appear". The value is still checked --
 * see `fragmentPattern` and the style-value guard in `sanitizeSvg.ts`.
 */
export function allowedAttributeNames(): string[] {
  const names = [...svgPolicy.allowedAttributes];

  if (svgPolicy.styleAttribute) names.push('style');
  names.push(...(svgPolicy.fragmentOnlyRefs?.attributes ?? []));

  return [...new Set(names)];
}

/** Same-document fragment references only; everything else is blocked. */
export function fragmentPattern(): RegExp {
  return new RegExp(svgPolicy.fragmentOnlyRefs.allow);
}

/**
 * Attributes whose value is a CSS paint, url or funciri, so a `url()` can reach the
 * network from them just as from `style`. Checked with the same guard.
 */
export const CSS_VALUE_ATTRIBUTES: readonly string[] = [
  'fill', 'stroke', 'filter', 'clip-path', 'mask',
  'marker', 'marker-start', 'marker-mid', 'marker-end',
  'cursor', 'stop-color', 'flood-color', 'lighting-color', 'color',
];

/** CSS functions that cannot fetch anything. Any other name before a `(` drops the value. */
const SAFE_FUNCTIONS: ReadonlySet<string> = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix',
  'var', 'calc', 'min', 'max', 'clamp',
  'translate', 'translatex', 'translatey', 'translatez', 'translate3d',
  'rotate', 'rotatex', 'rotatey', 'rotatez', 'rotate3d',
  'scale', 'scalex', 'scaley', 'scalez', 'scale3d',
  'skew', 'skewx', 'skewy', 'matrix', 'matrix3d', 'perspective',
  'cubic-bezier', 'steps',
  'blur', 'drop-shadow', 'brightness', 'contrast', 'grayscale', 'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia',
]);

/**
 * CSS Syntax 3 section 4.3.7, "consume an escaped code point", applied to a whole value.
 * `\75rl(` and `u\rl(` both become `url(`.
 *
 * A backslash-newline is removed (a line continuation inside a string, not a valid
 * escape elsewhere): removing it can only join tokens, the conservative way to be
 * wrong. Strings are deliberately NOT tracked. A decoded `\22 ` is a quote character
 * to this scanner and an identifier character to a browser, so skipping "string
 * contents" would let an attacker hide a live url() inside what only looks like one.
 */
function decodeCssEscapes(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const hex = /^[0-9a-f]{1,6}/i.exec(input.slice(i + 1, i + 7));
    if (hex) {
      const cp = parseInt(hex[0], 16);
      out += cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '�' : String.fromCodePoint(cp);
      i += hex[0].length;
      // One whitespace after the escape belongs to it; CRLF counts as one.
      const next = input[i + 1];
      if (next === '\r' && input[i + 2] === '\n') i += 2;
      else if (next === ' ' || next === '\t' || next === '\n' || next === '\r' || next === '\f') i += 1;
    } else if (i + 1 < input.length) {
      const next = input[i + 1] as string;
      if (next === '\n' || next === '\r' || next === '\f') {
        i += next === '\r' && input[i + 2] === '\n' ? 2 : 1;
      } else {
        out += next;
        i += 1;
      }
    }
    // A trailing lone backslash is dropped.
  }
  return out;
}

/**
 * Comments, then escapes, then lowercase. The order matters: a comment is removed from
 * the raw text (an unterminated one runs to the end, as in CSS), and text an escape
 * decodes into is never re-read as a comment, because a browser does not read it that
 * way either. A comment becomes nothing, not a space, so a comment inside `url` is
 * checked as `url(`: wrong in the strict direction.
 */
export function normaliseCss(value: string): string {
  return decodeCssEscapes(value.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '')).toLowerCase();
}

/** The argument of a `url` call: a same-document fragment, quotes matched. Anchored at `(`. */
const FRAGMENT_URL = /^\(\s*(?:#[^\s"'()\\]+|"#[^"'()\\]*"|'#[^"'()\\]*')\s*\)/;

/**
 * Whether a CSS value is safe to keep. It is normalised first (comments, escapes, case)
 * and then judged against an allow-list: the only `url()` that survives points at a
 * `#fragment`, every other function must be in SAFE_FUNCTIONS, and an `@` rule drops the
 * whole value. Used for `style` and for the attributes in CSS_VALUE_ATTRIBUTES.
 */
export function cssValueIsSafe(value: string): boolean {
  const v = normaliseCss(value);

  if (v.includes('@') || v.includes('behavior:') || v.includes('-moz-binding')) return false;

  for (let i = v.indexOf('('); i !== -1; i = v.indexOf('(', i + 1)) {
    let start = i;
    while (start > 0 && /[a-z0-9_-]/.test(v[start - 1] as string)) start--;
    const name = v.slice(start, i);

    if (name === 'url') {
      if (!FRAGMENT_URL.test(v.slice(i))) return false;
    } else if (name !== '' && !SAFE_FUNCTIONS.has(name)) {
      return false;
    }
  }

  return true;
}

/**
 * Values a `style` attribute may not carry. `url()` aimed off the document is the CSS
 * exfiltration vector, and so are `image-set()`, `src()` and the other functions that
 * take a URL; `expression(` and friends are script sinks in their own right. Kept under
 * its original name for existing callers.
 */
export function styleValueIsSafe(value: string): boolean {
  return cssValueIsSafe(value);
}

/**
 * `display` holds one or more bare keywords: no parens, so no `url()` or other function,
 * and no backslash, so no escape that spells one.
 */
const DISPLAY_KEYWORDS = /^[A-Za-z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*)*$/;

/** The only non-keyword a `marker-*` attribute may hold: `url(#id)`, quotes matched. */
const MARKER_REFERENCE = /^url\(\s*(?:#[A-Za-z_][\w.:-]*|"#[A-Za-z_][\w.:-]*"|'#[A-Za-z_][\w.:-]*')\s*\)$/;

/** The attributes `presentationValueIsSafe` judges. Every other name passes it. */
export const PRESENTATION_ATTRIBUTES: readonly string[] = ['display', 'color', 'marker-start', 'marker-mid', 'marker-end'];

/**
 * Value guards for the presentation attributes added in icon-sets-sync#85. OpenMoji
 * hides the construction shapes of its subdivision flags with `display="none"`, and
 * stripping it makes them render.
 *
 *  - `display`: bare keywords only, and through `cssValueIsSafe`.
 *  - `color`: `cssValueIsSafe`.
 *  - `marker-start`, `marker-mid`, `marker-end`: `none`, or `url(#id)` through `cssValueIsSafe`.
 */
export function presentationValueIsSafe(name: string, value: string): boolean {
  const v = value.trim();

  switch (name.toLowerCase()) {
    case 'display':
      return DISPLAY_KEYWORDS.test(v) && cssValueIsSafe(v);
    case 'color':
      return cssValueIsSafe(value);
    case 'marker-start':
    case 'marker-mid':
    case 'marker-end':
      return v.toLowerCase() === 'none' || (MARKER_REFERENCE.test(v) && cssValueIsSafe(v));
    default:
      return true;
  }
}
