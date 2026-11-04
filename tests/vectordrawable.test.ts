import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { androidZip, slugs } from '../src/generator/assets.ts';
import { buildIcons, readPack } from '../src/generator/generate.ts';
import { colour, CURRENT_COLOR, normalisePath, toVectorDrawable, transformGroups, VdUnsupported } from '../src/native/vectordrawable.ts';
import type { IconData } from '../src/shared/index.ts';
import { iconsFrom, pack, ROOT } from './helpers.ts';

/**
 * The SVG → VectorDrawable converter: golden XML for five Tabler icons, every output of the whole
 * Tabler and flag packs parsed as XML with the Android schema's element and attribute names, and
 * the constructs it must refuse, each refused with its name rather than drawn wrong.
 */

const GOLDEN = ['IconMug', 'IconMugFilled', 'IconBrandGithub', 'IconCircleCheck', 'IconSquareRoundedPlus'] as const;

const fixture = (svg: string): IconData =>
  (buildIcons({ id: 'fixture', defaultSet: 'x', kind: 'icon' }, [{ set: 'x', name: 'f', path: 'x/f.svg', svg }], { prefix: false }).icons[0] as { data: IconData }).data;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

/** The element and attribute names VectorDrawable defines (developer.android.com, VectorDrawable). */
const VD_ELEMENTS = new Set(['vector', 'group', 'path']);
const VD_ATTRS: Record<string, Set<string>> = {
  vector: new Set(['xmlns:android', 'android:width', 'android:height', 'android:viewportWidth', 'android:viewportHeight']),
  group: new Set(['android:translateX', 'android:translateY', 'android:scaleX', 'android:scaleY', 'android:rotation', 'android:pivotX', 'android:pivotY']),
  path: new Set([
    'android:pathData', 'android:fillColor', 'android:fillAlpha', 'android:fillType', 'android:strokeColor', 'android:strokeWidth',
    'android:strokeAlpha', 'android:strokeLineCap', 'android:strokeLineJoin', 'android:strokeMiterLimit',
  ]),
};

/** Validates one drawable: well-formed XML, and only VectorDrawable's own elements and attributes. */
function validate(xml: string): number {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`not well-formed: ${JSON.stringify(valid.err)}`);
  let paths = 0;
  const walk = (tag: string, node: Record<string, unknown>): void => {
    if (!VD_ELEMENTS.has(tag)) throw new Error(`<${tag}> is not a VectorDrawable element`);
    for (const [k, v] of Object.entries(node)) {
      if (VD_ELEMENTS.has(k)) {
        for (const child of Array.isArray(v) ? v : [v]) walk(k, child as Record<string, unknown>);
      } else if (!VD_ATTRS[tag]?.has(k)) throw new Error(`<${tag}> has no attribute ${k}`);
    }
    if (tag === 'path') {
      paths++;
      expect(node['android:pathData']).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .eE+-]+$/);
    }
  };
  const doc = parser.parse(xml) as Record<string, Record<string, unknown>>;
  walk('vector', doc.vector as Record<string, unknown>);
  return paths;
}

describe('VectorDrawable converter', () => {
  it('matches the golden XML for five Tabler icons', () => {
    const xml = iconsFrom('tabler', GOLDEN).map((i) => toVectorDrawable(i));
    for (const x of xml) expect(validate(x)).toBeGreaterThan(0);
    expect(xml[0]).toContain(`android:strokeColor="${CURRENT_COLOR}"`);
    expect(xml[1]).toContain(`android:fillColor="${CURRENT_COLOR}"`);
    // Tabler's invisible 24×24 bounding path paints nothing, so it is not written.
    expect(xml[0]).not.toContain('M0 0h24v24H0z');
    expect(xml).toMatchSnapshot();
  });

  it('every Tabler and flag drawable it writes is valid VectorDrawable, and the skips are counted', () => {
    for (const id of ['tabler', 'flag']) {
      const all = readPack(pack(id), ROOT);
      const result = androidZip(id, all, slugs(all, pack(id).defaultSet));
      expect(result.written + result.skipped.length).toBe(all.length);
      let checked = 0;
      for (const icon of all) {
        let xml: string;
        try {
          xml = toVectorDrawable(icon.data);
        } catch (e) {
          if (e instanceof VdUnsupported) continue;
          throw e;
        }
        validate(xml);
        checked++;
      }
      expect(checked).toBe(result.written);
      if (id === 'tabler') {
        expect(result.skipped).toEqual([]);
        expect(checked).toBeGreaterThan(6000);
      } else {
        expect(checked).toBeGreaterThan(200);
      }
    }
  }, 120_000);

  it('refuses a gradient, a mask, a filter and dashes, naming the icon and the construct', () => {
    const gradient = fixture(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/></svg>',
    );
    expect(() => toVectorDrawable(gradient)).toThrow(VdUnsupported);
    expect(() => toVectorDrawable(gradient)).toThrow('<defs>');
    const paint = fixture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="url(#g)"/></svg>');
    expect(() => toVectorDrawable(paint)).toThrow(/paint server url\(#g\)/);
    expect(() => toVectorDrawable(fixture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h1" mask="url(#m)"/></svg>'))).toThrow('mask');
    expect(() => toVectorDrawable(fixture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g filter="url(#f)"><path d="M0 0h1"/></g></svg>'))).toThrow('filter');
    expect(() => toVectorDrawable(fixture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h1" stroke="#000" stroke-dasharray="2 2"/></svg>'))).toThrow('dash');

    const report = androidZip('fixture', [{ exportName: 'IconF', data: gradient }], ['f']);
    expect(report.written).toBe(0);
    expect(report.skipped).toEqual([{ id: 'fixture:x/f', reason: '<defs>' }]);
  });

  it('writes arc flags with separators, so older Android parsers read them', () => {
    expect(normalisePath('M10 10a1 1 0 011 1l2-3')).toBe('M10 10 a1 1 0 0 1 1 1 l2 -3');
    expect(normalisePath('m1.5.5-.5.5z')).toBe('m1.5 .5 l-.5 .5 z');
    expect(() => normalisePath('M0 0 X1')).toThrow(VdUnsupported);
  });

  it('resolves inherited paint, shapes and transforms exactly', () => {
    const xml = toVectorDrawable(
      fixture(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#abc"><g transform="translate(2 3) rotate(45 12 12)"><circle cx="12" cy="12" r="4"/></g><rect x="1" y="1" width="4" height="4" rx="1" fill="gold" fill-opacity=".5"/><line x1="0" y1="0" x2="24" y2="24" stroke="currentColor"/></svg>',
      ),
    );
    validate(xml);
    expect(xml).toContain('android:translateX="2" android:translateY="3"');
    expect(xml).toContain('android:rotation="45" android:pivotX="12" android:pivotY="12"');
    expect(xml).toContain('android:fillColor="#AABBCC"');
    expect(xml).toContain('android:fillColor="#FFD700" android:fillAlpha="0.5"');
    expect(xml).toContain(`android:strokeColor="${CURRENT_COLOR}"`);
    expect(transformGroups('matrix(2 0 0 3 4 5)')).toEqual([{ 'android:scaleX': '2', 'android:scaleY': '3', 'android:translateX': '4', 'android:translateY': '5' }]);
    // A rotation by 90 degrees with a reflection: perpendicular columns, so one group holds it.
    expect(transformGroups('matrix(0 1 1 0 0 0)')).toEqual([{ 'android:scaleX': '1', 'android:scaleY': '-1', 'android:rotation': '90' }]);
    expect(() => transformGroups('matrix(1 1 0 1 0 0)')).toThrow('(skew)');
    expect(colour('rgb(255, 0, 0)')).toBe('#FF0000');
    // paint-order="stroke": the stroke path is written first, so the fill covers its inner half.
    const order = toVectorDrawable(fixture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="#f00" stroke="#000" stroke-width="4" paint-order="stroke"/></svg>'));
    validate(order);
    expect(order.indexOf('android:strokeColor')).toBeLessThan(order.indexOf('android:fillColor'));
    expect(order.match(/<path /g)).toHaveLength(2);
    expect(colour('#11223344')).toBe('#44112233');
  });
});
