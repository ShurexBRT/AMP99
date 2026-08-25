# AMP99 Privacy Policy

**Effective date:** August 20, 2026

AMP99 is a free Windows desktop music player. This policy describes how AMP99 handles information when you use the application.

## Summary

AMP99 does not currently operate its own analytics, advertising, tracking, telemetry, or user-account backend. The application primarily stores preferences and authentication state locally on your device and communicates directly with third-party services only when a feature requires it.

## Information AMP99 handles

### Local application data

AMP99 stores certain application preferences on your device, such as classic window positions and related UI state. This data is used only to preserve the desktop-player experience between launches.

### Spotify account and library data

If you choose to connect Spotify, AMP99 may access information permitted by the Spotify permissions you approve, including account/profile information, playlists, saved tracks, playlist contents, and playback-related state.

In the packaged Windows application, AMP99 stores Spotify authentication session data, including access and refresh tokens, in a Windows-user-protected DPAPI file so the session can persist between launches. Browser development mode uses WebView storage as a development fallback. These credentials are used to communicate with Spotify and are not sent to an AMP99-operated server.

AMP99 does not use or distribute a Spotify Client Secret in the desktop application.

### Legacy skin files

When you open a compatible `.wsz` skin, AMP99 reads and processes that file locally on your device. AMP99 does not upload user-supplied skin archives to an AMP99-operated server.

## How information is used

Information handled by AMP99 is used to provide requested application functionality, including:

- remembering local application preferences;
- connecting to Spotify when the user explicitly chooses to do so;
- loading the user's music library and playlists where authorized;
- controlling playback where authorized;
- applying user-supplied legacy skins.

AMP99 does not currently sell personal information or use personal information for targeted advertising.

## Third-party services

AMP99 can communicate with Spotify services when Spotify functionality is enabled. Spotify's own services, privacy practices, account terms, and data handling are governed by Spotify's policies and agreements.

Microsoft may process information independently when AMP99 is acquired or updated through the Microsoft Store; that processing is governed by Microsoft's policies and Store terms.

## Data retention and user controls

Local AMP99 preferences remain on the device until they are cleared, overwritten, or removed with application data.

Using AMP99's Spotify disconnect action clears the Spotify session credentials that AMP99 stores in its local application storage. Users may also remove application data or uninstall AMP99 through Windows.

AMP99 does not currently maintain a separate server-side copy of the user's Spotify credentials, playlist data, or `.wsz` files.

## Security

AMP99 is designed to minimize unnecessary data collection and to keep local-only data on the user's device where practical. No method of storage or transmission is guaranteed to be completely secure, and users should keep Windows and the application up to date and protect access to their Windows account.

Users should never post Spotify tokens, credentials, or other sensitive information in public GitHub issues.

## Children

AMP99 is a general-purpose desktop music player and is not specifically directed to children. Use of third-party connected services remains subject to those services' age requirements and terms.

## Changes to this policy

This policy may be updated when AMP99's functionality or data practices change. Material changes should be reflected in this file and in the version published with the relevant application release.

## Contact

For non-sensitive privacy questions or project inquiries, use the AMP99 GitHub repository:

`https://github.com/ShurexBRT/AMP99`

Do **not** post passwords, OAuth codes, access tokens, refresh tokens, or other private credentials in public issues.

## Independence

AMP99 is an independent project and is not affiliated with, endorsed by, or sponsored by Spotify, Winamp, Nullsoft, or their respective owners.
