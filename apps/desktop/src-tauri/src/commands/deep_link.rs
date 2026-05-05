// deep_link.rs — Tauri 백엔드에서 deep-link 이벤트를 프론트로 포워딩.
//
// `tauri-plugin-deep-link`는 OS가 던지는 `ai-manuscript-studio://...` URL을
// `on_open_url` 콜백으로 넘긴다. 이걸 그대로 프론트가 듣는 `deep-link:open`
// 이벤트로 emit해서 React 측의 deepLink.ts → projectStore.loadProject로
// 흐르게 한다.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
pub struct DeepLinkOpenPayload {
    pub url: String,
}

pub fn emit_deep_link(app: &AppHandle, url: String) {
    let payload = DeepLinkOpenPayload { url };
    if let Err(e) = app.emit("deep-link:open", payload) {
        eprintln!("[deep-link] emit failed: {e}");
    }
}
