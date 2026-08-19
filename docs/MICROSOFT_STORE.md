# AMP99 Microsoft Store Release Guide

This document is the source of truth for the **non-Spotify** Windows Store release path.

## Chosen distribution model

AMP99 targets **MSIX distribution through Microsoft Store** for the public Windows release.

Why this is the preferred route:

- the Store can sign/re-sign an accepted MSIX package as part of certification/distribution;
- Store-managed installation and updates are cleaner than publishing the development MSI/NSIS installers directly;
- `.wsz` file association can live in the packaged application manifest;
- the existing MSI and NSIS installers remain valuable for development and runtime smoke testing.

The repository still produces MSI and NSIS development bundles. Those are **not** the intended final Store package.

## What is automated in the repository

The repository contains:

- `store/AppxManifest.template.xml` — reviewable MSIX manifest template;
- `scripts/build-store-msix.ps1` — parameterized MSIX pack/unpack verification;
- `.github/workflows/store-msix-preflight.yml` — unsigned structural Store-package CI;
- scalable native icon source under `src-tauri/app-icon.svg`;
- Tauri-generated Store icon assets;
- `.wsz` file association in both Tauri installer configuration and the MSIX template.

CI uses **development identity values only**. A CI-generated MSIX proves package structure; it is not a package to submit under a real Store identity.

## External Partner Center steps

The repository cannot invent or replace these account-level values.

1. Sign in to Microsoft Partner Center with the publisher account.
2. Reserve the product name **AMP99**.
3. Open the product identity details.
4. Record the exact Store values for:
   - Package/Identity/Name;
   - Publisher;
   - Publisher display name.
5. Build the final MSIX using those exact identity values.
6. Run the current Windows App Certification Kit / Store preflight applicable to the submission.
7. Prepare Store listing text, screenshots, privacy URL, age/category data and support information.
8. Upload the final package in Partner Center.
9. Keep the product price **Free** unless the product strategy is explicitly changed later.

Do not ship a package with the development identity `AMP99.Dev`.

## Final package command

From a Windows development machine with Rust, Node.js and the Windows SDK installed:

```powershell
npm install
npm run tauri:icon
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml

./scripts/build-store-msix.ps1 `
  -IdentityName "<PARTNER_CENTER_IDENTITY_NAME>" `
  -Publisher "<PARTNER_CENTER_PUBLISHER>" `
  -PublisherDisplayName "<PUBLISHER_DISPLAY_NAME>" `
  -Version "0.1.0.0"
```

The script:

1. validates the requested identity/version and required build inputs;
2. stages `amp99.exe`, the manifest and Store icon assets;
3. packs with Windows SDK `MakeAppx.exe`;
4. unpacks the generated package into a clean verification directory;
5. verifies the package identity;
6. verifies the `.wsz` file association is still present;
7. writes the package under `src-tauri/target/release/bundle/msix/`.

The script does **not** create or fake a production signing identity.

## Store listing draft

### Product name

**AMP99**

### Tagline

**Play it like it's 1999.**

### Category

**Music**

### Price

**Free**

### Short description

> A classic late-90s desktop music player for Windows with Winamp-compatible `.wsz` skin support.

### Description foundation

> AMP99 brings the compact three-window desktop music-player experience back to Windows. Move and snap the Main Player, Equalizer and Playlist Editor, switch between 1x and 2x views, use shade mode, load your own compatible `.wsz` skins, control playback from media keys, and keep the player close with tray and Always on Top controls.
>
> AMP99 uses an original visual identity and does not bundle proprietary Winamp skins or artwork.

**Spotify-specific Store copy is intentionally not finalized in this document.** Public-release claims about connected Spotify playback must be written only after the real packaged-app Spotify flow has passed its separate release gates and any required platform approval is confirmed.

## Privacy URL

After `PRIVACY.md` is merged to the public `main` branch, the repository-hosted policy can be linked from the Store listing:

`https://github.com/ShurexBRT/AMP99/blob/main/PRIVACY.md`

If a dedicated AMP99 website is added later, use a stable public privacy-policy URL there and keep the repository policy synchronized.

## Store artwork still required

Native application icons are automated. Store-listing marketing artwork is separate and should be produced from an approved release build/design system.

Before submission capture or prepare:

- real application screenshots from the release build;
- Store hero/listing artwork where Partner Center requests it;
- screenshots demonstrating the default AMP99 skin and legacy `.wsz` support without distributing unlicensed third-party artwork;
- a clean screenshot set at supported Windows DPI/scaling levels.

Do not fabricate product screenshots that imply untested features.

## MSI / EXE fallback

Microsoft Store also supports distribution of an existing installer in some Win32 submission flows. AMP99 keeps MSI and NSIS artifacts for development/testing, but that route has different signing/update obligations and is not the preferred release plan.

If the Store strategy changes from MSIX to an existing MSI/EXE submission, create a dedicated release task and re-check the current Microsoft signing/certification requirements before shipping.

## Release blockers outside this document

This Store-preflight work deliberately does not resolve:

- Spotify production/public-release approval or quota status;
- installed-app Spotify OAuth validation;
- real Spotify audio/EME behavior in packaged WebView2;
- Partner Center identity and submission credentials;
- final Store certification result.

Those must stay visible as release gates instead of being silently treated as complete.
