# Release process

This package is published to npm from GitHub Actions when a version tag or GitHub Release is created.

## Prerequisites

1. Add an npm automation token as the `NPM_TOKEN` repository secret.
2. Ensure the package name in `package.json` is available for the target npm account or organization.
3. Keep `package-lock.json` committed so CI and release jobs install reproducible dependencies.

## Publishing a stable release

1. Update the package version without creating a tag yet:

   ```sh
   npm version patch --no-git-tag-version
   ```

   Use `minor` or `major` instead of `patch` when appropriate.

2. Run verification locally:

   ```sh
   npm run verify
   npm audit --omit=dev --audit-level=high
   ```

3. Commit the version bump:

   ```sh
   git add package.json package-lock.json
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```

4. Create and push a version tag that exactly matches the package version:

   ```sh
   git tag "v$(node -p "require('./package.json').version")"
   git push origin HEAD --tags
   ```

The release workflow verifies that `GITHUB_REF_NAME` matches `v${package.json.version}` before publishing to npm with the `latest` dist-tag and npm provenance.

## Dry-running a publish

Use the manual `Release` workflow and leave `dry_run` set to `true`. The workflow runs `npm publish --dry-run` after installing dependencies and running the full verification suite.

## Publishing a prerelease dist-tag

For prereleases, set a prerelease version such as `1.1.0-beta.0`, tag it as `v1.1.0-beta.0`, and run the manual workflow with `dry_run` set to `false` and `npm_tag` set to a non-`latest` dist-tag such as `beta`.
