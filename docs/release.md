# Release

Tagging a release, and moving a pack to a new commit.

## Distribution is git only

There is no npm release. Consumers pin `github:ichava/js-icon-components#vX.Y.Z`, the way
react-icon-browser pins js-ui-kernel. Publishing to a registry is a separate decision for the
owner.

## Cutting a release

1. Every pull request that changes behaviour adds to the one `## [Unreleased]` section of
   `CHANGELOG.md`.
2. Close `[Unreleased]` as `## [X.Y.Z] - date`, bump `version` in `package.json` and the tag in
   the install lines of `README.md` and `docs/installation.md`, in one pull request.
3. After it merges, tag the merge commit `vX.Y.Z` and push the tag. `release.yml` creates the
   GitHub release with that CHANGELOG section as its body, and refuses a tag that has none.

## Moving a pack forward

Set the pack's `ref` in `packs.json` to the new full commit SHA, and adjust `minIcons` if the
count moved. CI generates from the new commit; an icon the policy rejects, a name collision or a
count below the floor fails the build. A new pack ref is a release-worthy change, because every
consumer's next install generates from it.

## Tags are final

A pushed `vX.Y.Z` tag is never moved, deleted or reused. A test build uses a pre-release tag,
`vX.Y.Z-rc.N`, which `release.yml` publishes as a GitHub pre-release.

---

[← Docs index](../README.md#documentation)
