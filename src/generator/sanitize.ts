import type { IconChild } from '../shared/index.ts';
import {
  allowedAttributeNames,
  CSS_VALUE_ATTRIBUTES,
  cssValueIsSafe,
  fragmentPattern,
  normaliseCss,
  presentationValueIsSafe,
  svgPolicy,
} from './svgPolicy.ts';

/**
 * The generator's SVG gate: parse strictly, check every element and attribute against the shared
 * policy (vendor/svg-policy.json, core's file), and return a tree.
 *
 * It REJECTS rather than strips. A build-time generator has no user waiting on a best-effort
 * render, so anything the policy would strip fails the input loudly, and the count guard turns
 * one rejected icon into a failed build instead of a silently shorter pack.
 *
 * The output is a parsed tree, never the source text, and every flavour renders from that tree.
 * So a construct this parser reads differently from a browser cannot reach the browser: what
 * ships is what was checked.
 */

/** Same caps as core (`IchavaConstants::SVG_SANITIZER_MAX_ELEMENTS` / `_MAX_BYTES`). */
export const MAX_ELEMENTS = 30_000;
export const MAX_BYTES = 4_500_000;
const MAX_DEPTH = 256;

export class SvgRejected extends Error {
  override name = 'SvgRejected';
}

export interface SanitisedSvg {
  readonly rootAttrs: Record<string, string>;
  /** Default size from the source: width, else the viewBox width, else 24. */
  readonly size: number;
  readonly nodes: IconChild[];
}

/** Elements that may hold text. Text anywhere else is whitespace or a rejection. */
const TEXT_ELEMENTS = new Set(['text', 'tspan', 'textPath', 'title', 'desc']);
/** Source metadata the component replaces with its own `title` prop. */
const DROPPED_ELEMENTS = new Set(['title', 'desc', 'metadata']);
/** Root attributes each flavour sets itself. */
const DROPPED_ROOT_ATTRS = new Set(['width', 'height', 'class', 'xmlns', 'xmlns:xlink', 'role']);

const NAME = /^[A-Za-z_][\w.:-]*/;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

interface Element {
  tag: string;
  attrs: Record<string, string>;
  children: (Element | string)[];
}

function decodeEntities(raw: string, where: string): string {
  return raw.replace(/&([^;\s&]*);?/g, (match, body: string) => {
    if (!match.endsWith(';')) throw new SvgRejected(`bare "&" in ${where}`);
    if (body in ENTITIES) return ENTITIES[body] as string;
    const num = /^#(?:x([0-9a-f]{1,6})|(\d{1,7}))$/i.exec(body);
    if (num) {
      const cp = num[1] !== undefined ? parseInt(num[1], 16) : parseInt(num[2] as string, 10);
      if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) return String.fromCodePoint(cp);
    }
    throw new SvgRejected(`entity "&${body};" in ${where} (only the five XML entities and character references)`);
  });
}

/** A strict, non-validating XML reader for the subset SVG icons use. */
function parse(source: string): Element {
  let i = 0;
  let elements = 0;
  const stack: Element[] = [];
  let root: Element | undefined;

  const text = source.replace(/^\uFEFF/, '');
  const decl = /^\s*<\?xml\s[^?]*\?>/.exec(text);
  if (decl) i = decl[0].length;

  while (i < text.length) {
    const lt = text.indexOf('<', i);
    const chunk = text.slice(i, lt === -1 ? text.length : lt);
    if (chunk.length > 0) {
      const parent = stack[stack.length - 1];
      if (chunk.trim() !== '') {
        if (!parent || !TEXT_ELEMENTS.has(parent.tag)) throw new SvgRejected('text outside a text element');
        parent.children.push(decodeEntities(chunk, `<${parent.tag}> text`));
      }
    }
    if (lt === -1) break;
    i = lt;

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end === -1) throw new SvgRejected('unterminated comment');
      i = end + 3;
      continue;
    }
    if (text.startsWith('<!', i)) throw new SvgRejected('DOCTYPE, ENTITY or CDATA declaration');
    if (text.startsWith('<?', i)) throw new SvgRejected('processing instruction');

    if (text.startsWith('</', i)) {
      const m = NAME.exec(text.slice(i + 2));
      const open = stack.pop();
      if (!m || !open || open.tag !== m[0]) throw new SvgRejected(`mismatched closing tag </${m?.[0] ?? ''}>`);
      i += 2 + m[0].length;
      const close = /^\s*>/.exec(text.slice(i));
      if (!close) throw new SvgRejected(`malformed closing tag </${open.tag}>`);
      i += close[0].length;
      continue;
    }

    const m = NAME.exec(text.slice(i + 1));
    if (!m) throw new SvgRejected('malformed tag');
    const el: Element = { tag: m[0], attrs: {}, children: [] };
    i += 1 + m[0].length;

    if (++elements > MAX_ELEMENTS) throw new SvgRejected(`more than ${MAX_ELEMENTS} elements`);
    if (stack.length >= MAX_DEPTH) throw new SvgRejected(`nested deeper than ${MAX_DEPTH}`);

    for (;;) {
      const ws = /^\s*/.exec(text.slice(i)) as RegExpExecArray;
      i += ws[0].length;
      if (text.startsWith('/>', i)) { i += 2; break; }
      if (text.startsWith('>', i)) { i += 1; stack.push(el); break; }
      if (ws[0].length === 0) throw new SvgRejected(`malformed attributes on <${el.tag}>`);
      const a = /^([A-Za-z_:][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(text.slice(i));
      if (!a) throw new SvgRejected(`malformed or unquoted attribute on <${el.tag}>`);
      const name = a[1] as string;
      if (Object.hasOwn(el.attrs, name)) throw new SvgRejected(`duplicate attribute ${name} on <${el.tag}>`);
      el.attrs[name] = decodeEntities(a[2] ?? a[3] ?? '', `${name} on <${el.tag}>`);
      i += a[0].length;
    }

    const parent = stack[stack.length - (stack[stack.length - 1] === el ? 2 : 1)];
    if (parent) parent.children.push(el);
    else if (root) throw new SvgRejected('more than one root element');
    else root = el;
  }

  if (stack.length > 0) throw new SvgRejected(`unclosed <${stack[stack.length - 1]?.tag}>`);
  if (!root) throw new SvgRejected('no root element');
  if (root.tag !== 'svg') throw new SvgRejected(`root is <${root.tag}>, not <svg>`);
  return root;
}

const allowedTags = new Set(svgPolicy.allowedTags);
const forbiddenTags = new Set(svgPolicy.forbiddenTags);
const allowedAttrs = new Set(allowedAttributeNames());
const cssAttrs = new Set(['style', ...CSS_VALUE_ATTRIBUTES]);
const fragmentRefs = new Set(svgPolicy.fragmentOnlyRefs.attributes);
const fragment = fragmentPattern();

function checkElement(el: Element): void {
  if (forbiddenTags.has(el.tag)) throw new SvgRejected(`forbidden element <${el.tag}>`);
  if (!allowedTags.has(el.tag)) throw new SvgRejected(`element <${el.tag}> is not on the allow-list`);

  for (const [name, value] of Object.entries(el.attrs)) {
    const lower = name.toLowerCase();
    if (svgPolicy.denyAttributePrefixes.some((p) => lower.startsWith(p))) {
      throw new SvgRejected(`event-handler attribute ${name} on <${el.tag}>`);
    }
    const byPrefix = svgPolicy.allowedAttributePrefixes.some((p) => lower.startsWith(p));
    if (!allowedAttrs.has(name) && !byPrefix) throw new SvgRejected(`attribute ${name} on <${el.tag}> is not on the allow-list`);
    if (fragmentRefs.has(name) && !fragment.test(value)) throw new SvgRejected(`${name} on <${el.tag}> is not a #fragment`);
    if (!presentationValueIsSafe(name, value)) throw new SvgRejected(`unsafe ${name} value on <${el.tag}>`);
    if (cssAttrs.has(name) && !cssValueIsSafe(value)) throw new SvgRejected(`unsafe CSS value in ${name} on <${el.tag}>`);
    const v = normaliseCss(value);
    if (v.includes('javascript:') || (v.includes('url(') && !cssAttrs.has(name))) {
      throw new SvgRejected(`script or url() in ${name} on <${el.tag}>`);
    }
  }
}

function toChildren(el: Element): IconChild[] {
  const out: IconChild[] = [];
  for (const child of el.children) {
    if (typeof child === 'string') { out.push(child); continue; }
    checkElement(child);
    if (DROPPED_ELEMENTS.has(child.tag)) continue;
    const kids = toChildren(child);
    out.push(kids.length > 0 ? [child.tag, child.attrs, kids] : [child.tag, child.attrs]);
  }
  return out;
}

/** Parses and checks one SVG. Throws `SvgRejected` naming the first violation. */
export function sanitiseSvg(source: string): SanitisedSvg {
  if (Buffer.byteLength(source, 'utf8') > MAX_BYTES) throw new SvgRejected(`larger than ${MAX_BYTES} bytes`);

  const root = parse(source);
  checkElement(root);

  const rootAttrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(root.attrs)) {
    if (!DROPPED_ROOT_ATTRS.has(name) && !name.startsWith('aria-')) rootAttrs[name] = value;
  }
  return { rootAttrs, size: sourceSize(root.attrs), nodes: toChildren(root) };
}

function sourceSize(source: Record<string, string>): number {
  const width = Number.parseFloat(source.width ?? '');
  if (Number.isFinite(width) && width > 0) return width;
  const box = (source.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const w = box[2];
  return w !== undefined && Number.isFinite(w) && w > 0 ? w : 24;
}
