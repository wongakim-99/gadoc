# GaDoc Desktop Release

## Current Policy

The user approved an unsigned GaDoc 1.1.0 release on 2026-10-27. Do not describe
this version as signed/notarized or as a macOS automatic-update baseline.
The production domain remains https://slacord.cloud. The GitHub repository is
https://github.com/kscold/gadoc.

New installers use GaDoc for the product name, filename and fresh-install
directory. Existing application ID and Windows upgrade identity remain stable;
an existing Slacord profile is reused to avoid discarding local preferences and
sessions. Fresh installs use the GaDoc profile directory.

## Gates

1. Run `pnpm verify:full`, dependency audit and required pull-request CI.
2. Merge the reviewed feature branch through dev into main; verify deployed SHA.
3. Synchronize manifests with `pnpm version:all <version>`, and confirm the
   download site's release version and changelog agree.
4. Tag the verified main commit. Push only that tag, never an unreviewed main.
5. Wait for both macOS arm64 DMG/ZIP and Windows x64 NSIS jobs.
6. The publish job validates every required installer and update metadata,
   generates SHA256SUMS.txt and release notes, then publishes the draft.
7. Check asset availability, release notes, checksums and /download links.
   A web deployment alone does not replace the installed Electron binary.

Already-public releases are not overwritten. A failed partial release stays
unpublished and can be retried while it is a draft.

## Signing

`node scripts/check-desktop-release-secrets.mjs` requires complete credentials.
The release workflow explicitly uses `--allow-unsigned`: an entirely absent
credential group is allowed with a published warning; a partially configured
group always fails.

macOS requires CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID,
APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID. Windows requires WIN_CSC_LINK and
WIN_CSC_KEY_PASSWORD. Secrets are environment variables, not shell interpolation
or repository files.

Unsigned Windows installers may show SmartScreen warnings; unsigned/unnotarized
macOS installers may be blocked by Gatekeeper. Verify files against the published
SHA256 list and use the web app if installation is blocked. Do not recommend
disabling system-wide security protections. macOS updates remain manual DMG
installation until a separately verified signed/notarized release is ready.
