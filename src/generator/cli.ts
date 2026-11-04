import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, parseSelection, SELECTION_ENV } from './generate.ts';
import { loadPacks } from './packs.ts';

// dist/generator/cli.js → the package root is two levels up.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const started = performance.now();
const selection = parseSelection(
  { packs: process.env[SELECTION_ENV.packs], flavours: process.env[SELECTION_ENV.flavours] },
  loadPacks(join(root, 'packs.json')).map((p) => p.id),
);
const manifest = generate({ root, outDir: join(root, 'dist'), selection });

for (const pack of manifest.packs) {
  const outputs = Object.entries(pack.outputs).map(([f, n]) => `${f} ${n}`).join(', ');
  const excluded = pack.excluded.length > 0 ? ` (${pack.excluded.length} excluded)` : '';
  console.log(`${pack.id}@${pack.ref.slice(0, 12)}: ${pack.inputs} SVGs${excluded} → ${outputs}`);
}
if (manifest.unbuilt.packs.length > 0 || manifest.unbuilt.flavours.length > 0) {
  console.log(`not built (their imports throw): packs [${manifest.unbuilt.packs.join(', ')}], flavours [${manifest.unbuilt.flavours.join(', ')}]`);
}
console.log(`generated in ${((performance.now() - started) / 1000).toFixed(1)}s`);
