# AMP99 updater signing

AMP99 uses the Tauri updater signature to ensure that an update was produced by
the project owner. The public key belongs in `src-tauri/tauri.conf.json`; the
private key must never be committed to Git or shipped in the application.

## One-time setup

Generate the key pair on a trusted machine and keep an offline backup:

```powershell
npm run tauri signer generate -- -w C:\secure\amp99-updater.key
```

The generated public key can be placed in the `plugins.updater.pubkey` field in
`src-tauri/tauri.conf.json`, replacing `__AMP99_UPDATER_PUBLIC_KEY__`.

Add the private key contents to GitHub repository Actions secrets:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The release workflow reads those secrets only while building signed Windows
artifacts. Do not put them in `.env`, source files, release notes or issues.

## Release flow

Pushing an alpha tag such as `v0.2.0-alpha.3` runs
`.github/workflows/release-alpha.yml`. The workflow builds the installers,
their signatures and `latest.json`, then uploads them to the GitHub Release.
Existing AMP99 installations verify the signature before offering installation.

The signing key is part of the installed app's trust chain. Preserve the
private key and password permanently. If the key is lost, existing clients
cannot be safely migrated to updates signed by a replacement key. If it is
exposed, stop publishing and treat it as a signing-key compromise.

The updater signing key is separate from a Windows Authenticode certificate.
The former authenticates update artifacts; the latter helps Windows identify
the publisher and reduce SmartScreen warnings.
