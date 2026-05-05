// commands/ai.rs — Tauri 커맨드 래퍼.
//
// 프론트엔드는 `invoke("ai_invoke", ...)` 한 번만 호출하면 즉시 Ok를 받고,
// 토큰/완료/오류는 Tauri 이벤트로 도착한다. invocation_id를 키로 흐름을 라우팅.

use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::ai_bridge::{spawn_ai_invocation, AiInvocationRegistry, AiInvokeRequest};
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn ai_invoke(
    app: AppHandle,
    registry: State<'_, Arc<AiInvocationRegistry>>,
    invocation_id: String,
    provider: String,
    binary_path: String,
    extra_args: Vec<String>,
    prompt: String,
    timeout_secs: u64,
) -> AppResult<()> {
    if invocation_id.trim().is_empty() {
        return Err(AppError::Invalid("invocation_id가 비어 있습니다.".to_string()));
    }
    if binary_path.trim().is_empty() {
        return Err(AppError::Invalid("binary_path가 비어 있습니다.".to_string()));
    }

    let req = AiInvokeRequest {
        invocation_id,
        provider,
        binary_path,
        extra_args,
        prompt,
        timeout_secs: if timeout_secs == 0 { 60 } else { timeout_secs },
    };

    spawn_ai_invocation(app, registry.inner().clone(), req).await;
    Ok(())
}

#[tauri::command]
pub async fn ai_cancel(
    registry: State<'_, Arc<AiInvocationRegistry>>,
    invocation_id: String,
) -> AppResult<bool> {
    Ok(registry.cancel(&invocation_id).await)
}

/// 사전 가용성 체크 — `which`/`where`로 binary가 PATH 또는 절대 경로로
/// 존재하는지만 확인한다. 실행은 하지 않는다.
#[tauri::command]
pub fn ai_resolve_binary(binary_path: String) -> bool {
    use std::path::Path;
    let trimmed = binary_path.trim();
    if trimmed.is_empty() {
        return false;
    }
    // 절대 경로면 그대로 검사.
    let p = Path::new(trimmed);
    if p.is_absolute() {
        return p.is_file();
    }
    // 상대명: PATH에서 검색.
    let cmd = if cfg!(windows) { "where" } else { "which" };
    let out = std::process::Command::new(cmd).arg(trimmed).output();
    matches!(out, Ok(o) if o.status.success())
}

/// 사용자의 login shell 을 거쳐 `which <name>` 결과의 절대 경로를 찾는다.
/// macOS GUI 앱은 launchd 가 부여한 짧은 PATH 만 가지고 있어
/// nvm/homebrew/cargo 의 bin 디렉터리가 보이지 않는다.
/// `zsh -ilc 'command -v <name>'` 을 사용해 사용자가 평소 터미널에서
/// 보는 PATH 와 동일한 환경에서 검색한다.
#[tauri::command]
pub fn ai_find_binary(name: String) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    // 1) bash/zsh 시도 — login + interactive 로 사용자의 실제 PATH 로드.
    //    -i 가 일부 환경에서 hang 할 수 있어 -l 만 우선 시도, 실패 시 -il 시도.
    for shell in &["zsh", "bash"] {
        for flags in &["-lc", "-ilc"] {
            let cmd_str = format!("command -v {}", shell_escape(trimmed));
            let out = std::process::Command::new(shell)
                .arg(flags)
                .arg(&cmd_str)
                .output();
            if let Ok(o) = out {
                if o.status.success() {
                    let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    if !s.is_empty() && std::path::Path::new(&s).is_file() {
                        return s;
                    }
                }
            }
        }
    }
    // 2) fallback: PATH 직접 검색.
    let cmd = if cfg!(windows) { "where" } else { "which" };
    if let Ok(o) = std::process::Command::new(cmd).arg(trimmed).output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() && std::path::Path::new(&s).is_file() {
                return s;
            }
        }
    }
    // 3) 알려진 후보 디렉터리들 직접 검사.
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates: Vec<String> = vec![
        format!("/opt/homebrew/bin/{}", trimmed),
        format!("/usr/local/bin/{}", trimmed),
        format!("/usr/bin/{}", trimmed),
        format!("{}/.cargo/bin/{}", home, trimmed),
        format!("{}/.bun/bin/{}", home, trimmed),
    ];
    for c in candidates {
        if std::path::Path::new(&c).is_file() {
            return c;
        }
    }
    // 4) nvm 의 가장 최신 node 버전에서 시도.
    let nvm_dir = format!("{}/.nvm/versions/node", home);
    if let Ok(rd) = std::fs::read_dir(&nvm_dir) {
        let mut versions: Vec<String> = rd
            .filter_map(|e| e.ok().and_then(|e| e.file_name().into_string().ok()))
            .collect();
        versions.sort();
        for v in versions.iter().rev() {
            let p = format!("{}/{}/bin/{}", nvm_dir, v, trimmed);
            if std::path::Path::new(&p).is_file() {
                return p;
            }
        }
    }
    String::new()
}

fn shell_escape(s: &str) -> String {
    // 단순한 single-quote 기반 escape — 'foo'\''bar' 형태.
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        if c == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(c);
        }
    }
    out.push('\'');
    out
}
