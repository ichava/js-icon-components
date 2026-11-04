# Contributing

## Before you start

```bash
npm install          # also runs `prepare`: tsc, then the generator
npm run typecheck
npm run lint
npm test
npm run build
```

All five must be clean before a pull request is opened. CI runs the same commands, on Linux,
without the sibling pack checkouts, so it also proves the shallow fetch of each pinned pack.

## What belongs here

- **One template per flavour**: `src/react/index.tsx`, `src/vue/Icon.vue`,
  `src/svelte/Icon.svelte`, `src/wc/index.ts`. A change to how icons render is a change to one of
  these four files, never to generated output.
- **No runtime dependencies.** The frameworks are optional peers; everything else is a
  development dependency used by the build.
- **No generated output in git.** `dist/` is built on install by `prepare`.

## Adding a pack, or moving one forward

Edit `packs.json`: a new entry, or a new full commit SHA in `ref`. Set `minIcons` a little under
the measured count. A pack that adds a fifth flavour, or drops one, also needs the format registry
in icon-browser's schema, because `tests/registry.test.ts` holds both directions.

## Changing a file under `config/` or `vendor/`

`config/` holds byte-identical copies of `ichava/js-ui-kernel`'s config and `npm run
check:config-drift` fails on drift. `vendor/` holds copies of core's SVG policy and icon-browser's
schema, pinned by digest in `tests/vendored.test.ts`. Change the canonical file first, then copy
it here and update the digest in the same pull request.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `ci:`, `test:`). Subject 72
  characters or fewer, imperative mood. The body explains why.
- No AI attribution anywhere: commits, pull request titles and bodies, code comments or docs.
- No lock files. This is a library; `package-lock.json` is gitignored and a test fails on one.
- A new guard is proven red once before it lands.
