use std::process::Command;

const AMP99_RELEASE_PREFIX: &str = "https://github.com/ShurexBRT/AMP99/releases/";

fn is_official_amp99_release_url(url: &str) -> bool {
    url.starts_with(AMP99_RELEASE_PREFIX)
        && !url.chars().any(|character| matches!(character, '\r' | '\n' | '\0'))
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
        .map_err(|error| format!("Could not open the AMP99 release page: {error}"))
}

#[tauri::command]
pub fn open_official_amp99_release(url: String) -> Result<(), String> {
    if !is_official_amp99_release_url(&url) {
        return Err("AMP99 refused to open a non-official release URL.".into());
    }

    open_system_browser(&url)
}

#[cfg(test)]
mod tests {
    use super::is_official_amp99_release_url;

    #[test]
    fn accepts_official_release_urls() {
        assert!(is_official_amp99_release_url(
            "https://github.com/ShurexBRT/AMP99/releases/tag/v0.2.0-alpha.11"
        ));
    }

    #[test]
    fn rejects_other_urls() {
        assert!(!is_official_amp99_release_url("https://example.com/releases/tag/v1"));
        assert!(!is_official_amp99_release_url("https://github.com/ShurexBRT/OTHER/releases/tag/v1"));
        assert!(!is_official_amp99_release_url(
            "https://github.com/ShurexBRT/AMP99/releases/tag/v1\nhttps://example.com"
        ));
    }
}
