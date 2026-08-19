use std::{
    io::{ErrorKind, Read, Write},
    net::{TcpListener, TcpStream},
    process::Command,
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter};

const LOOPBACK_HOST: &str = "127.0.0.1";
const LOOPBACK_PORT: u16 = 43_821;
const CALLBACK_PATH: &str = "/callback";
const LISTENER_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const MAX_REQUEST_BYTES: usize = 16 * 1024;
const SPOTIFY_AUTHORIZE_PREFIX: &str = "https://accounts.spotify.com/authorize?";

pub const SPOTIFY_OAUTH_CALLBACK_EVENT: &str = "spotify-oauth-callback";

fn redirect_uri() -> String {
    format!("http://{LOOPBACK_HOST}:{LOOPBACK_PORT}{CALLBACK_PATH}")
}

fn html_response(status: &str, body: &str) -> String {
    let html = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>AMP99</title><style>body{{margin:0;background:#15171c;color:#55ef67;font:16px monospace;display:grid;place-items:center;min-height:100vh}}main{{border:2px solid #6d727c;padding:28px;background:#080c09;box-shadow:6px 6px 0 #000}}strong{{color:#fff}}</style></head><body><main><strong>AMP99</strong><br>{body}</main></body></html>"
    );

    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
        html.as_bytes().len(),
        html
    )
}

fn request_target(stream: &mut TcpStream) -> Result<String, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|error| format!("Could not configure OAuth callback socket: {error}"))?;

    let mut buffer = [0_u8; MAX_REQUEST_BYTES];
    let mut used = 0_usize;

    loop {
        if used >= buffer.len() {
            return Err("OAuth callback request was too large.".to_string());
        }

        match stream.read(&mut buffer[used..]) {
            Ok(0) => break,
            Ok(read) => {
                used += read;
                if buffer[..used].windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            Err(error) if matches!(error.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {
                break;
            }
            Err(error) => {
                return Err(format!("Could not read OAuth callback: {error}"));
            }
        }
    }

    let request = std::str::from_utf8(&buffer[..used])
        .map_err(|_| "OAuth callback was not valid UTF-8.".to_string())?;
    let first_line = request
        .lines()
        .next()
        .ok_or_else(|| "OAuth callback request was empty.".to_string())?;
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();

    if method != "GET" {
        return Err("OAuth callback must use GET.".to_string());
    }

    if !target.starts_with(CALLBACK_PATH) {
        return Err("OAuth callback used an unexpected path.".to_string());
    }

    Ok(target.to_string())
}

fn serve_callback(listener: TcpListener, app: AppHandle) {
    let deadline = Instant::now() + LISTENER_TIMEOUT;

    while Instant::now() < deadline {
        match listener.accept() {
            Ok((mut stream, address)) => {
                if !address.ip().is_loopback() {
                    let response = html_response(
                        "403 Forbidden",
                        "AMP99 refused a non-loopback OAuth callback.",
                    );
                    let _ = stream.write_all(response.as_bytes());
                    continue;
                }

                match request_target(&mut stream) {
                    Ok(target) => {
                        let callback_url = format!(
                            "http://{LOOPBACK_HOST}:{LOOPBACK_PORT}{target}"
                        );
                        let response = html_response(
                            "200 OK",
                            "Spotify returned control to AMP99.<br>You can close this tab.",
                        );
                        let _ = stream.write_all(response.as_bytes());
                        let _ = stream.flush();
                        let _ = app.emit(SPOTIFY_OAUTH_CALLBACK_EVENT, callback_url);
                        return;
                    }
                    Err(_) => {
                        let response = html_response(
                            "404 Not Found",
                            "This local AMP99 OAuth listener only accepts the Spotify callback path.",
                        );
                        let _ = stream.write_all(response.as_bytes());
                    }
                }
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => return,
        }
    }
}

#[tauri::command]
pub fn prepare_spotify_oauth(app: AppHandle) -> Result<String, String> {
    let listener = TcpListener::bind((LOOPBACK_HOST, LOOPBACK_PORT)).map_err(|error| {
        if error.kind() == ErrorKind::AddrInUse {
            format!(
                "AMP99 OAuth port {LOOPBACK_PORT} is already in use. Close the other process and try again."
            )
        } else {
            format!("Could not start AMP99 OAuth listener: {error}")
        }
    })?;

    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Could not configure AMP99 OAuth listener: {error}"))?;

    thread::spawn(move || serve_callback(listener, app));
    Ok(redirect_uri())
}

#[tauri::command]
pub fn open_spotify_authorization(url: String) -> Result<(), String> {
    if !url.starts_with(SPOTIFY_AUTHORIZE_PREFIX) {
        return Err("AMP99 will only open the official Spotify authorization URL.".to_string());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32");
        command.arg("url.dll,FileProtocolHandler").arg(&url);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&url);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&url);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("Could not open Spotify authorization in the system browser: {error}"))?;

    Ok(())
}
