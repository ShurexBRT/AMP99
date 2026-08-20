use std::{
    io::{ErrorKind, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const MAX_SKIN_BYTES: u64 = 16 * 1024 * 1024;
const OPEN_SKIN_EVENT: &str = "amp99://open-skin";
const MEDIA_KEY_EVENT: &str = "amp99://media-key";
const ALWAYS_ON_TOP_EVENT: &str = "amp99://always-on-top-changed";
const SPOTIFY_OAUTH_EVENT: &str = "amp99://spotify-oauth-callback";
const SPOTIFY_AUTHORIZE_PREFIX: &str = "https://accounts.spotify.com/authorize";
const SPOTIFY_CALLBACK_BIND: &str = "127.0.0.1:43821";
const SPOTIFY_CALLBACK_BASE: &str = "http://127.0.0.1:43821";
const SPOTIFY_OAUTH_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const PLAYER_WINDOWS: [&str; 3] = ["main", "equalizer", "playlist"];

#[derive(Default)]
struct PendingSkin(Mutex<Option<String>>);

#[derive(Default)]
struct AlwaysOnTop(AtomicBool);

#[derive(Default)]
struct SpotifyOAuthInFlight(AtomicBool);

fn is_wsz_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wsz"))
}

fn find_wsz_arg(args: &[String]) -> Option<String> {
    args.iter()
        .map(PathBuf::from)
        .find(|path| is_wsz_path(path))
        .map(|path| path.to_string_lossy().into_owned())
}

fn focus_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn focus_preferences(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("preferences") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn set_group_always_on_top(app: &tauri::AppHandle, value: bool) -> bool {
    let mut changed = false;
    for label in PLAYER_WINDOWS {
        if let Some(window) = app.get_webview_window(label) {
            if window.set_always_on_top(value).is_ok() {
                changed = true;
            }
        }
    }
    changed
}

fn publish_always_on_top(app: &tauri::AppHandle, value: bool) {
    let _ = app.emit(ALWAYS_ON_TOP_EVENT, value);
}

#[tauri::command]
fn set_group_always_on_top_preference(
    app: tauri::AppHandle,
    state: tauri::State<'_, AlwaysOnTop>,
    value: bool,
) -> Result<(), String> {
    if !set_group_always_on_top(&app, value) {
        return Err("AMP99 player windows are not available.".into());
    }
    state.0.store(value, Ordering::Relaxed);
    publish_always_on_top(&app, value);
    Ok(())
}

fn queue_skin(app: &tauri::AppHandle, path: String) {
    if let Ok(mut pending) = app.state::<PendingSkin>().0.lock() {
        *pending = Some(path.clone());
    }
    let _ = app.emit(OPEN_SKIN_EVENT, path);
}

#[tauri::command]
fn take_pending_skin(state: tauri::State<'_, PendingSkin>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[tauri::command]
fn read_skin_file(path: String) -> Result<Vec<u8>, String> {
    let requested = PathBuf::from(path);
    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("Could not resolve skin file: {error}"))?;

    if !is_wsz_path(&canonical) {
        return Err("AMP99 only accepts .wsz skin files through this command.".into());
    }

    let metadata = canonical
        .metadata()
        .map_err(|error| format!("Could not inspect skin file: {error}"))?;
    if !metadata.is_file() {
        return Err("Selected skin path is not a regular file.".into());
    }
    if metadata.len() > MAX_SKIN_BYTES {
        return Err(format!(
            "Skin archive is too large ({} bytes; maximum is {} bytes).",
            metadata.len(),
            MAX_SKIN_BYTES
        ));
    }

    std::fs::read(&canonical).map_err(|error| format!("Could not read skin file: {error}"))
}

fn is_allowed_spotify_authorize_url(url: &str) -> bool {
    url.strip_prefix(SPOTIFY_AUTHORIZE_PREFIX)
        .is_some_and(|suffix| suffix.starts_with('?'))
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let result = Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(url).spawn();

    result
        .map(|_| ())
        .map_err(|error| format!("Could not open the browser: {error}"))
}

fn write_oauth_response(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn handle_oauth_connection(
    app: &tauri::AppHandle,
    mut stream: TcpStream,
) -> Result<bool, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|error| format!("Could not configure Spotify callback socket: {error}"))?;

    let mut buffer = [0_u8; 8192];
    let bytes_read = stream
        .read(&mut buffer)
        .map_err(|error| format!("Could not read Spotify callback: {error}"))?;
    if bytes_read == 0 {
        return Ok(false);
    }

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let target = request
        .lines()
        .next()
        .and_then(|line| {
            let mut parts = line.split_whitespace();
            match (parts.next(), parts.next()) {
                (Some("GET"), Some(target)) => Some(target),
                _ => None,
            }
        });

    let Some(target) = target else {
        write_oauth_response(&mut stream, "400 Bad Request", "Invalid AMP99 OAuth callback.");
        return Ok(false);
    };

    if target != "/callback" && !target.starts_with("/callback?") {
        write_oauth_response(&mut stream, "404 Not Found", "AMP99 OAuth callback not found.");
        return Ok(false);
    }

    let callback_url = format!("{SPOTIFY_CALLBACK_BASE}{target}");
    let body = r#"<!doctype html><html><head><meta charset="utf-8"><title>AMP99 Spotify connected</title><style>body{background:#101411;color:#9cff9c;font-family:monospace;padding:48px}h1{font-size:22px}</style></head><body><h1>AMP99 connected to Spotify.</h1><p>You can close this tab and return to AMP99.</p></body></html>"#;
    write_oauth_response(&mut stream, "200 OK", body);

    app.emit(SPOTIFY_OAUTH_EVENT, callback_url)
        .map_err(|error| format!("Could not deliver Spotify callback to AMP99: {error}"))?;
    focus_main(app);
    Ok(true)
}

#[tauri::command]
fn start_spotify_oauth(
    app: tauri::AppHandle,
    state: tauri::State<'_, SpotifyOAuthInFlight>,
    authorization_url: String,
) -> Result<(), String> {
    if !is_allowed_spotify_authorize_url(&authorization_url) {
        return Err("AMP99 only opens the official Spotify authorization endpoint.".into());
    }

    state
        .0
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| "A Spotify sign-in is already in progress.".to_string())?;

    let listener = match TcpListener::bind(SPOTIFY_CALLBACK_BIND) {
        Ok(listener) => listener,
        Err(error) => {
            state.0.store(false, Ordering::Release);
            return Err(format!(
                "Could not start the AMP99 Spotify callback on {SPOTIFY_CALLBACK_BIND}: {error}"
            ));
        }
    };

    if let Err(error) = listener.set_nonblocking(true) {
        state.0.store(false, Ordering::Release);
        return Err(format!("Could not configure the Spotify callback listener: {error}"));
    }

    if let Err(error) = open_system_browser(&authorization_url) {
        state.0.store(false, Ordering::Release);
        return Err(error);
    }

    thread::spawn(move || {
        let deadline = Instant::now() + SPOTIFY_OAUTH_TIMEOUT;

        while Instant::now() < deadline {
            match listener.accept() {
                Ok((stream, _address)) => match handle_oauth_connection(&app, stream) {
                    Ok(true) => break,
                    Ok(false) => {}
                    Err(_error) => {
                        // Keep listening until timeout; a malformed local request should not
                        // invalidate an otherwise healthy Spotify login transaction.
                    }
                },
                Err(error) if error.kind() == ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(75));
                }
                Err(_) => break,
            }
        }

        app.state::<SpotifyOAuthInFlight>()
            .0
            .store(false, Ordering::Release);
    });

    Ok(())
}

fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show AMP99", true, None::<&str>)?;
    let preferences =
        MenuItem::with_id(app, "preferences", "Preferences...", true, None::<&str>)?;
    let always_on_top = MenuItem::with_id(
        app,
        "always-on-top",
        "Toggle Always on Top",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit AMP99", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &preferences, &always_on_top, &quit])?;

    TrayIconBuilder::with_id("amp99-tray")
        .tooltip("AMP99 — Play it like it's 1999")
        .icon(app.default_window_icon().expect("AMP99 app icon missing").clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main(app),
            "preferences" => focus_preferences(app),
            "always-on-top" => {
                let state = app.state::<AlwaysOnTop>();
                let next = !state.0.load(Ordering::Relaxed);
                if set_group_always_on_top(app, next) {
                    state.0.store(next, Ordering::Relaxed);
                    publish_always_on_top(app, next);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn register_media_shortcuts(app: &tauri::AppHandle) {
    for (shortcut, action) in [
        ("MediaPlayPause", "play-pause"),
        ("MediaStop", "stop"),
        ("MediaTrackPrevious", "previous"),
        ("MediaTrackNext", "next"),
    ] {
        // Global media keys can already be owned by another desktop app. AMP99 treats
        // native registration as an enhancement, never as a startup requirement.
        let _ = app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app.emit(MEDIA_KEY_EVENT, action);
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Keep single-instance first: secondary launches are used by .wsz file association.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = find_wsz_arg(&args) {
                queue_skin(app, path);
            }
            focus_main(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(PendingSkin::default())
        .manage(AlwaysOnTop::default())
        .manage(SpotifyOAuthInFlight::default())
        .invoke_handler(tauri::generate_handler![
            take_pending_skin,
            read_skin_file,
            start_spotify_oauth,
            set_group_always_on_top_preference
        ])
        .setup(|app| {
            if let Some(path) = find_wsz_arg(&std::env::args().collect::<Vec<_>>()) {
                if let Ok(mut pending) = app.state::<PendingSkin>().0.lock() {
                    *pending = Some(path);
                }
            }
            create_tray(app.handle())?;
            register_media_shortcuts(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AMP99");
}
