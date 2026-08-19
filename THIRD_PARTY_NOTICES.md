# AMP99 third-party notices and references

AMP99 is built with and informed by open-source software. This file records notable dependencies and compatibility references so future contributors know what can be reused and under which terms.

## Tauri

- Project: Tauri
- Repository: https://github.com/tauri-apps/tauri
- License: Apache-2.0 / MIT
- AMP99 use: desktop application runtime, Windows WebView shell, system tray, window controls, native bundling and platform APIs.

## Tauri plugins

AMP99 currently uses official plugins from the Tauri plugins workspace:

- `tauri-plugin-single-instance` — keeps one AMP99 instance alive and hands associated `.wsz` launches to it;
- `tauri-plugin-global-shortcut` — best-effort hardware media-key integration.

- Repository: https://github.com/tauri-apps/plugins-workspace
- License: Apache-2.0 / MIT

## Webamp

- Project: Webamp by Jordan Eldredge / contributors
- Repository: https://github.com/captbaritone/webamp
- License: MIT
- AMP99 use: compatibility reference for classic Winamp skin archive behavior and sprite-sheet geometry.
- AMP99 does **not** bundle Webamp's demo skins, Winamp assets, or third-party `.wsz` files.

Where AMP99 carries classic sprite coordinates that were cross-checked against Webamp, those values are compatibility data used by AMP99's independently implemented renderer foundation.

## JSZip

- Project: JSZip
- Repository: https://github.com/Stuk/jszip
- License: MIT
- AMP99 use: runtime dependency for reading user-supplied `.wsz` / ZIP skin archives.

## Spotify Web API examples

- Project: Spotify Web API examples
- Repository: https://github.com/spotify/web-api-examples
- License: Apache-2.0
- AMP99 use: reference for official OAuth Authorization Code with PKCE patterns. AMP99's Spotify service layer is independently implemented with browser Web Crypto and `fetch`.

## Microsoft Windows SDK tooling

AMP99's Store preflight script invokes `MakeAppx.exe` from an installed Microsoft Windows SDK to structurally build and unpack-verify MSIX packages. Windows SDK tooling is not vendored in this repository and is governed by Microsoft's applicable SDK license terms.

## Asset policy

AMP99 must not commit or distribute proprietary Winamp/Nullsoft graphics, logos, bundled legacy skins, Spotify branding assets, or user credentials/tokens unless there is a separate explicit license permitting that use.
