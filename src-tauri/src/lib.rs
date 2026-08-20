use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
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
const PLAYER_WINDOWS: [&str; 3] = ["main", "equalizer", "playlist"];

#[derive(Default)]
struct PendingSkin(Mutex<Option<String>>);

#[derive(Default)]
struct AlwaysOnTop(AtomicBool);

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

fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show AMP99", true, None::<&str>)?;
    let always_on_top = MenuItem::with_id(
        app,
        "always-on-top",
        "Toggle Always on Top",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit AMP99", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &always_on_top, &quit])?;

    TrayIconBuilder::with_id("amp99-tray")
        .tooltip("AMP99 — Play it like it's 1999")
        .icon(app.default_window_icon().expect("AMP99 app icon missing").clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main(app),
            "always-on-top" => {
                let state = app.state::<AlwaysOnTop>();
                let next = !state.0.load(Ordering::Relaxed);
                if set_group_always_on_top(app, next) {
                    state.0.store(next, Ordering::Relaxed);
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
        .invoke_handler(tauri::generate_handler![take_pending_skin, read_skin_file])
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
