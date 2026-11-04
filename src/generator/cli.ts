import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generate.ts';

// dist/generator/cli.js → the package root is two levels up.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const started = performance.now();
const manifest = generate({ root, outDir: join(root, 'dist') });

for (const pack of manifest.packs) {
  const outputs = Object.entries(pack.outputs).map(([f, n]) => `${f} ${n}`).join(', ');
  const excluded = pack.excluded.length > 0 ? ` (${pack.excluded.length} excluded)` : '';
  console.log(`${pack.id}@${pack.ref.slice(0, 12)}: ${pack.inputs} SVGs${excluded} → ${outputs}`);
}
console.log(`generated in ${((performance.now() - started) / 1000).toFixed(1)}s`);
