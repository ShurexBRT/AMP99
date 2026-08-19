# AMP99 third-party notices and references

AMP99 is built with and informed by open-source software. This file records notable dependencies and compatibility references so future contributors know what can be reused and under which terms.

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

## Asset policy

AMP99 must not commit or distribute proprietary Winamp/Nullsoft graphics, logos, bundled legacy skins, Spotify branding assets, or user credentials/tokens unless there is a separate explicit license permitting that use.
