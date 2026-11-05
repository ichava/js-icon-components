import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitiseSvg, SvgRejected } from '../src/generator/sanitize.ts';
import type { IconChild } from '../src/shared/index.ts';
import { ROOT } from './helpers.ts';

/**
 * Parity with ichava/icon-sets-sync#85.
 *
 * A dry run of OpenMoji 17 stripped display="none" from 13 subdivision flags, so the hidden
 * construction shapes in them would render, and stripped color and marker-end from a few files.
 * The policy now allows the five names, and each has a value guard: display only as bare
 * keywords, color through the CSS guard, marker-* only as none or url(#fragment).
 *
 * The generator rejects rather than strips, so "kept" here means the SVG is accepted with the
 * attribute in its tree, and "stripped" means it is refused.
 *
 * `tests/fixtures/svg/presentation-vectors.json` is byte-identical in core, react-icon-browser and
 * js-icon-components, and copies its rows from the Go table in icon-sets-sync.
 */

interface Vector {
  name: string;
  value: string;
  keep: boolean;
}

interface DocumentVector {
  label: string;
  svg: string;
  clean: boolean;
  expect: { element: string; attribute?: string; present: boolean }[];
}

/** Whether any node in the tree is the element, or, with an attribute, an element carrying it. */
const hasElementWith = (nodes: readonly IconChild[], element: string, attribute?: string): boolean =>
  nodes.some(
    (n) =>
      typeof n !== 'string' &&
      ((n[0] === element && (attribute === undefined || attribute in n[1])) || hasElementWith(n[2] ?? [], element, attribute)),
  );

const fixture = (name: string): string => readFileSync(join(ROOT, 'tests', 'fixtures', 'svg', name), 'utf8');

const escapeAttr = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;

describe('presentation attributes (icon-sets-sync#85 parity)', () => {
  it('keeps the hidden shapes of an OpenMoji subdivision flag', () => {
    // The Inkscape namespaces and sodipodi:docname are not on the allow-list, so the flag as
    // shipped upstream is refused; without them the presentation attributes all survive.
    const raw = fixture('openmoji-subdivision-flag.svg');
    expect(() => sanitiseSvg(raw)).toThrow(SvgRejected);

    const clean = raw.replace(/\s+xmlns:(?:inkscape|sodipodi)="[^"]*"/g, '').replace(/\s+sodipodi:docname="[^"]*"/, '');
    const out = JSON.stringify(sanitiseSvg(clean).nodes);

    expect(out).toContain('"display":"none"');
    expect(out).toContain('"color":"#000"');
    expect(out).toContain('"marker-end":"url(#arrow)"');
  });

  it('keeps color and a same-document marker-end', () => {
    const out = JSON.stringify(sanitiseSvg(wrap('<path color="red" marker-end="url(#m)" d="M0 0"/>')).nodes);

    expect(out).toContain('"color":"red"');
    expect(out).toContain('"marker-end":"url(#m)"');
  });

  it.each([
    ['display url', wrap('<path display="url(x)" d="M0 0"/>')],
    ['style display url', wrap('<path style="display:url(x)" d="M0 0"/>')],
    ['remote marker-end', wrap('<path marker-end="url(https://e/x)" d="M0 0"/>')],
    ['remote color', wrap('<path color="url(https://e)" d="M0 0"/>')],
    ['color expression', wrap('<path style="color: expression(alert(1))" d="M0 0"/>')],
    ['color attr expression', wrap('<path color="expression(alert(1))" d="M0 0"/>')],
  ])('refuses a hostile value: %s', (_label, svg) => {
    expect(() => sanitiseSvg(svg)).toThrow(SvgRejected);
  });

  it('makes the shared vector decisions', () => {
    const table = JSON.parse(fixture('presentation-vectors.json')) as { cases: Vector[] };

    // The shared table has 35 rows; a table that stopped loading must not pass.
    expect(table.cases).toHaveLength(35);

    for (const { name, value, keep } of table.cases) {
      const svg = wrap(`<path ${name}="${escapeAttr(value)}" d="M0 0"/>`);
      let kept: boolean;
      try {
        sanitiseSvg(svg);
        kept = true;
      } catch (e) {
        if (!(e instanceof SvgRejected)) throw e;
        kept = false;
      }

      expect(kept, `${name}="${value}"`).toBe(keep);
    }
  });

  /*
   * The marker rows. The US and UM flags draw their stars as one <marker> repeated by marker-mid,
   * so a generator that refuses <marker> cannot ship them. A clean document must be accepted with
   * every expect row holding of its tree; one that is not clean must be refused, which is how
   * this generator strips.
   */
  it('makes the shared document decisions', () => {
    const table = JSON.parse(fixture('presentation-vectors.json')) as { documents: DocumentVector[] };

    expect(table.documents).toHaveLength(6);

    for (const doc of table.documents) {
      if (!doc.clean) {
        expect(() => sanitiseSvg(doc.svg), doc.label).toThrow(SvgRejected);
        continue;
      }

      const { nodes } = sanitiseSvg(doc.svg);
      for (const row of doc.expect) {
        expect(hasElementWith(nodes, row.element, row.attribute), `${doc.label}: <${row.element}> ${row.attribute ?? ''}`).toBe(
          row.present,
        );
      }
    }
  });
});
