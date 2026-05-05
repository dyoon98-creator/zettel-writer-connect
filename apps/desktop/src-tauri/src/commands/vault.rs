// vault commands — 프론트엔드 vaultAdapter가 호출하는 Tauri invoke 명령.
//
// 모든 경로는 절대경로(string). frontend 측 vaultAdapter가
// `<vaultBasePath>/<rel>` 형식으로 합성해 넘긴다.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::watcher::WatcherRegistry;

#[derive(Debug, Serialize)]
pub struct DirEntryDto {
    pub name: String,
    pub is_directory: bool,
}

#[tauri::command]
pub fn vault_read_file(path: String) -> AppResult<String> {
    let content = fs::read_to_string(&path)?;
    Ok(content)
}

#[tauri::command]
pub fn vault_write_file(path: String, content: String) -> AppResult<()> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    fs::write(&path, content)?;
    Ok(())
}

#[tauri::command]
pub fn vault_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn vault_list_dir(path: String) -> AppResult<Vec<DirEntryDto>> {
    let mut out: Vec<DirEntryDto> = Vec::new();
    let read_dir = fs::read_dir(&path)?;
    for entry in read_dir {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let name = entry
            .file_name()
            .to_str()
            .ok_or(AppError::NonUtf8Path)?
            .to_string();
        out.push(DirEntryDto {
            name,
            is_directory: file_type.is_dir(),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
pub fn vault_ensure_dir(path: String) -> AppResult<()> {
    fs::create_dir_all(&path)?;
    Ok(())
}

#[tauri::command]
pub fn vault_copy_file(src: String, dst: String) -> AppResult<()> {
    if let Some(parent) = Path::new(&dst).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }
    fs::copy(&src, &dst)?;
    Ok(())
}

#[tauri::command]
pub fn vault_delete_file(path: String) -> AppResult<()> {
    let p: PathBuf = PathBuf::from(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        fs::remove_dir_all(&p)?;
    } else {
        fs::remove_file(&p)?;
    }
    Ok(())
}

#[tauri::command]
pub fn vault_watch_start(
    path: String,
    app: AppHandle,
    registry: State<'_, WatcherRegistry>,
) -> AppResult<u64> {
    if !Path::new(&path).exists() {
        return Err(AppError::Invalid(format!("watch path does not exist: {path}")));
    }
    registry.start(app, &path)
}

#[tauri::command]
pub fn vault_watch_stop(
    watcher_id: u64,
    registry: State<'_, WatcherRegistry>,
) -> AppResult<()> {
    registry.stop(watcher_id)
}

// ---- 단위 테스트 (smoke) -------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_tempdir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = env::temp_dir().join(format!("ams-test-{label}-{nanos}"));
        dir
    }

    #[test]
    fn ensure_write_read_roundtrip() {
        let root = unique_tempdir("vault");
        let nested = root.join("sub").join("dir");
        let nested_str = nested.to_str().unwrap().to_string();

        // ensureDir: 깊은 경로도 안전하게 생성.
        vault_ensure_dir(nested_str.clone()).expect("ensure_dir");
        assert!(vault_exists(nested_str.clone()));

        // writeFile: 부모 폴더 자동 생성 + 내용 기록.
        let file_path = nested.join("hello.md");
        let file_path_str = file_path.to_str().unwrap().to_string();
        vault_write_file(file_path_str.clone(), "안녕하세요\n".into())
            .expect("write_file");
        assert!(vault_exists(file_path_str.clone()));

        // readFile: 동일 내용 반환.
        let read = vault_read_file(file_path_str.clone()).expect("read_file");
        assert_eq!(read, "안녕하세요\n");

        // listDir: 항목 1개.
        let entries = vault_list_dir(nested_str.clone()).expect("list_dir");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "hello.md");
        assert!(!entries[0].is_directory);

        // deleteFile: 멱등성 — 두 번 호출 OK.
        vault_delete_file(file_path_str.clone()).expect("delete_file");
        vault_delete_file(file_path_str.clone()).expect("delete_file (idempotent)");
        assert!(!vault_exists(file_path_str));

        // 정리.
        let _ = std::fs::remove_dir_all(&root);
    }
}
