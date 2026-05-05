// commands/voice.rs — 글로벌 "내 문체" 폴더 IO.
//
// 위치: `<app_local_data_dir>/ai-manuscript-studio/voice/`
//   - macOS: ~/Library/Application Support/ai-manuscript-studio/voice/
//   - Windows: %LOCALAPPDATA%\ai-manuscript-studio\voice\
//   - Linux:  ~/.local/share/ai-manuscript-studio/voice/
//
// 모든 프로젝트가 공유하는 단일 폴더. 사용자가 자기 글 .md 들을 여기에 넣으면
// AI 가 분석해서 보이스 가드를 생성한다. 가드 캐시는 같은 폴더의
// `.style-guide.json` 에 보관된다.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::commands::settings::{voice_folder_override, write_voice_folder_override};
use crate::error::{AppError, AppResult};

const APP_DIR_NAME: &str = "ai-manuscript-studio";
const VOICE_SUBDIR: &str = "voice";
const VOICE_README_FILENAME: &str = "README.md";

const VOICE_README_BODY: &str = r#"# 내 문체 폴더

이 폴더에 작가 본인이 쓴 글을 `.md` 파일로 저장해주세요.

AI 원고실은 이 폴더의 글들을 분석해 작가의 문체 가드(어조 / 문장 길이 /
어미·종결 / 어휘 / 호흡)를 만들고, 그 가드를 리서치 텍스트의 "내 문체로
삽입" 기능에서 사용합니다.

## 권장
- 한 파일당 한 편의 글. 600자 이상 — 5,000자 이내가 적절합니다.
- 출판된 원고든 블로그 글이든, "이 작가다" 가 느껴지는 글이면 됩니다.
- 임시 메모, 트위터 단문은 가급적 피하세요. 호흡이 짧아 가드가 왜곡됩니다.

## 재분석
파일을 추가/수정하면 앱의 "내 문체" 패널에서 "재분석" 버튼을 눌러
가드를 갱신하세요. 변화가 감지되면 자동으로 stale 표시가 뜹니다.

## 캐시 파일
같은 폴더의 `.style-guide.json` 은 자동 생성되는 가드 캐시입니다.
지워도 다음 분석 때 다시 만들어지지만 일부러 지울 필요는 없습니다.
"#;

/// 기본 voice 폴더 절대경로 (override 없을 때).
fn default_voice_dir() -> AppResult<PathBuf> {
    let base = dirs::data_local_dir().ok_or_else(|| {
        AppError::Other("local data dir 을 결정할 수 없습니다.".to_string())
    })?;
    Ok(base.join(APP_DIR_NAME).join(VOICE_SUBDIR))
}

/// 사용자 지정 폴더가 비어있으면 README 를 한 번만 떨군다.
/// 이미 파일이 하나라도 있으면 손대지 않는다 (사용자 폴더 침범 방지).
fn ensure_readme(dir: &Path) {
    let readme = dir.join(VOICE_README_FILENAME);
    if readme.exists() {
        return;
    }
    let is_empty = fs::read_dir(dir)
        .map(|mut it| it.next().is_none())
        .unwrap_or(true);
    if !is_empty {
        return;
    }
    let _ = fs::write(&readme, VOICE_README_BODY);
}

/// voice 폴더 절대 경로. 첫 호출 시 폴더 자동 생성, 비어 있으면 README 도.
fn voice_dir() -> AppResult<PathBuf> {
    let dir = match voice_folder_override() {
        Some(custom) => {
            let p = PathBuf::from(custom);
            // 사용자가 지정했지만 폴더가 사라졌을 수 있음 — 가능하면 만들고,
            // 안 되면 기본 위치로 회귀.
            if !p.exists() {
                if fs::create_dir_all(&p).is_err() {
                    default_voice_dir()?
                } else {
                    p
                }
            } else if !p.is_dir() {
                default_voice_dir()?
            } else {
                p
            }
        }
        None => default_voice_dir()?,
    };
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    ensure_readme(&dir);
    Ok(dir)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceFileEntry {
    /// 파일명 (절대경로 아님). 사용자에게 보여주는 식별자.
    pub name: String,
    /// vault 외부 절대 경로 — Finder 열기 / 디버깅 용.
    pub abs_path: String,
    /// 마지막 수정 시각 (Unix epoch millis).
    pub modified_ms: u64,
    /// 바이트 단위 파일 크기.
    pub size: u64,
}

/// voice 디렉토리의 절대 경로를 반환. 디렉토리는 보장 생성된 상태.
#[tauri::command]
pub fn voice_path() -> AppResult<String> {
    let dir = voice_dir()?;
    Ok(dir.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceFolderInfo {
    /// 현재 사용 중인 voice 폴더 절대경로.
    pub path: String,
    /// true 면 settings.json 의 사용자 지정 경로, false 면 기본 위치.
    pub is_custom: bool,
    /// 기본 위치 (사용자에게 'default 로 되돌리기' 안내용).
    pub default_path: String,
}

/// 현재 voice 폴더 정보 — 경로 + custom 여부 + default 경로.
#[tauri::command]
pub fn voice_folder_info() -> AppResult<VoiceFolderInfo> {
    let default = default_voice_dir()?;
    let override_path = voice_folder_override();
    let is_custom = override_path.is_some();
    let dir = voice_dir()?;
    Ok(VoiceFolderInfo {
        path: dir.to_string_lossy().to_string(),
        is_custom,
        default_path: default.to_string_lossy().to_string(),
    })
}

/// 사용자가 지정한 폴더로 voice 위치를 변경한다.
/// path 는 절대경로여야 하고, 디렉토리여야 한다 (없으면 만든다).
/// 빈 문자열이면 reset 과 동일.
#[tauri::command]
pub fn voice_set_folder(path: String) -> AppResult<VoiceFolderInfo> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return voice_reset_folder();
    }
    let p = PathBuf::from(trimmed);
    if !p.is_absolute() {
        return Err(AppError::Other(
            "절대 경로여야 합니다.".to_string(),
        ));
    }
    if !p.exists() {
        fs::create_dir_all(&p)?;
    } else if !p.is_dir() {
        return Err(AppError::Other(
            "선택한 경로가 폴더가 아닙니다.".to_string(),
        ));
    }
    write_voice_folder_override(trimmed)?;
    voice_folder_info()
}

/// 사용자 지정을 풀고 기본 위치로 되돌린다.
#[tauri::command]
pub fn voice_reset_folder() -> AppResult<VoiceFolderInfo> {
    write_voice_folder_override("")?;
    voice_folder_info()
}

/// voice 폴더 내 .md 파일 목록.
/// 숨김파일(.) 과 .style-guide.json 은 제외. README.md 는 포함 (사용자가 읽을 수 있게).
#[tauri::command]
pub fn voice_list_files() -> AppResult<Vec<VoiceFileEntry>> {
    let dir = voice_dir()?;
    let mut out: Vec<VoiceFileEntry> = Vec::new();
    let read = match fs::read_dir(&dir) {
        Ok(r) => r,
        Err(_) => return Ok(out),
    };
    for entry in read.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name_os = match path.file_name() {
            Some(n) => n.to_owned(),
            None => continue,
        };
        let name = name_os.to_string_lossy().to_string();
        // 숨김(.) 과 캐시 파일 스킵.
        if name.starts_with('.') {
            continue;
        }
        // .md 만.
        if !name.to_lowercase().ends_with(".md") {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified_ms: u64 = match meta.modified() {
            Ok(t) => t
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            Err(_) => 0,
        };
        out.push(VoiceFileEntry {
            name,
            abs_path: path.to_string_lossy().to_string(),
            modified_ms,
            size: meta.len(),
        });
    }
    // 수정 시각 내림차순.
    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(out)
}

/// voice 폴더 안의 단일 파일을 절대경로로 안전하게 read.
/// (path 가 voice 디렉토리 밖이면 거부.)
#[tauri::command]
pub fn voice_read_file(path: String) -> AppResult<String> {
    let dir = voice_dir()?;
    let abs = PathBuf::from(&path);
    if !abs.starts_with(&dir) {
        return Err(AppError::Other(
            "voice 폴더 밖의 파일은 읽을 수 없습니다.".to_string(),
        ));
    }
    let raw = fs::read_to_string(&abs)?;
    Ok(raw)
}

/// voice 폴더 안에 파일 작성. name 은 단순 파일명 (디렉토리 escape 금지).
#[tauri::command]
pub fn voice_write_file(name: String, content: String) -> AppResult<String> {
    let dir = voice_dir()?;
    let safe = sanitize_name(&name)?;
    let target = dir.join(&safe);
    if let Some(parent) = target.parent() {
        if parent != dir.as_path() {
            return Err(AppError::Other(
                "voice 폴더 하위 경로는 허용되지 않습니다.".to_string(),
            ));
        }
    }
    fs::write(&target, content)?;
    Ok(target.to_string_lossy().to_string())
}

/// voice 폴더 안의 파일 삭제.
#[tauri::command]
pub fn voice_delete_file(name: String) -> AppResult<()> {
    let dir = voice_dir()?;
    let safe = sanitize_name(&name)?;
    let target = dir.join(&safe);
    if !target.exists() {
        return Ok(());
    }
    fs::remove_file(&target)?;
    Ok(())
}

/// OS 파일 탐색기로 voice 폴더 열기.
#[tauri::command]
pub fn voice_open_folder() -> AppResult<()> {
    let dir = voice_dir()?;
    let path_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    let res = std::process::Command::new("open").arg(&path_str).spawn();

    #[cfg(target_os = "windows")]
    let res = std::process::Command::new("explorer").arg(&path_str).spawn();

    #[cfg(target_os = "linux")]
    let res = std::process::Command::new("xdg-open").arg(&path_str).spawn();

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(AppError::Other(format!(
            "폴더 열기 실패 ({path_str}): {e}"
        ))),
    }
}

/// 파일명 검증 — '/' / '\\' / '..' 금지, 빈 문자열 금지.
fn sanitize_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Other("파일명이 비어 있습니다.".to_string()));
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(AppError::Other(
            "파일명에 경로 구분자를 사용할 수 없습니다.".to_string(),
        ));
    }
    if trimmed == "." || trimmed == ".." {
        return Err(AppError::Other("잘못된 파일명입니다.".to_string()));
    }
    Ok(trimmed.to_string())
}
