use std::fs;

use tauri::Manager;

const SPOTIFY_SESSION_FILE: &str = "spotify-session.dpapi";

fn session_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve AMP99 app-data directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create AMP99 app-data directory: {error}"))?;
    Ok(directory.join(SPOTIFY_SESSION_FILE))
}

#[cfg(windows)]
fn protect(value: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};

    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
        },
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let success = unsafe {
        CryptProtectData(
            &input,
            ptr::null(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err("Windows DPAPI could not protect the Spotify session.".into());
    }

    let protected = unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        let _ = LocalFree(output.pbData as _);
    }
    Ok(protected)
}

#[cfg(windows)]
fn unprotect(value: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};

    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
        },
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let success = unsafe {
        CryptUnprotectData(
            &input,
            ptr::null_mut(),
            ptr::null(),
            ptr::null_mut(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err("Windows DPAPI could not decrypt the Spotify session.".into());
    }

    let plaintext = unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        let _ = LocalFree(output.pbData as _);
    }
    Ok(plaintext)
}

#[cfg(not(windows))]
fn protect(_value: &[u8]) -> Result<Vec<u8>, String> {
    Err("AMP99 secure Spotify storage is currently implemented for Windows only.".into())
}

#[cfg(not(windows))]
fn unprotect(_value: &[u8]) -> Result<Vec<u8>, String> {
    Err("AMP99 secure Spotify storage is currently implemented for Windows only.".into())
}

#[tauri::command]
pub fn read_secure_spotify_session(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = session_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let encrypted = fs::read(&path)
        .map_err(|error| format!("Could not read the protected Spotify session: {error}"))?;
    let plaintext = unprotect(&encrypted)?;
    String::from_utf8(plaintext)
        .map(Some)
        .map_err(|error| format!("Protected Spotify session is not valid UTF-8: {error}"))
}

#[tauri::command]
pub fn write_secure_spotify_session(
    app: tauri::AppHandle,
    session: String,
) -> Result<(), String> {
    if session.len() > 64 * 1024 {
        return Err("Protected Spotify session is unexpectedly large.".into());
    }

    let path = session_path(&app)?;
    let encrypted = protect(session.as_bytes())?;
    let temporary = path.with_extension("dpapi.tmp");
    fs::write(&temporary, encrypted)
        .map_err(|error| format!("Could not write the protected Spotify session: {error}"))?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not replace the protected Spotify session: {error}"))?;
    }
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not commit the protected Spotify session: {error}"))
}

#[tauri::command]
pub fn delete_secure_spotify_session(app: tauri::AppHandle) -> Result<(), String> {
    let path = session_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove the protected Spotify session: {error}")),
    }
}
