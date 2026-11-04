# Security Policy

## Reporting

Do not open a public GitHub issue for a security report. Two channels, in order of preference:

1. **GitHub private vulnerability reporting**, from this repository's Security tab.
2. **Email `security@simtabi.com`**, if you would rather not use GitHub.

Acknowledgement within 48 hours.

## Scope for this package

`@ichava/js-icon-components` turns third-party SVG files into components that render inline in
an application. The surface worth reporting:

- **The SVG gate** (`src/generator/sanitize.ts`): any input that passes it and then carries
  script, an event handler, an off-document reference (`href`, `url()`, `@import`) or markup the
  parser read differently from a browser into a generated component.
- **The renderers** (`src/react`, `src/vue`, `src/svelte`, `src/wc`): any prop or attribute that
  lets a caller's value become markup rather than an attribute value or text.
- **Pack input** (`src/generator/packs.ts`): any way for a build to read something other than the
  pinned commit in `packs.json`.

The policy itself is `ichava/core`'s `resources/security/svg-policy.json`; a weakness in the
policy rather than in this package's use of it belongs to that repository.
