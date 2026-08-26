mod update_links;
mod secure_storage;

use std::{
    collections::HashMap,
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
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use update_links::open_official_amp99_release;
use secure_storage::{
    delete_secure_spotify_session, read_secure_spotify_session,
    write_secure_spotify_session,
};

const MAX_SKIN_BYTES: u64 = 16 * 1024 * 1024;
const OPEN_SKIN_EVENT: &str = "amp99://open-skin";
const MEDIA_KEY_EVENT: &str = "amp99://media-key";
const ALWAYS_ON_TOP_EVENT: &str = "amp99://always-on-top-changed";
const MAIN_RESTORED_EVENT: &str = "amp99://main-restored";
const SPOTIFY_OAUTH_EVENT: &str = "amp99://spotify-oauth-callback";
const SPOTIFY_AUTHORIZE_PREFIX: &str = "https://accounts.spotify.com/authorize";
const SPOTIFY_CALLBACK_BIND: &str = "127.0.0.1:43821";
const SPOTIFY_CALLBACK_BASE: &str = "http://127.0.0.1:43821";
const SPOTIFY_OAUTH_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const PLAYER_WINDOWS: [&str; 3] = ["main", "equalizer", "playlist"];
const DOCK_LINK_THRESHOLD_PX: i32 = 2;

#[derive(Default)]
struct PendingSkin(Mutex<Option<String>>);

#[derive(Default)]
struct AlwaysOnTop(AtomicBool);

#[derive(Default)]
struct SpotifyOAuthInFlight(AtomicBool);

#[derive(Default)]
struct AuxiliaryVisibility(Mutex<HashMap<String, bool>>);

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

fn ensure_preferences_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("preferences") {
        window
            .show()
            .map_err(|error| format!("Could not show AMP99 Preferences: {error}"))?;
        let _ = window.set_focus();
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app,
        "preferences",
        WebviewUrl::App("index.html".into()),
    )
    .title("AMP99 Preferences")
    .inner_size(390.0, 475.0)
    .position(260.0, 180.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .fullscreen(false)
    .decorations(false)
    .shadow(true)
    .skip_taskbar(true)
    .build()
    .map_err(|error| format!("Could not create AMP99 Preferences: {error}"))?;

    let _ = window.set_focus();
    Ok(())
}

fn focus_preferences(app: &tauri::AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        let _ = ensure_preferences_window(&app);
    });
}

#[tauri::command]
async fn show_preferences_window(app: tauri::AppHandle) -> Result<(), String> {
    ensure_preferences_window(&app)
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

fn reapply_group_always_on_top_impl(app: &tauri::AppHandle) {
    let value = app
        .state::<AlwaysOnTop>()
        .0
        .load(Ordering::Relaxed);

    for label in PLAYER_WINDOWS {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.set_always_on_top(value);
        }
    }
}

#[tauri::command]
fn reapply_group_always_on_top(app: tauri::AppHandle) {
    reapply_group_always_on_top_impl(&app);
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

fn restore_native_auxiliary_windows(app: &tauri::AppHandle) {
    let visibility = app
        .state::<AuxiliaryVisibility>()
        .0
        .lock()
        .map(|state| state.clone())
        .unwrap_or_default();

    for role in ["equalizer", "playlist"] {
        let Some(window) = app.get_webview_window(role) else {
            continue;
        };
        if visibility.get(role).copied().unwrap_or(true) {
            let _ = window.show();
            let _ = window.unminimize();
        } else {
            let _ = window.hide();
        }
    }

    // Showing/unminimizing a window can move it through a different native
    // z-order path. Reapply the group state after the auxiliary restore so a
    // docked window inherits Main's Always on Top setting as well.
    reapply_group_always_on_top_impl(app);
}

#[tauri::command]
fn set_native_auxiliary_visibility(
    app: tauri::AppHandle,
    role: String,
    visible: bool,
    state: tauri::State<'_, AuxiliaryVisibility>,
) -> Result<(), String> {
    if role != "equalizer" && role != "playlist" {
        return Err(format!("Unknown AMP99 auxiliary window role: {role}"));
    }
    state
        .0
        .lock()
        .map_err(|_| "AMP99 auxiliary visibility state is unavailable".to_string())?
        .insert(role, visible);
    if visible {
        reapply_group_always_on_top_impl(&app);
    }
    Ok(())
}

type NativeWindowGeometry = (i32, i32, i32, i32);

fn native_window_geometry(window: &tauri::WebviewWindow) -> Option<NativeWindowGeometry> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    Some((position.x, position.y, size.width as i32, size.height as i32))
}

fn native_windows_are_docked(
    first: NativeWindowGeometry,
    second: NativeWindowGeometry,
) -> bool {
    let (first_x, first_y, first_width, first_height) = first;
    let (second_x, second_y, second_width, second_height) = second;
    let first_right = first_x + first_width;
    let first_bottom = first_y + first_height;
    let second_right = second_x + second_width;
    let second_bottom = second_y + second_height;

    let vertical_overlap = std::cmp::min(first_bottom, second_bottom)
        - std::cmp::max(first_y, second_y)
        > 0;
    let horizontal_overlap = std::cmp::min(first_right, second_right)
        - std::cmp::max(first_x, second_x)
        > 0;
    let touches_horizontally = (first_right - second_x).abs() <= DOCK_LINK_THRESHOLD_PX
        || (second_right - first_x).abs() <= DOCK_LINK_THRESHOLD_PX;
    let touches_vertically = (first_bottom - second_y).abs() <= DOCK_LINK_THRESHOLD_PX
        || (second_bottom - first_y).abs() <= DOCK_LINK_THRESHOLD_PX;

    (touches_horizontally && vertical_overlap)
        || (touches_vertically && horizontal_overlap)
}

fn docked_auxiliary_roles(app: &tauri::AppHandle) -> Vec<&'static str> {
    let mut geometries = Vec::new();
    for label in PLAYER_WINDOWS {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        // A native minimize can make Tauri report Main as not visible even
        // though it remains the group anchor. Keep Main in the geometry graph
        // so the docked auxiliary windows can inherit the same transition.
        if label != "main" && !window.is_visible().unwrap_or(false) {
            continue;
        }
        let Some(geometry) = native_window_geometry(&window) else {
            continue;
        };
        geometries.push((label, geometry));
    }

    let Some((_, _main_geometry)) = geometries.iter().find(|(label, _)| *label == "main") else {
        return Vec::new();
    };

    let mut connected = vec!["main"];
    let mut expanded = true;
    while expanded {
        expanded = false;
        for (label, geometry) in &geometries {
            if connected.contains(label) {
                continue;
            }
            let attaches_to_group = geometries.iter().any(|(member_label, member_geometry)| {
                connected.contains(member_label)
                    && native_windows_are_docked(*member_geometry, *geometry)
            });
            if attaches_to_group {
                connected.push(*label);
                expanded = true;
            }
        }
    }

    connected
        .into_iter()
        .filter(|label| *label != "main")
        .filter(|label| geometries.iter().any(|(candidate, _)| candidate == label))
        .collect()
}

fn native_window_is_minimized(window: &tauri::WebviewWindow) -> Option<bool> {
    #[cfg(windows)]
    {
        let handle = window.window_handle().ok()?;
        let RawWindowHandle::Win32(win32) = handle.as_raw() else {
            return None;
        };
        let hwnd = win32.hwnd.get() as windows_sys::Win32::Foundation::HWND;
        // Tauri's is_minimized() is backed by the runtime state. The native
        // watcher must also observe taskbar/Win32 minimize transitions, which
        // can happen without a Tauri window event reaching the WebView.
        return Some(unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::IsIconic(hwnd) != 0
        });
    }

    #[cfg(not(windows))]
    {
        window.is_minimized().ok()
    }
}

fn watch_main_window_lifecycle(app: &tauri::AppHandle) {
    let handle = app.clone();
    thread::spawn(move || {
        let mut was_minimized = None;
        let mut was_visible = None;

        loop {
            let Some(main) = handle.get_webview_window("main") else {
                thread::sleep(Duration::from_millis(250));
                continue;
            };

            let minimized = native_window_is_minimized(&main).unwrap_or(false);
            let visible = main.is_visible().unwrap_or(true);
            let minimized_from_native = was_minimized == Some(false) && minimized;
            let restored_from_minimize = was_minimized == Some(true) && !minimized;
            let restored_from_hidden = was_visible == Some(false) && visible;

            if minimized_from_native {
                for role in docked_auxiliary_roles(&handle) {
                    if let Some(window) = handle.get_webview_window(role) {
                        let _ = window.minimize();
                    }
                }
            }

            if restored_from_minimize || restored_from_hidden {
                restore_native_auxiliary_windows(&handle);
                let _ = handle.emit(MAIN_RESTORED_EVENT, ());
            }

            was_minimized = Some(minimized);
            was_visible = Some(visible);
            thread::sleep(Duration::from_millis(150));
        }
    });
}

fn enable_native_smoke_always_on_top(app: &tauri::AppHandle) {
    if std::env::var_os("AMP99_SMOKE_ALWAYS_ON_TOP").is_none() {
        return;
    }

    // This is deliberately opt-in and only exists for the Windows native smoke
    // test. It does not alter the persisted user preference or normal startup.
    app.state::<AlwaysOnTop>().0.store(true, Ordering::Relaxed);
    let handle = app.clone();
    thread::spawn(move || {
        for _ in 0..80 {
            reapply_group_always_on_top_impl(&handle);
            thread::sleep(Duration::from_millis(150));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
        .manage(AuxiliaryVisibility::default())
        .invoke_handler(tauri::generate_handler![
            take_pending_skin,
            read_skin_file,
            start_spotify_oauth,
            set_group_always_on_top_preference,
            reapply_group_always_on_top,
            set_native_auxiliary_visibility,
            open_official_amp99_release,
            show_preferences_window,
            read_secure_spotify_session,
            write_secure_spotify_session,
            delete_secure_spotify_session
        ])
        .setup(|app| {
            if let Some(path) = find_wsz_arg(&std::env::args().collect::<Vec<_>>()) {
                if let Ok(mut pending) = app.state::<PendingSkin>().0.lock() {
                    *pending = Some(path);
                }
            }
            create_tray(app.handle())?;
            register_media_shortcuts(app.handle());
            enable_native_smoke_always_on_top(app.handle());
            watch_main_window_lifecycle(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AMP99");
}
