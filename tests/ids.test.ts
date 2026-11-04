import { describe, expect, it } from 'vitest';
import { collectIds, collectRefs, idPrefix, prefixIds } from '../src/generator/ids.ts';
import { sanitiseSvg } from '../src/generator/sanitize.ts';
import type { IconChild } from '../src/shared/index.ts';

const svg = (body: string, root = ''): ReturnType<typeof sanitiseSvg> =>
  sanitiseSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"${root}>${body}</svg>`);

const HOSTILE_TO_IDS = [
  '<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient>',
  '<clipPath id="c"><rect width="4" height="4"/></clipPath><path id="p" d="M0 0h4"/></defs>',
  '<path fill="url(#g)" d="M0 0h1"/>',
  `<path fill="url('#g')" stroke='url("#g")' d="M0 0h1"/>`,
  '<g clip-path="url( #c )" style="fill: url(#g); stroke:#fff"><use href="#p"/><use xlink:href="#p"/></g>',
  '<g aria-labelledby="p c" aria-describedby="g"><path fill="#fff" d="M0 0h1"/></g>',
].join('');

describe('per-icon id prefixing', () => {
  it('derives the prefix from pack, set and name only', () => {
    expect(idPrefix('openmoji', 'openmoji-color', 'grinning-face')).toBe('openmoji_openmoji-color_grinning-face_');
    expect(idPrefix('flag', '4x3', 'ke')).toBe('flag_4x3_ke_');
    // Characters outside [A-Za-z0-9-] become "-", so "_" stays a separator nothing else can contain.
    expect(idPrefix('emoji', 'twemoji', 'a_b.c')).toBe('emoji_twemoji_a-b-c_');
  });

  it('rewrites every id and every reference to it', () => {
    const icon = svg(HOSTILE_TO_IDS, ' id="emoji"');
    const out = prefixIds(icon, 'pk_set_name_');
    const text = JSON.stringify(out);

    expect(out.rootAttrs.id).toBe('pk_set_name_emoji');
    expect([...collectIds(out.nodes)].sort()).toEqual(['pk_set_name_c', 'pk_set_name_g', 'pk_set_name_p']);
    expect(text).toContain('url(#pk_set_name_g)');
    expect(text).toContain(`url('#pk_set_name_g')`);
    expect(text).toContain('url(\\"#pk_set_name_g\\")');
    expect(text).toContain('url( #pk_set_name_c )');
    expect(text).toContain('fill: url(#pk_set_name_g); stroke:#fff');
    expect(text).toContain('"href":"#pk_set_name_p"');
    expect(text).toContain('"xlink:href":"#pk_set_name_p"');
    expect(text).toContain('"aria-labelledby":"pk_set_name_p pk_set_name_c"');
    expect(text).toContain('"aria-describedby":"pk_set_name_g"');
    // Colours are not references, even though they start with "#".
    expect(text).toContain('"fill":"#fff"');
    expect(text).not.toMatch(/#[cgp]\b|"id":"[cgp]"|"aria-[a-z]+":"[^"]*\b[cgp]\b/);
  });

  it('leaves every reference resolving inside its own icon', () => {
    const out = prefixIds(svg(HOSTILE_TO_IDS), 'x_');
    const ids = collectIds(out.nodes);
    const refs = collectRefs(out);
    expect(refs.length).toBe(10);
    for (const ref of refs) expect(ids.has(ref), ref).toBe(true);
  });

  it('is deterministic', () => {
    const a = prefixIds(svg(HOSTILE_TO_IDS), idPrefix('p', 's', 'n'));
    const b = prefixIds(svg(HOSTILE_TO_IDS), idPrefix('p', 's', 'n'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('gives two icons with the same source ids disjoint ids, within and across packs', () => {
    const icons = [
      prefixIds(svg(HOSTILE_TO_IDS), idPrefix('openmoji', 'openmoji-color', 'rainbow')),
      prefixIds(svg(HOSTILE_TO_IDS), idPrefix('openmoji', 'openmoji-color', 'grinning-face')),
      prefixIds(svg(HOSTILE_TO_IDS), idPrefix('flag', '4x3', 'ke')),
    ];
    const all = icons.flatMap((i) => [...collectIds(i.nodes)]);
    expect(all).toHaveLength(9);
    expect(new Set(all).size).toBe(9);
  });

  it('leaves an icon with no ids untouched', () => {
    const icon = svg('<path fill="#fff" d="M0 0h1"/>');
    expect(prefixIds(icon, 'x_')).toEqual(icon);
  });

  it('does not mutate its input', () => {
    const icon = svg(HOSTILE_TO_IDS);
    const before = JSON.stringify(icon);
    prefixIds(icon, 'x_');
    expect(JSON.stringify(icon)).toBe(before);
  });

  it('counts the references it can see, so a test over it is not vacuous', () => {
    const nodes: IconChild[] = [['use', { href: '#a' }], ['path', { fill: 'url(#b)' }]];
    expect(collectRefs({ rootAttrs: {}, nodes })).toEqual(['a', 'b']);
  });
});
