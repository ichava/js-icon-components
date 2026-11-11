/**
 * Export names. One rule for every flavour, so `IconMug` is the same icon in React, Vue, Svelte
 * and the Web Component data:
 *
 *   Icon + PascalCase(name) + (set === defaultSet ? '' : PascalCase(set))
 *
 * `mug` in `outline` (the default set) is `IconMug`; `mug` in `filled` is `IconMugFilled`, the
 * name Tabler's own packages use. The `Icon` prefix makes every name a valid identifier (a name
 * may start with a digit) and keeps it apart from the flavour's own `Icon` and `createIcon`.
 *
 * A collision is a build failure that names both sources. Nothing is renamed silently, because a
 * silent suffix would make an export name depend on which file sorted first.
 */

const pascal = (s: string): string =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

export const EXPORT_NAME = /^Icon[A-Z0-9][A-Za-z0-9]*$/;

export function exportName(name: string, set: string, defaultSet: string): string {
  const id = `Icon${pascal(name)}${set === defaultSet ? '' : pascal(set)}`;
  if (!EXPORT_NAME.test(id)) throw new Error(`cannot derive an export name from "${set}/${name}" (got "${id}")`);
  return id;
}

/** Assigns names, failing on the first collision. */
export function assignNames<T extends { set: string; name: string }>(items: readonly T[], defaultSet: string): (T & { exportName: string })[] {
  const taken = new Map<string, string>();
  return items.map((item) => {
    const id = exportName(item.name, item.set, defaultSet);
    const source = `${item.set}/${item.name}`;
    const other = taken.get(id);
    if (other !== undefined) throw new Error(`export name ${id} is claimed by both ${other} and ${source}`);
    taken.set(id, source);
    return { ...item, exportName: id };
  });
}
