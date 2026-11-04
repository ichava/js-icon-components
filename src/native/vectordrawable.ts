import type { IconChild, IconData } from '../shared/index.ts';

/**
 * SVG → Android VectorDrawable, on the parsed tree.
 *
 * VectorDrawable is a smaller language than SVG: paths and groups, no inheritance of paint, no
 * masks, filters, patterns, `<use>` or text. So the converter resolves what SVG inherits down to
 * each path, turns every basic shape into path data, re-writes path data with explicit separators
 * (older Android parsers misread compact arc flags such as `a1 1 0 011 1`), maps `transform` to
 * nested `<group>`s, and maps `currentColor` to `?attr/colorControlNormal`, so the drawable takes
 * the theme's icon colour.
 *
 * It refuses rather than approximates. Anything it cannot express exactly throws `VdUnsupported`
 * naming the construct, and the caller lists that icon as skipped instead of writing a drawable
 * that draws something else.
 */

export class VdUnsupported extends Error {
  override name = 'VdUnsupported';
}

export const CURRENT_COLOR = '?attr/colorControlNormal';

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: string;
  linecap: string;
  linejoin: string;
  miterlimit: string;
  fillRule: string;
  fillOpacity: number;
  strokeOpacity: number;
  /** True when `paint-order` puts the stroke under the fill. */
  strokeFirst: boolean;
}

const INITIAL: Paint = {
  fill: '#000000',
  stroke: 'none',
  strokeWidth: '1',
  linecap: 'butt',
  linejoin: 'miter',
  miterlimit: '4',
  fillRule: 'nonzero',
  fillOpacity: 1,
  strokeOpacity: 1,
  strokeFirst: false,
};

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Attributes that carry no drawing in VectorDrawable and can be dropped without changing the picture. */
const INERT = new Set(['id', 'class', 'data-name', 'xml:space', 'version', 'enable-background', 'overflow', 'style', 'clip-rule']);
/** The 148 CSS named colours (CSS Color Module Level 4, §6.1), as `name rrggbb` pairs. */
const NAMED: Record<string, string> = Object.fromEntries(
  [
    'aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc',
    'bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a',
    'burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50',
    'cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b',
    'darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b',
    'darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000',
    'darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f',
    'darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff',
    'dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0',
    'forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520',
    'gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4',
    'indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5',
    'lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff',
    'lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1',
    'lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899',
    'lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32',
    'linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd',
    'mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee',
    'mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970',
    'mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6',
    'olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa',
    'palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9',
    'peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000',
    'rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460',
    'seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd',
    'slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c',
    'teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff',
    'whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32',
  ]
    .join(' ')
    .split(' ')
    .reduce<[string, string][]>((pairs, word, n, words) => (n % 2 === 0 ? [...pairs, [word, `#${(words[n + 1] as string).toUpperCase()}`]] : pairs), []),
);

const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0').toUpperCase();

/** An SVG colour as VectorDrawable writes it (`#RRGGBB` or `#AARRGGBB`), `none`, or the theme attribute. */
export function colour(value: string): string {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (lower === 'none' || lower === 'transparent') return 'none';
  if (lower === 'currentcolor') return CURRENT_COLOR;
  if (lower in NAMED) return NAMED[lower] as string;
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return `#${m[1]}`.toUpperCase();
  m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(v);
  if (m) return `#${m[2]}${m[1]}`.toUpperCase();
  m = /^rgb\(\s*(\d+(?:\.\d+)?)(%?)\s*[, ]\s*(\d+(?:\.\d+)?)(%?)\s*[, ]\s*(\d+(?:\.\d+)?)(%?)\s*\)$/i.exec(v);
  if (m) {
    const c = (n: string, pct: string): string => hex2(Math.min(255, pct === '%' ? (Number(n) * 255) / 100 : Number(n)));
    return `#${c(m[1] as string, m[2] as string)}${c(m[3] as string, m[4] as string)}${c(m[5] as string, m[6] as string)}`;
  }
  if (/^url\(/i.test(v)) throw new VdUnsupported(`paint server ${v} (gradient or pattern)`);
  throw new VdUnsupported(`colour "${v}"`);
}

/** A plain number, or a number in `px`. Anything relative (`%`, `em`) has no VectorDrawable meaning. */
function num(value: string | undefined, what: string, fallback = 0): number {
  if (value === undefined || value.trim() === '') return fallback;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(px|pt)?\s*$/i.exec(value);
  if (!m) throw new VdUnsupported(`${what}="${value}"`);
  // CSS fixes 1pt at 4/3 px, and a user unit is a px, so a point is exact.
  return m[2]?.toLowerCase() === 'pt' ? (Number(m[1]) * 4) / 3 : Number(m[1]);
}

/** A short decimal: at most 4 places, no trailing zeros, no `-0`. */
export function fmt(n: number): string {
  const s = (Math.round(n * 10_000) / 10_000).toString();
  return s === '-0' ? '0' : s;
}

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/**
 * Path data, re-written with a separator between every number and arc flags read as single
 * digits, so `a1 1 0 011 1` becomes `a1 1 0 0 1 1 1`. Invalid data throws.
 */
export function normalisePath(d: string): string {
  const out: string[] = [];
  let i = 0;
  const ws = (): void => {
    while (i < d.length && /[\s,]/.test(d[i] as string)) i++;
  };
  const number = (): string => {
    ws();
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i));
    if (!m) throw new VdUnsupported(`path data near "${d.slice(i, i + 12)}"`);
    i += m[0].length;
    // The number as written: Android's parser reads every form SVG does once it is separated.
    return m[0];
  };
  const flag = (): string => {
    ws();
    const c = d[i];
    if (c !== '0' && c !== '1') throw new VdUnsupported(`arc flag near "${d.slice(i, i + 12)}"`);
    i++;
    return c;
  };
  let command = '';
  ws();
  while (i < d.length) {
    const c = d[i] as string;
    if (/[a-z]/i.test(c)) {
      command = c;
      i++;
      if (!(c.toLowerCase() in ARGS)) throw new VdUnsupported(`path command "${c}"`);
      if (c.toLowerCase() === 'z') {
        out.push(c);
        ws();
        continue;
      }
    } else if (command === '' || command.toLowerCase() === 'z') {
      throw new VdUnsupported(`path data near "${d.slice(i, i + 12)}"`);
    } else if (command === 'm') command = 'l';
    else if (command === 'M') command = 'L';
    const lower = command.toLowerCase();
    const args: string[] = [];
    if (lower === 'a') args.push(number(), number(), number(), flag(), flag(), number(), number());
    else for (let n = 0; n < (ARGS[lower] as number); n++) args.push(number());
    out.push(`${command}${args.join(' ')}`);
    ws();
  }
  if (out.length === 0) throw new VdUnsupported('empty path data');
  return out.join(' ');
}

function points(value: string | undefined): number[] {
  const nums = (value ?? '').trim().split(/[\s,]+/).filter(Boolean).map((p) => num(p, 'points'));
  if (nums.length < 4 || nums.length % 2 !== 0) throw new VdUnsupported(`points="${value}"`);
  return nums;
}

/** A basic shape as path data. */
export function shapePath(tag: string, a: Readonly<Record<string, string>>): string | undefined {
  switch (tag) {
    case 'path':
      return a.d === undefined || a.d.trim() === '' ? undefined : normalisePath(a.d);
    case 'rect': {
      const x = num(a.x, 'x'), y = num(a.y, 'y'), w = num(a.width, 'width'), h = num(a.height, 'height');
      if (w <= 0 || h <= 0) return undefined;
      let rx = a.rx === undefined ? undefined : num(a.rx, 'rx');
      let ry = a.ry === undefined ? undefined : num(a.ry, 'ry');
      rx ??= ry ?? 0;
      ry ??= rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) return `M${fmt(x)} ${fmt(y)} h${fmt(w)} v${fmt(h)} h${fmt(-w)} Z`;
      return [
        `M${fmt(x + rx)} ${fmt(y)}`, `h${fmt(w - 2 * rx)}`, `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(rx)} ${fmt(ry)}`,
        `v${fmt(h - 2 * ry)}`, `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(-rx)} ${fmt(ry)}`, `h${fmt(-(w - 2 * rx))}`,
        `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(-rx)} ${fmt(-ry)}`, `v${fmt(-(h - 2 * ry))}`, `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(rx)} ${fmt(-ry)}`, 'Z',
      ].join(' ');
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(a.cx, 'cx'), cy = num(a.cy, 'cy');
      const rx = tag === 'circle' ? num(a.r, 'r') : num(a.rx, 'rx');
      const ry = tag === 'circle' ? rx : num(a.ry, 'ry');
      if (rx <= 0 || ry <= 0) return undefined;
      return `M${fmt(cx - rx)} ${fmt(cy)} a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0 a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0 Z`;
    }
    case 'line':
      return `M${fmt(num(a.x1, 'x1'))} ${fmt(num(a.y1, 'y1'))} L${fmt(num(a.x2, 'x2'))} ${fmt(num(a.y2, 'y2'))}`;
    case 'polyline':
    case 'polygon': {
      const p = points(a.points);
      const segs = [`M${fmt(p[0] as number)} ${fmt(p[1] as number)}`];
      for (let n = 2; n < p.length; n += 2) segs.push(`L${fmt(p[n] as number)} ${fmt(p[n + 1] as number)}`);
      if (tag === 'polygon') segs.push('Z');
      return segs.join(' ');
    }
    default:
      return undefined;
  }
}

/** `style="fill:red;stroke-width:2"` merged over the attributes, as CSS outranks presentation attributes. */
function withStyle(attrs: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = { ...attrs };
  for (const declaration of (attrs.style ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (name !== '' && value !== '') out[name] = value;
  }
  delete out.style;
  return out;
}

const opacity = (v: string | undefined, what: string): number => {
  if (v === undefined) return 1;
  const pct = /^\s*([\d.]+)%\s*$/.exec(v);
  const n = pct ? Number(pct[1]) / 100 : num(v, what);
  return Math.max(0, Math.min(1, n));
};

/**
 * `paint-order`: whether the stroke is drawn before the fill. VectorDrawable always draws fill then
 * stroke, so stroke-first becomes two paths, the stroke one first. Markers are refused elsewhere.
 */
function strokeFirst(value: string): boolean {
  const order = value.trim().split(/\s+/).filter((w) => w !== 'markers');
  if (order[0] === 'normal' || order.length === 0) return false;
  if (!order.every((w) => w === 'fill' || w === 'stroke')) throw new VdUnsupported(`paint-order="${value}"`);
  return order[0] === 'stroke';
}

/** The paint a node passes to its children: SVG inheritance, which VectorDrawable does not have. */
function inherit(parent: Paint, a: Readonly<Record<string, string>>): Paint {
  return {
    fill: a.fill !== undefined ? colour(a.fill) : parent.fill,
    stroke: a.stroke !== undefined ? colour(a.stroke) : parent.stroke,
    strokeWidth: a['stroke-width'] !== undefined ? fmt(num(a['stroke-width'], 'stroke-width')) : parent.strokeWidth,
    linecap: a['stroke-linecap'] ?? parent.linecap,
    linejoin: a['stroke-linejoin'] ?? parent.linejoin,
    miterlimit: a['stroke-miterlimit'] !== undefined ? fmt(num(a['stroke-miterlimit'], 'stroke-miterlimit')) : parent.miterlimit,
    fillRule: a['fill-rule'] ?? parent.fillRule,
    fillOpacity: a['fill-opacity'] !== undefined ? opacity(a['fill-opacity'], 'fill-opacity') : parent.fillOpacity,
    strokeOpacity: a['stroke-opacity'] !== undefined ? opacity(a['stroke-opacity'], 'stroke-opacity') : parent.strokeOpacity,
    strokeFirst: a['paint-order'] !== undefined ? strokeFirst(a['paint-order']) : parent.strokeFirst,
  };
}

/** Every attribute VectorDrawable can express here; anything else on a drawn element is refused. */
const PAINT_ATTRS = new Set([
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule',
  'fill-opacity', 'stroke-opacity', 'opacity', 'transform', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
  'x1', 'y1', 'x2', 'y2', 'points', 'display', 'visibility', 'stroke-dasharray', 'stroke-dashoffset', 'vector-effect', 'paint-order',
]);

function checkAttrs(tag: string, a: Readonly<Record<string, string>>): void {
  for (const name of ['mask', 'filter', 'clip-path']) if (a[name] !== undefined) throw new VdUnsupported(name);
  for (const [name, value] of Object.entries(a)) {
    // Font properties only reach text, which is refused anyway; vendor-prefixed ones (`-inkscape-stroke`) draw nothing.
    if (INERT.has(name) || name.startsWith('data-') || name.startsWith('aria-') || name.startsWith('xmlns') || name.startsWith('font-') || name.startsWith('-')) continue;
    if (!PAINT_ATTRS.has(name) && !(tag === 'rect' && (name === 'x' || name === 'y'))) throw new VdUnsupported(`<${tag}> attribute ${name}`);
    if (name === 'stroke-dasharray' && value.trim() !== 'none') throw new VdUnsupported('stroke-dasharray (dashes)');
    if (name === 'vector-effect' && value.trim() !== 'none') throw new VdUnsupported(`vector-effect="${value}"`);
  }
}

/** A transform value with enough digits that decomposing a matrix loses nothing visible. */
const exact = (n: number): string => {
  const s = Number(n.toPrecision(10)).toString();
  return s === '-0' ? '0' : s;
};

/**
 * `matrix(a b c d e f)` as one group. A group applies scale, then rotation, then translation, so it
 * can hold any matrix whose two columns are perpendicular (no skew): scaleX = |(a, b)|, the rotation
 * is the angle of (a, b), and scaleY = det / scaleX, negative for a reflection. A skewed matrix has
 * no group form and is refused.
 */
function matrixGroup([a, b, c, d, e, f]: [number, number, number, number, number, number], value: string): Record<string, string> {
  const sx = Math.hypot(a, b);
  const det = a * d - b * c;
  if (sx === 0 || det === 0 || Math.abs(a * c + b * d) > 1e-9 * Math.max(1, sx * Math.hypot(c, d))) throw new VdUnsupported(`transform ${value.trim()} (skew)`);
  const group: Record<string, string> = {};
  const rotation = (Math.atan2(b, a) * 180) / Math.PI;
  const sy = det / sx;
  if (sx !== 1 || sy !== 1) Object.assign(group, { 'android:scaleX': exact(sx), 'android:scaleY': exact(sy) });
  if (rotation !== 0) group['android:rotation'] = exact(rotation);
  if (e !== 0 || f !== 0) Object.assign(group, { 'android:translateX': exact(e), 'android:translateY': exact(f) });
  return group;
}

/** `transform` as nested groups, outermost first, each one VectorDrawable step. */
export function transformGroups(value: string | undefined): Record<string, string>[] {
  if (value === undefined || value.trim() === '') return [];
  const groups: Record<string, string>[] = [];
  const re = /\s*([a-zA-Z]+)\s*\(([^)]*)\)\s*,?/gy;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(value)) !== null) {
    consumed = re.lastIndex;
    const fn = m[1] as string;
    const n = (m[2] as string).trim().split(/[\s,]+/).filter(Boolean).map((v) => num(v, `transform ${fn}`));
    if (fn === 'matrix' && n.length === 6) groups.push(matrixGroup(n as [number, number, number, number, number, number], value));
    else if (fn === 'translate' && (n.length === 1 || n.length === 2)) groups.push({ 'android:translateX': fmt(n[0] as number), 'android:translateY': fmt(n[1] ?? 0) });
    else if (fn === 'scale' && (n.length === 1 || n.length === 2)) groups.push({ 'android:scaleX': fmt(n[0] as number), 'android:scaleY': fmt(n[1] ?? (n[0] as number)) });
    else if (fn === 'rotate' && (n.length === 1 || n.length === 3)) {
      groups.push({ 'android:rotation': fmt(n[0] as number), ...(n.length === 3 ? { 'android:pivotX': fmt(n[1] as number), 'android:pivotY': fmt(n[2] as number) } : {}) });
    } else throw new VdUnsupported(`transform ${fn}(${m[2]})`);
  }
  if (value.slice(consumed).trim() !== '') throw new VdUnsupported(`transform "${value}"`);
  return groups;
}

const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const xmlAttrs = (a: Record<string, string>): string => Object.entries(a).map(([n, v]) => ` ${n}="${esc(v)}"`).join('');

function pathElement(d: string, paint: Paint, alpha: number): string | undefined {
  const fill = paint.fill !== 'none';
  const stroke = paint.stroke !== 'none' && Number(paint.strokeWidth) > 0;
  if (!fill && !stroke) return undefined;
  if (fill && stroke && paint.strokeFirst) {
    if (alpha < 1) throw new VdUnsupported('opacity on a shape with both fill and stroke (they composite as a group)');
    const under = pathElement(d, { ...paint, fill: 'none', strokeFirst: false }, alpha) as string;
    const over = pathElement(d, { ...paint, stroke: 'none', strokeFirst: false }, alpha) as string;
    return `${under}\n${over}`;
  }
  if (alpha < 1 && fill && stroke) throw new VdUnsupported('opacity on a shape with both fill and stroke (they composite as a group)');
  const a: Record<string, string> = { 'android:pathData': d };
  if (fill) {
    a['android:fillColor'] = paint.fill;
    if (paint.fillOpacity * alpha < 1) a['android:fillAlpha'] = fmt(paint.fillOpacity * alpha);
    if (paint.fillRule === 'evenodd') a['android:fillType'] = 'evenOdd';
  }
  if (stroke) {
    a['android:strokeColor'] = paint.stroke;
    a['android:strokeWidth'] = paint.strokeWidth;
    if (paint.strokeOpacity * alpha < 1) a['android:strokeAlpha'] = fmt(paint.strokeOpacity * alpha);
    if (paint.linecap !== 'butt') a['android:strokeLineCap'] = paint.linecap;
    if (paint.linejoin !== 'miter') {
      if (!['round', 'bevel'].includes(paint.linejoin)) throw new VdUnsupported(`stroke-linejoin="${paint.linejoin}"`);
      a['android:strokeLineJoin'] = paint.linejoin;
    }
    if (paint.miterlimit !== '4') a['android:strokeMiterLimit'] = paint.miterlimit;
  }
  if (!['butt', 'round', 'square'].includes(paint.linecap)) throw new VdUnsupported(`stroke-linecap="${paint.linecap}"`);
  return `<path${xmlAttrs(a)}/>`;
}

function convert(child: IconChild, paint: Paint, depth: number): string[] {
  if (typeof child === 'string') {
    if (child.trim() === '') return [];
    throw new VdUnsupported('text');
  }
  const [tag, raw, children] = child;
  const a = withStyle(raw);
  if (a.display === 'none') return [];
  if (a.visibility === 'hidden') return [];
  const pad = '    '.repeat(depth);

  if (tag !== 'g' && !SHAPES.has(tag)) throw new VdUnsupported(`<${tag}>`);
  checkAttrs(tag, a);
  const next = inherit(paint, a);
  const alpha = opacity(a.opacity, 'opacity');
  const groups = transformGroups(a.transform);

  let body: string[];
  if (tag === 'g') {
    if (alpha < 1 && (children ?? []).filter((c) => typeof c !== 'string').length > 1) throw new VdUnsupported('opacity on a group of several shapes');
    const inner = (children ?? []).flatMap((c) => convert(c, alpha < 1 ? { ...next, fillOpacity: next.fillOpacity * alpha, strokeOpacity: next.strokeOpacity * alpha } : next, depth + groups.length));
    body = inner;
  } else {
    if ((children ?? []).some((c) => typeof c !== 'string' || c.trim() !== '')) throw new VdUnsupported(`<${tag}> with children`);
    const d = shapePath(tag, a);
    const p = d === undefined ? undefined : pathElement(d, tag === 'line' || tag === 'polyline' ? { ...next, fill: 'none' } : next, alpha);
    body = p === undefined ? [] : p.split('\n').map((line) => `${pad}${'    '.repeat(groups.length)}${line}`);
  }
  if (body.length === 0) return [];
  for (let n = groups.length - 1; n >= 0; n--) {
    const gpad = pad + '    '.repeat(n);
    body = [`${gpad}<group${xmlAttrs(groups[n] as Record<string, string>)}>`, ...body, `${gpad}</group>`];
  }
  return body;
}

/** The viewBox as numbers, or the source size. A non-zero origin becomes a translating group. */
function viewBox(icon: IconData): [number, number, number, number] {
  const vb = icon.attrs.viewBox;
  if (vb === undefined) return [0, 0, icon.size, icon.size];
  const n = vb.trim().split(/[\s,]+/).map((v) => num(v, 'viewBox'));
  if (n.length !== 4 || (n[2] as number) <= 0 || (n[3] as number) <= 0) throw new VdUnsupported(`viewBox="${vb}"`);
  return n as [number, number, number, number];
}

/** One icon as VectorDrawable XML. Throws `VdUnsupported` for anything it would have to approximate. */
export function toVectorDrawable(icon: IconData): string {
  const [minX, minY, w, h] = viewBox(icon);
  const rootAttrs = withStyle(icon.attrs);
  for (const name of ['mask', 'filter', 'clip-path', 'transform', 'color']) if (rootAttrs[name] !== undefined) throw new VdUnsupported(`root ${name}`);
  if ((rootAttrs['stroke-dasharray'] ?? 'none').trim() !== 'none') throw new VdUnsupported('stroke-dasharray (dashes)');
  const paint = inherit(INITIAL, rootAttrs);
  const offset = minX !== 0 || minY !== 0;
  let body = icon.nodes.flatMap((c) => convert(c, paint, offset ? 2 : 1));
  if (body.length === 0) throw new VdUnsupported('nothing to draw');
  if (offset) body = [`    <group android:translateX="${fmt(-minX)}" android:translateY="${fmt(-minY)}">`, ...body, '    </group>'];
  const width = icon.size;
  const height = (icon.size * h) / w;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<!-- ${icon.id} -->`,
    `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${fmt(width)}dp" android:height="${fmt(height)}dp" android:viewportWidth="${fmt(w)}" android:viewportHeight="${fmt(h)}">`,
    ...body,
    '</vector>',
    '',
  ].join('\n');
}
