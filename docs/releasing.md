# Releasing

A release is a version tag. Pushing a tag `v*` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml),
which builds the installers on macOS, Windows and Linux and attaches them to a **draft** GitHub release.
Nothing is published until you review the draft and press Publish.

## What a release contains

| Runner           | Artifacts                                              |
| ---------------- | ------------------------------------------------------ |
| `macos-latest`   | `.dmg` and `.app`, universal (Apple Silicon and Intel) |
| `windows-latest` | `.msi` (WiX) and `.exe` (NSIS, per-user install)       |
| `ubuntu-22.04`   | `.deb`, `.rpm` and `.AppImage`                         |

The builds are unsigned unless the signing secrets below are set. The release notes point to the
[CHANGELOG](../CHANGELOG.md) and to the [Installing section](../README.md#installing) of the README, which explains
Gatekeeper, SmartScreen and `chmod +x` for the AppImage.

## Cutting a release

1. Make sure `main` is green and the `## [Unreleased]` section of [CHANGELOG.md](../CHANGELOG.md) lists what ships.
2. Pick the next version `x.y.z` (semantic versioning) and set it everywhere:

   ```sh
   node scripts/bump-version.mjs 0.1.0
   ```

   This updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, and
   turns the `## [Unreleased]` heading into `## [0.1.0] - <today>` with a new, empty `## [Unreleased]` above it.
   Review the diff, then commit it (`chore: release 0.1.0`) and merge it to `main`.

3. Tag the merged commit with the same version, prefixed with `v`, and push the tag:

   ```sh
   git switch main && git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Wait for the **Release** workflow to finish. The workflow refuses to run when the tag does not match the
   `version` in `package.json`.
5. Open the draft under **Releases**, check the assets, test at least one installer per system, then publish it.

To rebuild an existing tag (for example after a failed runner), start the **Release** workflow by hand from the
Actions tab with `tag` set to that tag. The assets are added to the tag's draft release.

## Optional code signing

The workflow runs without any signing secret. When a secret below exists, the matching step uses it; when it does
not, the build stays unsigned. Add the secrets in **Settings > Secrets and variables > Actions**.

### macOS: signing and notarisation

Requires an Apple Developer Program membership.

| Secret                       | Value                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64 of the "Developer ID Application" certificate exported as `.p12`: `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | The password used when exporting the `.p12`                                                             |
| `APPLE_SIGNING_IDENTITY`     | The identity name, e.g. `Developer ID Application: Juan Gestal (TEAMID)`                                |
| `APPLE_ID`                   | The Apple ID e-mail used for notarisation                                                               |
| `APPLE_PASSWORD`             | An app-specific password created at appleid.apple.com                                                   |
| `APPLE_TEAM_ID`              | The 10-character team identifier                                                                        |

Tauri reads these variables during `tauri build`: it signs the app, notarises it and staples the ticket.
The variables are exported only when they are set, so an empty secret never reaches the build.

### Windows: Authenticode

Requires a code-signing certificate (`.pfx`).

| Secret                         | Value                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `WINDOWS_CERTIFICATE`          | Base64 of the `.pfx` file: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))` in PowerShell |
| `WINDOWS_CERTIFICATE_PASSWORD` | The password of the `.pfx`                                                                                |

The workflow imports the certificate into the runner's user store and passes its thumbprint to Tauri through
`TAURI_CONFIG`, using SHA-256 and the DigiCert timestamp server. To use another timestamp server, change
`timestampUrl` in the **Import optional Windows signing certificate** step.

### Checking a signed build

- macOS: `codesign -dv --verbose=4 DotMD\ Viewer.app` and `spctl -a -vv DotMD\ Viewer.app`.
- Windows: right-click the `.exe`, **Properties > Digital Signatures**.

Once the builds are signed, the Gatekeeper and SmartScreen steps of the README's Installing section can be removed.

## Troubleshooting

- **"Tag vX does not match package.json version"**: the version was not bumped, or the tag points at the wrong commit.
  Delete the tag (`git push --delete origin vX` and `git tag -d vX`), fix the version, and tag again.
- **A runner failed but the others succeeded**: re-run the failed job, or start the workflow by hand with the same tag.
  `tauri-action` adds the assets to the existing draft.
- The local build of the same commands is the **Bundles** workflow (`.github/workflows/bundles.yml`).
