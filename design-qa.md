# AMP99 Stitch design QA

## Source visual truth

- Source: [Stitch AMP99 project](https://stitch.withgoogle.com/projects/6265590426505086201?pli=1)
- Source capture: `design-qa-source.png`
- Source capture pixels: 1316 × 910
- Source CSS viewport: 1316 × 910
- Source density: devicePixelRatio 1; no density normalization
- Reviewed source frames: `AMP99 - Main Player (1X)`, `AMP99 - Equalizer (1X)`, `AMP99 - Playlist Editor (1X)`, `AMP99 - Preferences (General)`, `AMP99 - Preferences (Spotify)`, `AMP99 - Preferences (Appearance)`, and supplemental `MAIN_2X`, `PLAYLIST_EXPANDED`, `SHADE_1X`, `TRAY_MENU`, and state frames.

## Implementation evidence

- Implementation URL: `http://localhost:5173/`
- Main player capture: `design-qa-implementation-main.png`
- Preferences capture: `design-qa-implementation.png`
- Implementation capture pixels: 1316 × 910 each
- Implementation CSS viewport: 1316 × 910
- Implementation density: devicePixelRatio 1; no density normalization
- Main state: browser fallback, default AMP99 skin, 2× display toggle visible, Main/EQ/Playlist rendered as separate player surfaces.
- Preferences state: Preferences opened from `LIST OPTS`, General selected, default preferences, update quick action visible.
- Additional interaction: queue filter filled with `debug`; one matching playlist row remained visible.

## Comparison evidence

Full-view comparison was performed by opening the Stitch board capture and the rendered AMP99 captures together. The source board contains multiple frames at Stitch canvas zoom, so exact one-to-one pixel comparison is limited; the review focused on the visible component regions and the shared visual language.

Focused regions reviewed:

- Main/EQ/Playlist chrome: graphite chassis, compact titlebars, amber active state, cyan technical labels, dense controls, recessed display/list surfaces.
- Preferences: 158px navigation rail, graphite utility surface, amber selected section, cyan kicker labels, bordered content card, bottom action bar.
- Playlist interaction: filter field, selected row, status line and dense toolbar.

## Findings

- No actionable P0, P1, or P2 visual findings remain for this pass.
- The Stitch mock combines player surfaces into presentation frames; AMP99 intentionally keeps Main, Equalizer and Playlist as separate native-window-owned surfaces per product architecture. This is an accepted product constraint, not a visual regression.
- Stitch shows richer custom iconography in some frames. AMP99 retains its existing sprite/glyph control model so `.wsz` skin rendering and compact desktop accessibility labels remain functional; this is follow-up polish, not a blocker for the current pass.

## Fidelity surfaces

- Fonts and typography: compact Tahoma/Courier UI hierarchy is preserved; display and queue text use monospace treatment, while Preferences uses readable utility text with small technical labels.
- Spacing and layout rhythm: titlebars, recessed panels, 1px borders, dense row heights and Preferences rail/content proportions align with the selected direction; native window dimensions remain authoritative.
- Colors and visual tokens: graphite chassis/panel/recessed surfaces map to `#171A1E`, `#24292E`, and `#080B0E`; amber primary and cyan technical accents are applied consistently.
- Image quality and asset fidelity: no new placeholder product imagery or third-party logos were introduced; existing `.wsz` sprite assets remain the authoritative legacy path.
- Copy and content: AMP99 naming, “Play it like it’s 1999”, Spotify wording, update wording and honest alpha limitations remain intact.

## Comparison history

1. Initial visual pass: introduced the Stitch-derived token palette and compact player/EQ/Playlist styling.
2. Follow-up fix: added a functional Playlist queue filter and hid it for legacy `.wsz` Playlist rendering so legacy geometry stays unchanged.
3. Compatibility fix: kept `AMP99 {version}` and update actions available from the initial Preferences view so existing browser smoke behavior remained intact while adding section navigation.
4. Post-fix captures: browser smoke passed 5/5, including 2×, shade, queue filtering and Preferences navigation; the rendered Main and Preferences captures were reviewed against the Stitch source capture.

## Implementation checklist

- [x] Preserve three native Tauri window ownership and native sizing paths.
- [x] Apply Stitch-derived graphite/amber/cyan visual system to default player surfaces.
- [x] Add functional queue filtering without changing queue indices or Spotify operations.
- [x] Reframe Preferences into seven honest sections without inventing backend settings.
- [x] Verify build, unit tests, browser smoke and diff whitespace.
- [x] Add regression coverage for 2×, shade, queue filtering and Preferences navigation.

## Follow-up polish

- Capture packaged Windows screenshots at 1× and 2× once native CI/manual Windows QA is available.
- Run the packaged Windows native test matrix once the Rust/Tauri toolchain is available in CI or on a Windows QA machine.
- Replace remaining fallback text glyphs with approved reusable control assets if an AMP99-owned asset set is added.

final result: passed
