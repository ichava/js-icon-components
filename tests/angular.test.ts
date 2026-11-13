import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import '@angular/compiler';
import { Component, provideZonelessChangeDetection, type Type } from '@angular/core';
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import type { IconData } from '../src/shared/index.ts';
import { CACHE, iconsFrom, ROOT, sampleIcons } from './helpers.ts';

/**
 * The Angular template compiled by Angular's own compiler (ngc, partial mode, as the build does),
 * then linked at runtime by @angular/compiler and rendered by @angular/platform-server.
 */
const OUT = join(CACHE, 'angular');
let IchavaIcon: Type<unknown>;

beforeAll(async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  execFileSync(join(ROOT, 'node_modules/.bin/ngc'), ['-p', join(ROOT, 'tsconfig.angular.json'), '--outDir', OUT], { cwd: ROOT, stdio: 'pipe' });
  ({ IchavaIcon } = (await import(pathToFileURL(join(OUT, 'angular/index.js')).href)) as { IchavaIcon: Type<unknown> });
}, 120_000);

async function render(template: string, icons: Record<string, IconData>): Promise<string> {
  class Host {
    constructor() {
      Object.assign(this, icons);
    }
  }
  Component({ selector: 'app-root', imports: [IchavaIcon], template })(Host);
  const bootstrap = (context: BootstrapContext) => bootstrapApplication(Host, { providers: [provideZonelessChangeDetection()] }, context);
  const html = await renderApplication(bootstrap, { document: '<!doctype html><html><body><app-root></app-root></body></html>', url: '/' });
  const body = /<app-root[^>]*>([\s\S]*)<\/app-root>/.exec(html)?.[1];
  if (body === undefined) throw new Error(`no <app-root> in ${html}`);
  return body.replace(/ ng-version="[^"]*"| _nghost-[\w-]+=""| _ngcontent-[\w-]+=""/g, '');
}

describe('Angular flavour', () => {
  it('compiles the template with ngc in partial mode', () => {
    const js = readFileSync(join(OUT, 'angular/icon.component.js'), 'utf8');
    expect(js).toContain('ɵɵngDeclareComponent');
    expect(js).toContain('selector: "ichava-ng-icon"');
    expect(readFileSync(join(OUT, 'angular/icon.component.d.ts'), 'utf8')).toContain('ɵɵComponentDeclaration<IchavaIcon, "ichava-ng-icon"');
  });

  it('renders three icons', async () => {
    const [mug, mugFilled, github] = sampleIcons();
    const html = [
      await render('<ichava-ng-icon [icon]="mug" />', { mug: mug! }),
      await render('<ichava-ng-icon [icon]="mug" [size]="32" color="#7c3aed" label="Coffee" />', { mug: mugFilled! }),
      await render('<ichava-ng-icon [icon]="mug" [strokeWidth]="1.5" />', { mug: github! }),
    ];
    expect(html).toMatchSnapshot();
  });

  it('is decorative without a label and named with one', async () => {
    const [mug] = sampleIcons();
    expect(await render('<ichava-ng-icon [icon]="mug" />', { mug: mug! })).toContain('aria-hidden="true"');
    const named = await render('<ichava-ng-icon [icon]="mug" label="Coffee" />', { mug: mug! });
    expect(named).not.toContain('aria-hidden');
    expect(named).toContain('role="img"');
    expect(named).toContain('<title>Coffee</title>');
    expect(named).not.toMatch(/<ichava-ng-icon[^>]* title=/);
  });

  it('applies strokeWidth only to stroked icons', async () => {
    const [, mugFilled] = sampleIcons();
    expect(await render('<ichava-ng-icon [icon]="mug" [strokeWidth]="3" />', { mug: mugFilled! })).not.toContain('stroke-width="3"');
  });

  it('renders a flag with its prefixed references', async () => {
    const [ke] = iconsFrom('flag', ['IconKe']);
    const html = await render('<ichava-ng-icon [icon]="ke" />', { ke: ke! });
    expect(html).toContain('id="flag_4x3_ke_ke-a"');
    expect(html).toMatch(/href="#flag_4x3_ke_ke-a"/);
  });
});
