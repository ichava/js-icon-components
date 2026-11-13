import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { elmModule, elmName, elmString, ELM_STRING_PIECE } from '../src/generator/elm.ts';
import { readPack, type NamedIcon } from '../src/generator/generate.ts';
import { CACHE, pack, ROOT, SAMPLE, sampleIcons } from './helpers.ts';

/**
 * The Elm flavour, compiled by the real Elm compiler (`elm make`, from npm's `elm` package, a
 * development dependency) and then run: the compiled JavaScript is evaluated in jsdom and its
 * `main` view is rendered, so the snapshot is Elm's own output, not the generator's idea of it.
 *
 * elm make fetches elm/core, elm/svg and elm/virtual-dom from package.elm-lang.org the first time,
 * into ELM_HOME under .cache/, so a second run is offline.
 */

const work = join(CACHE, 'elm');
const ELM = join(ROOT, 'node_modules/.bin/elm');
const env = { ...process.env, ELM_HOME: join(ROOT, '.cache/elm-home') };

const ELM_JSON = {
  type: 'application',
  'source-directories': ['src', 'generated'],
  'elm-version': '0.19.1',
  dependencies: {
    direct: { 'elm/core': '1.0.5', 'elm/svg': '1.0.1', 'elm/virtual-dom': '1.0.3', 'elm/html': '1.0.0' },
    indirect: { 'elm/json': '1.1.3' },
  },
  'test-dependencies': { direct: {}, indirect: {} },
};

function make(main: string): { status: number | null; output: string } {
  writeFileSync(join(work, 'src/Main.elm'), main);
  const r = spawnSync(ELM, ['make', 'src/Main.elm', '--output=main.js'], { cwd: work, env, encoding: 'utf8', timeout: 300_000 });
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

/** Runs the compiled program in jsdom and returns what its static `main` rendered. */
function run(): string {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: 'outside-only' });
  dom.window.eval(readFileSync(join(work, 'main.js'), 'utf8'));
  (dom.window as unknown as { Elm: { Main: { init(o: { node: Element }): void } } }).Elm.Main.init({ node: dom.window.document.getElementById('root') as Element });
  return dom.window.document.body.innerHTML;
}

const sample = (): NamedIcon[] => sampleIcons().map((data, n) => ({ exportName: SAMPLE[n] as string, data }));

beforeAll(() => {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, 'src'), { recursive: true });
  mkdirSync(join(work, 'generated/Ichava/Icons'), { recursive: true });
  writeFileSync(join(work, 'elm.json'), JSON.stringify(ELM_JSON, null, 4));
  for (const [id, icons] of [['sample', sample()], ['flag', readPack(pack('flag'), ROOT)], ['tabler', readPack(pack('tabler'), ROOT)]] as const) {
    const m = elmModule(id, icons, `// ${id} test module\n`);
    writeFileSync(join(work, 'generated', m.path), m.source);
  }
}, 300_000);

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('Elm flavour', () => {
  it('names functions and escapes strings as Elm needs', () => {
    expect(elmName('IconMugFilled')).toBe('iconMugFilled');
    expect(elmString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    expect(elmString('\u0001')).toBe('"\\u{0001}"');
    const long = 'x'.repeat(ELM_STRING_PIECE * 2 + 1);
    expect(elmString(long).split('++')).toHaveLength(3);
  });

  it('keeps every generated line under the 65,535 columns Elm can parse', () => {
    for (const file of ['Sample', 'Flag', 'Tabler']) {
      const longest = readFileSync(join(work, `generated/Ichava/Icons/${file}.elm`), 'utf8').split('\n').reduce((m, l) => Math.max(m, l.length), 0);
      expect(longest).toBeLessThan(65_535);
    }
  });

  it('compiles with elm make, the whole flag and Tabler modules included, and renders three icons', () => {
    const r = make(
      [
        'module Main exposing (main)',
        '',
        'import Ichava.Icons.Flag as Flag',
        'import Ichava.Icons.Sample as Sample',
        'import Ichava.Icons.Tabler as Tabler',
        'import Svg exposing (Svg)',
        'import Svg.Attributes',
        '',
        '',
        'main : Svg msg',
        'main =',
        '    Svg.g []',
        '        [ Sample.iconMug []',
        '        , Sample.iconMugFilled [ Svg.Attributes.width "32", Svg.Attributes.height "32", Svg.Attributes.color "#7c3aed" ]',
        '        , Sample.iconBrandGithub [ Svg.Attributes.strokeWidth "1.5" ]',
        '        , Tabler.iconMug []',
        '        , Flag.iconKe []',
        '        ]',
        '',
      ].join('\n'),
    );
    expect(r.output).toContain('Success!');
    expect(r.status).toBe(0);
    const html = run();
    const svgs = new JSDOM(html).window.document.querySelectorAll('g > svg');
    expect(svgs).toHaveLength(5);
    expect(svgs[0]?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svgs[0]?.getAttribute('aria-hidden')).toBe('true');
    // The caller's attribute comes after the default, so it wins.
    expect(svgs[1]?.getAttribute('width')).toBe('32');
    expect([...svgs].slice(0, 3).map((s) => s.outerHTML)).toMatchSnapshot();
  }, 300_000);

  it('the compiler refuses a call that does not type-check, so the check can fail', () => {
    const r = make(['module Main exposing (main)', '', 'import Ichava.Icons.Sample as Sample', 'import Svg exposing (Svg)', '', '', 'main : Svg msg', 'main =', '    Sample.iconMug "not a list"', ''].join('\n'));
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('TYPE MISMATCH');
  }, 300_000);
});
