# Release

Tagging a release, and moving a pack to a new commit.

## Distribution is GitHub only

There is no npm release. Consumers install the tarball attached to a GitHub release, or pin
`github:ichava/js-icon-components#vX.Y.Z` and build, the way react-icon-browser pins js-ui-kernel.
Publishing to a registry is a separate decision for the owner.

## Cutting a release

1. Every pull request that changes behaviour adds to the one `## [Unreleased]` section of
   `CHANGELOG.md`.
2. Close `[Unreleased]` as `## [X.Y.Z] - date`, bump `version` in `package.json` and the tag in
   the install lines of `README.md` and `docs/installation.md`, in one pull request.
3. After it merges, tag the merge commit `vX.Y.Z` and push the tag. `release.yml` creates the
   GitHub release with that CHANGELOG section as its body, and refuses a tag that has none, or a
   tag that does not match `version` in `package.json`.

## The release tarballs

The same run installs and builds the package once and attaches:

| Asset | Holds |
|---|---|
| `ichava-js-icon-components-X.Y.Z.tgz` | every pack, flavour and asset export, as `@ichava/js-icon-components` |
| `ichava-js-icon-components-<pack>-X.Y.Z.tgz` | one pack, every flavour and export, as `@ichava/js-icon-components-<pack>`, one per entry in `packs.json` |
| `SHA256SUMS` | the checksum of each tarball |
| `js-icon-components.cdx.json` | the SBOM |

Each tarball is `npm pack` output, written by `scripts/pack-tarball.mjs` (which gives a per-pack
tarball its own package name while it packs, then restores `package.json`) and checked by
`scripts/check-tarball.mjs` before upload: `dist/` for everything its manifest says was built, a
stand-in for the rest, the Elm module and every export of each built pack, the package name its
contents call for, nothing from the development tree, and no dependencies. Then
`scripts/check-release-name.mjs` checks the full tarball is named exactly as `tarballUrl()` in
`scripts/prepare.mjs` builds its download URL, and that `SHA256SUMS` lists it; a mismatch fails the
run before anything is published, so the install command `prepare` prints cannot drift from the asset. To rebuild them for a tag, which creates or updates that tag's release
only:

```bash
gh workflow run release.yml --repo ichava/js-icon-components -f tag=v0.1.0
```

A pre-release tag (`vX.Y.Z-rc.N`) packs with its own version, so its tarballs are
`ichava-js-icon-components-X.Y.Z-rc.N.tgz`; `package.json` keeps `X.Y.Z`.

## Moving a pack forward

Set the pack's `ref` in `packs.json` to the new full commit SHA, adjust `minIcons` if the
count moved, and update the measured count in `tests/generate.test.ts`. An `exclude` entry the new
commit fixes upstream fails the build until it is removed. CI generates from the new commit; an icon the policy rejects, a name collision or a
count below the floor fails the build. A new pack ref is a release-worthy change, because every
consumer's next install generates from it.

## Tags are final

A pushed `vX.Y.Z` tag is never moved, deleted or reused. A test build uses a pre-release tag,
`vX.Y.Z-rc.N`, which `release.yml` publishes as a GitHub pre-release.

---

[← Docs index](../README.md#documentation)
