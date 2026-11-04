# Ember

`@ichava/js-icon-components/ember` is the Ember flavour: one template-only Glimmer component, `Icon`, that takes an icon's data.

## Imports

| Import | Exports |
|---|---|
| `@ichava/js-icon-components/ember` | `Icon` (the component) and `iconMarkup` (the helper it calls) |
| `@ichava/js-icon-components/ember/<pack>` | each icon's data by name, e.g. `IconMug` |

`ember-source` 6.3 or newer is an optional peer: the component is in template-tag format, so it
needs the `template()` runtime from `@ember/template-compiler`, which an Embroider or ember-cli build
with `ember-template-imports` precompiles.

## Usage

```gjs
import { Icon } from '@ichava/js-icon-components/ember';
import { IconMug } from '@ichava/js-icon-components/ember/tabler';

<template>
  <Icon @icon={{IconMug}} @size={{20}} @color="#7c3aed" @title="Coffee" @class="me-2" />
</template>
```

Arguments: `@icon`, `@size`, `@color`, `@strokeWidth`, `@title`, `@class`, and for illustrations
`@primaryColor` and `@variant`.

## How it renders

A Glimmer template cannot name an element from data, and an icon is a tree of elements. So the
component calls one plain-function helper, `iconMarkup`, which writes the SVG from the icon's
parsed, policy-checked tree with every attribute and text escaped, and the template emits it with
`{{{ }}}`. Nothing from a source file reaches the page: the same tree every flavour renders is the
one written here.

## Why one component and not one per icon

As for Angular and Astro: the pack module exports each icon's data, and one component draws any of
them, so there are no 17,365 component modules to compile.

## Template

`src/ember/Icon.gjs` and `src/ember/markup.ts`. The build runs content-tag over the `.gjs` to write
`dist/ember/Icon.js`, and checks the template with the Glimmer precompiler (`@glimmer/compiler`) in
strict mode, with exactly the module's imports in scope.

`tests/ember.test.ts` does the same, proves the precompiler refuses a helper that is not in scope,
snapshots three rendered icons, and parses the markup back to check nothing escapes an attribute.
What it does not do: boot an Ember application. No Ember runtime is installed, so the snapshot is
the helper's output rather than a mounted component.

## Format id

`ember`, listed in icon-browser's format registry since schema 1.6.0 and required by the registry guard.

---

[← Docs index](../../README.md#documentation)
