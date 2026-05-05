// commands/settings.rs — 사용자 설정 영구 저장.
//
// 위치: `<app_local_data_dir>/ai-manuscript-studio/settings.json`
//   - macOS: ~/Library/Application Support/ai-manuscript-studio/settings.json
//   - Windows: %LOCALAPPDATA%\ai-manuscript-studio\settings.json
//   - Linux:  ~/.local/share/ai-manuscript-studio/settings.json
//
// 파일이 없으면 default를 반환한다. 파싱 실패 시에도 default + 경고로 fallback.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

const SETTINGS_FILE_NAME: &str = "settings.json";
const APP_DIR_NAME: &str = "ai-manuscript-studio";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub ai_provider: String,
    pub codex_path: String,
    pub codex_extra_args: String,
    pub claude_code_path: String,
    pub confirm_before_run: bool,
    pub enable_exec_log: bool,
    pub excluded_folders: String,
    pub license_key: String,
    pub skillpack_folder: String,
    pub use_mock_bridge: bool,
    /// 사용자가 직접 지정한 "내 문체" 폴더 절대경로. 빈 문자열이면 기본 위치
    /// (`<app_local_data_dir>/ai-manuscript-studio/voice/`) 를 사용한다.
    pub voice_folder: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            ai_provider: "codex".to_string(),
            codex_path: String::new(),
            codex_extra_args: String::new(),
            claude_code_path: String::new(),
            confirm_before_run: true,
            enable_exec_log: false,
            excluded_folders: "0 raw,3 Archive".to_string(),
            license_key: String::new(),
            skillpack_folder: "_skillpacks".to_string(),
            use_mock_bridge: false,
            voice_folder: String::new(),
        }
    }
}

/// 설정 파일에 기록된 voice_folder override 만 가볍게 읽는다.
/// voice 모듈에서 settings 전체 의존성 없이 사용하기 위해 분리.
pub fn voice_folder_override() -> Option<String> {
    let path = settings_path().ok()?;
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(&path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let folder = v.get("voiceFolder")?.as_str()?.trim().to_string();
    if folder.is_empty() {
        None
    } else {
        Some(folder)
    }
}

/// settings.json 의 voiceFolder 만 patch. (다른 필드는 보존.)
pub fn write_voice_folder_override(value: &str) -> AppResult<()> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut current: serde_json::Value = if path.exists() {
        match fs::read_to_string(&path) {
            Ok(raw) => serde_json::from_str(&raw)
                .unwrap_or_else(|_| serde_json::to_value(AppSettings::default()).unwrap()),
            Err(_) => serde_json::to_value(AppSettings::default()).unwrap(),
        }
    } else {
        serde_json::to_value(AppSettings::default()).unwrap()
    };
    if let Some(obj) = current.as_object_mut() {
        obj.insert(
            "voiceFolder".to_string(),
            serde_json::Value::String(value.to_string()),
        );
    }
    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| AppError::Other(format!("serialize: {e}")))?;
    fs::write(&path, json)?;
    Ok(())
}

fn settings_path() -> AppResult<PathBuf> {
    // dirs::data_local_dir()는 OS별 표준 경로를 반환.
    let base = dirs::data_local_dir().ok_or_else(|| {
        AppError::Other("local data dir을 결정할 수 없습니다.".to_string())
    })?;
    let dir = base.join(APP_DIR_NAME);
    Ok(dir.join(SETTINGS_FILE_NAME))
}

#[tauri::command]
pub fn settings_load() -> AppResult<AppSettings> {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return Ok(AppSettings::default()),
    };
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = match fs::read_to_string(&path) {
        Ok(r) => r,
        Err(_) => return Ok(AppSettings::default()),
    };
    match serde_json::from_str::<AppSettings>(&raw) {
        Ok(s) => Ok(s),
        Err(_) => Ok(AppSettings::default()),
    }
}

#[tauri::command]
pub fn settings_save(settings: AppSettings) -> AppResult<()> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| AppError::Other(format!("serialize: {e}")))?;
    fs::write(&path, json)?;
    Ok(())
}
