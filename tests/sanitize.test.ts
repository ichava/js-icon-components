import { describe, expect, it } from 'vitest';
import { MAX_BYTES, MAX_ELEMENTS, sanitiseSvg, SvgRejected } from '../src/generator/sanitize.ts';

const wrap = (inner: string, rootAttrs = 'viewBox="0 0 24 24"') => `<svg xmlns="http://www.w3.org/2000/svg" ${rootAttrs}>${inner}</svg>`;

// Each of these must be refused. One per vector the policy names, plus the parser's own refusals.
const HOSTILE: Record<string, string> = {
  'script element': wrap('<script>alert(1)</script>'),
  'event handler on root': wrap('<path d="M0 0"/>', 'viewBox="0 0 24 24" onload="alert(1)"'),
  'event handler, mixed case': wrap('<path d="M0 0" OnClick="alert(1)"/>'),
  'javascript: href': wrap('<use href="javascript:alert(1)"/>'),
  'external xlink:href': wrap('<use xlink:href="https://evil.test/sprite.svg#a"/>', 'viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"'),
  'data: href': wrap('<use href="data:image/svg+xml;base64,PHN2Zz4="/>'),
  'foreignObject': wrap('<foreignObject><div>x</div></foreignObject>'),
  'style element': wrap('<style>path{fill:url(https://evil.test/x)}</style>'),
  'off-document url() in style': wrap('<path d="M0 0" style="fill:url(https://evil.test/x)"/>'),
  'escaped url() in style': wrap('<path d="M0 0" style="fill:\\75rl(https://evil.test/x)"/>'),
  'off-document url() in fill': wrap('<path d="M0 0" fill="url(//evil.test/x)"/>'),
  'expression() in style': wrap('<path d="M0 0" style="width:expression(alert(1))"/>'),
  'SMIL animate': wrap('<animate attributeName="href" to="javascript:alert(1)"/>'),
  'image element': wrap('<image href="https://evil.test/x.png"/>'),
  'anchor element': wrap('<a href="https://evil.test"><path d="M0 0"/></a>'),
  'DOCTYPE with entity': `<!DOCTYPE svg [<!ENTITY x "y">]>${wrap('<path d="M0 0"/>')}`,
  'custom entity': wrap('<text>&x;</text>'),
  'CDATA': wrap('<text><![CDATA[x]]></text>'),
  'processing instruction': wrap('<?php echo 1 ?>'),
  'unknown attribute': wrap('<path d="M0 0" data-x="1"/>'),
  'unquoted attribute': wrap('<path d=M0/>'),
  'mismatched tags': wrap('<g><path d="M0 0"></g></path>'),
  'non-svg root': '<html><body></body></html>',
  'two roots': `${wrap('')}${wrap('')}`,
  'text outside a text element': wrap('hello'),
  'too many elements': wrap('<g/>'.repeat(MAX_ELEMENTS)),
  'too many bytes': wrap(`<path d="${'M0 0 '.repeat(Math.ceil(MAX_BYTES / 5))}"/>`),
};

describe('sanitiseSvg', () => {
  it.each(Object.entries(HOSTILE))('rejects %s', (_name, svg) => {
    expect(() => sanitiseSvg(svg)).toThrow(SvgRejected);
  });

  it('checked a meaningful number of hostile samples', () => {
    expect(Object.keys(HOSTILE).length).toBeGreaterThanOrEqual(25);
  });

  it('keeps a real Tabler icon intact, and drops only what each flavour sets itself', () => {
    const out = sanitiseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-tabler"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 5h10"/></svg>',
    );
    expect(out.size).toBe(24);
    expect(out.rootAttrs).toEqual({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' });
    expect(out.nodes).toEqual([['path', { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' }], ['path', { d: 'M4 5h10' }]]);
  });

  it('keeps what the policy keeps: fragment refs, gradients, safe style, text', () => {
    const out = sanitiseSvg(
      wrap('<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff"/></linearGradient></defs><use href="#g"/><path d="M0 0" style="fill:url(#g);opacity:.5"/><text x="1">A &amp; B</text><!-- comment -->'),
    );
    expect(JSON.stringify(out.nodes)).toContain('"A & B"');
    expect(JSON.stringify(out.nodes)).toContain('url(#g)');
    expect(JSON.stringify(out.nodes)).not.toContain('comment');
  });
});
