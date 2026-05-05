// watcher.rs — `notify` crate 기반 파일 감시 + 프론트 이벤트 포워딩.
//
// `WatcherRegistry`는 watcher_id → RecommendedWatcher 매핑을 보관한다.
// 각 watcher는 별도 스레드에서 동작하며, 받은 이벤트를 Tauri의 `emit`으로
// `vault:event` 이름으로 프론트엔드에 흘려보낸다.

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use notify::{event::EventKind, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

#[derive(Default)]
pub struct WatcherRegistry {
    next_id: AtomicU64,
    watchers: Mutex<HashMap<u64, RecommendedWatcher>>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct WatchEventPayload {
    pub watcher_id: u64,
    pub kind: WatchKind,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)] // `Rename`은 notify가 RenameMode를 안정적으로 보고할 때까지 예약.
pub enum WatchKind {
    Create,
    Modify,
    Delete,
    Rename,
}

impl WatcherRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(&self, app: AppHandle, path: &str) -> AppResult<u64> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst) + 1;
        let app_for_cb = app.clone();

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            let ev = match res {
                Ok(ev) => ev,
                Err(err) => {
                    eprintln!("[watcher {id}] error: {err}");
                    return;
                }
            };

            let kind = match ev.kind {
                EventKind::Create(_) => WatchKind::Create,
                EventKind::Modify(_) => WatchKind::Modify,
                EventKind::Remove(_) => WatchKind::Delete,
                _ => return,
            };

            for p in ev.paths {
                let path_str = match p.to_str() {
                    Some(s) => s.to_string(),
                    None => continue,
                };
                let payload = WatchEventPayload {
                    watcher_id: id,
                    kind: kind.clone(),
                    path: path_str,
                    old_path: None,
                };
                if let Err(e) = app_for_cb.emit("vault:event", payload) {
                    eprintln!("[watcher {id}] emit failed: {e}");
                }
            }
        })
        .map_err(|e| AppError::Watcher(e.to_string()))?;

        watcher
            .watch(Path::new(path), RecursiveMode::Recursive)
            .map_err(|e| AppError::Watcher(e.to_string()))?;

        let mut map = self
            .watchers
            .lock()
            .map_err(|e| AppError::other(format!("mutex: {e}")))?;
        map.insert(id, watcher);
        Ok(id)
    }

    pub fn stop(&self, id: u64) -> AppResult<()> {
        let mut map = self
            .watchers
            .lock()
            .map_err(|e| AppError::other(format!("mutex: {e}")))?;
        match map.remove(&id) {
            Some(_w) => Ok(()),
            None => Err(AppError::WatcherNotFound(id)),
        }
    }
}
