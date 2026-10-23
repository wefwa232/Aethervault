//! Aethervault desktop shell. The game itself is the shared web frontend; this crate only hosts it and provides the
//! system-browser sign-in loopback (RFC 8252): Google refuses OAuth inside embedded webviews, so sign-in opens the
//! default browser and a one-shot listener on 127.0.0.1 receives the redirect.
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const CALLBACK_EVENT: &str = "av-auth-callback";
const LISTEN_FOR: Duration = Duration::from_secs(10 * 60);

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Aethervault</title>\
<style>body{font:16px system-ui;background:#0b0a12;color:#e8e4f4;display:grid;place-items:center;height:100vh;margin:0}\
div{text-align:center;max-width:26rem;padding:1rem}h1{font-size:1.2rem}</style>\
<div><h1>You can return to Aethervault</h1><p>Sign-in finished. This tab can be closed.</p></div>";

#[derive(Default)]
struct AuthListener(Mutex<Option<Arc<AtomicBool>>>);

/// Pulls the query string out of a loopback callback request, or None when the request is not our callback
/// (wrong path, wrong Host, favicon probes, ...). Only `/` carrying `code` or `error*` counts.
fn callback_query(request: &str, port: u16) -> Option<String> {
    let mut lines = request.lines();
    let mut first = lines.next()?.split_whitespace();
    if first.next()? != "GET" {
        return None;
    }
    let target = first.next()?;
    let host_ok = lines.any(|l| {
        let l = l.to_ascii_lowercase();
        l == format!("host: 127.0.0.1:{port}") || l == format!("host: localhost:{port}")
    });
    if !host_ok {
        return None;
    }
    let (path, query) = target.split_once('?')?;
    if path != "/" {
        return None;
    }
    let has = |k: &str| query.split('&').any(|p| p == k || p.starts_with(&format!("{k}=")));
    (has("code") || has("error") || has("error_description")).then(|| query.to_string())
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

/// Starts a one-shot loopback listener and returns its port. The redirect's query string is delivered to the page as
/// the `av-auth-callback` event. Any previous listener is cancelled first.
#[tauri::command]
fn auth_listen(app: AppHandle, state: State<AuthListener>) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let cancel = Arc::new(AtomicBool::new(false));
    if let Some(old) = state.0.lock().unwrap().replace(cancel.clone()) {
        old.store(true, Ordering::SeqCst);
    }
    thread::spawn(move || {
        let started = Instant::now();
        while !cancel.load(Ordering::SeqCst) && started.elapsed() < LISTEN_FOR {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    match callback_query(&req, port) {
                        Some(query) => {
                            respond(&mut stream, "200 OK", DONE_PAGE);
                            let _ = app.emit(CALLBACK_EVENT, query);
                            return;
                        }
                        None => respond(&mut stream, "404 Not Found", "Not found"),
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(100)),
                Err(_) => break,
            }
        }
    });
    Ok(port)
}

#[tauri::command]
fn auth_cancel(state: State<AuthListener>) {
    if let Some(c) = state.0.lock().unwrap().take() {
        c.store(true, Ordering::SeqCst);
    }
}

/// Opens an https URL in the user's default browser. Nothing else is ever opened from the page.
#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") || url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("only https URLs can be opened".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Embedded assets are served without HTTP Range support, which leaves <audio> unable to seek or loop the music.
/// Answers `Range: bytes=a-b` requests from the in-memory body (206 + Content-Range) and advertises ranges for media.
fn serve_ranges(req: &tauri::http::Request<Vec<u8>>, resp: &mut tauri::http::Response<std::borrow::Cow<'static, [u8]>>) {
    use tauri::http::{header, StatusCode};
    let is_media = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map_or(false, |t| t.starts_with("audio/") || t.starts_with("video/"));
    if !is_media || resp.status() != StatusCode::OK {
        return;
    }
    resp.headers_mut().insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
    let Some(spec) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("bytes=")) else { return };
    let total = resp.body().len();
    let (a, b) = spec.split_once('-').unwrap_or((spec, ""));
    let (start, end) = match (a.parse::<usize>(), b.parse::<usize>()) {
        (Ok(s), Ok(e)) => (s, e.min(total.saturating_sub(1))),
        (Ok(s), Err(_)) if b.is_empty() => (s, total.saturating_sub(1)),
        (Err(_), Ok(n)) if a.is_empty() => (total.saturating_sub(n), total.saturating_sub(1)),
        _ => return,
    };
    if total == 0 || start > end || start >= total {
        *resp.status_mut() = StatusCode::RANGE_NOT_SATISFIABLE;
        resp.headers_mut().insert(header::CONTENT_RANGE, format!("bytes */{total}").parse().unwrap());
        *resp.body_mut() = std::borrow::Cow::Borrowed(&[]);
        return;
    }
    let part = resp.body()[start..=end].to_vec();
    *resp.status_mut() = StatusCode::PARTIAL_CONTENT;
    resp.headers_mut().insert(header::CONTENT_RANGE, format!("bytes {start}-{end}/{total}").parse().unwrap());
    resp.headers_mut().insert(header::CONTENT_LENGTH, part.len().to_string().parse().unwrap());
    *resp.body_mut() = std::borrow::Cow::Owned(part);
}

pub fn run() {
    tauri::Builder::default()
        // A second copy would share the same webview storage and could overwrite the save; focus the first instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .manage(AuthListener::default())
        .setup(|app| {
            // The window is declared in tauri.conf.json (create: false) and built here only to attach serve_ranges.
            let cfg = app.config().app.windows[0].clone();
            tauri::WebviewWindowBuilder::from_config(app.handle(), &cfg)?
                .on_web_resource_request(|req, resp| serve_ranges(&req, resp))
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![auth_listen, auth_cancel, open_external])
        .run(tauri::generate_context!())
        .expect("error while running Aethervault");
}

#[cfg(test)]
mod tests {
    use super::callback_query;

    fn req(target: &str, host: &str) -> String {
        format!("GET {target} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: x\r\n\r\n")
    }

    #[test]
    fn accepts_code_and_error() {
        assert_eq!(callback_query(&req("/?code=abc", "127.0.0.1:5000"), 5000).as_deref(), Some("code=abc"));
        assert!(callback_query(&req("/?error=access_denied&error_description=x", "127.0.0.1:5000"), 5000).is_some());
    }

    #[test]
    fn rejects_everything_else() {
        assert!(callback_query(&req("/favicon.ico", "127.0.0.1:5000"), 5000).is_none());
        assert!(callback_query(&req("/?x=1", "127.0.0.1:5000"), 5000).is_none());
        assert!(callback_query(&req("/?code=abc", "evil.example:5000"), 5000).is_none());
        assert!(callback_query(&req("/other?code=abc", "127.0.0.1:5000"), 5000).is_none());
        assert!(callback_query(&req("/?code=abc", "127.0.0.1:5001"), 5000).is_none());
        assert!(callback_query("POST /?code=a HTTP/1.1\r\nHost: 127.0.0.1:5000\r\n\r\n", 5000).is_none());
        assert!(callback_query(&req("/?codex=abc", "127.0.0.1:5000"), 5000).is_none());
    }
}
