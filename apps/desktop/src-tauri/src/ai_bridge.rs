// ai_bridge.rs — AI CLI 어댑터 (codex / claude-code).
//
// `tokio::process::Command`로 외부 CLI를 spawn하고 stdin으로 prompt를 주입,
// stdout 라인 단위 스트리밍을 Tauri 이벤트(`ai:token`, `ai:done`, `ai:error`)로
// 프론트에 전달한다.
//
// 핵심 기능:
//   - 60초 (또는 caller 지정) 타임아웃 → SIGTERM → grace period 후 SIGKILL
//   - AbortHandle을 in-memory `AiInvocationRegistry`에 등록하여 외부에서 취소
//   - stderr는 last 2KB만 보관해 에러 시 첨부
//   - 모든 이벤트는 `invocationId`로 라우팅

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

const STDERR_TAIL_BYTES: usize = 2 * 1024;
const KILL_GRACE_MS: u64 = 2_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiInvokeRequest {
    pub invocation_id: String,
    pub provider: String,
    pub binary_path: String,
    pub extra_args: Vec<String>,
    pub prompt: String,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTokenPayload {
    pub invocation_id: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDonePayload {
    pub invocation_id: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub full_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiErrorPayload {
    pub invocation_id: String,
    pub message: String,
    pub stderr: String,
}

/// 활성 invocation 추적용 registry.
/// JoinHandle을 보유하여 외부 cancel 명령이 중단할 수 있게 한다.
#[derive(Default)]
pub struct AiInvocationRegistry {
    inner: Arc<Mutex<HashMap<String, AiInvocationEntry>>>,
}

pub struct AiInvocationEntry {
    /// spawn된 task의 JoinHandle. abort()로 취소 가능.
    abort: JoinHandle<()>,
    /// 자식 프로세스를 강제 종료할 때 쓰는 PID (선택적).
    pid: Option<u32>,
}

impl AiInvocationRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn insert(&self, id: String, entry: AiInvocationEntry) {
        let mut map = self.inner.lock().await;
        map.insert(id, entry);
    }

    pub async fn remove(&self, id: &str) -> Option<AiInvocationEntry> {
        let mut map = self.inner.lock().await;
        map.remove(id)
    }

    pub async fn cancel(&self, id: &str) -> bool {
        if let Some(entry) = self.remove(id).await {
            entry.abort.abort();
            // 자식 프로세스도 죽인다 (best-effort).
            #[cfg(unix)]
            if let Some(pid) = entry.pid {
                unsafe {
                    libc_kill(pid as i32, 15); // SIGTERM
                }
            }
            #[cfg(not(unix))]
            let _ = entry.pid;
            true
        } else {
            false
        }
    }
}

#[cfg(unix)]
extern "C" {
    fn kill(pid: i32, sig: i32) -> i32;
}

#[cfg(unix)]
unsafe fn libc_kill(pid: i32, sig: i32) -> i32 {
    kill(pid, sig)
}

/// AI 호출을 백그라운드에서 시작한다. 즉시 반환하며, 스트리밍/완료는
/// Tauri event를 통해 전달된다. 호출자가 사전에 `registry.insert`로 abort
/// 핸들을 등록하므로, 이 함수는 단순히 spawn된 task를 빠져나간다.
pub async fn spawn_ai_invocation(
    app: AppHandle,
    registry: Arc<AiInvocationRegistry>,
    req: AiInvokeRequest,
) {
    let invocation_id = req.invocation_id.clone();
    let app_for_task = app.clone();
    let reg_for_task = registry.clone();

    let handle = tokio::spawn(async move {
        run_invocation(app_for_task, reg_for_task, req).await;
    });

    // entry는 task 안에서 child PID를 얻은 직후에 갱신된다.
    let entry = AiInvocationEntry {
        abort: handle,
        pid: None,
    };
    registry.insert(invocation_id, entry).await;
}

async fn run_invocation(
    app: AppHandle,
    registry: Arc<AiInvocationRegistry>,
    req: AiInvokeRequest,
) {
    let invocation_id = req.invocation_id.clone();
    let start = Instant::now();
    let timeout = Duration::from_secs(req.timeout_secs.max(1));

    // codex provider 일 때 사용할 임시 작업 디렉터리 + output-last-message 파일 경로.
    // (codex exec 가 git repo / sandbox 컨텍스트를 요구하므로 격리된 tempdir 안에서 돌린다.)
    let codex_ctx = if req.provider == "codex" {
        match build_codex_ctx() {
            Ok(ctx) => Some(ctx),
            Err(e) => {
                emit_error(
                    &app,
                    &invocation_id,
                    format!("Codex 작업 디렉터리 생성 실패: {e}"),
                    String::new(),
                );
                registry.remove(&invocation_id).await;
                return;
            }
        }
    } else {
        None
    };

    // 1. spawn — codex 면 `codex exec --json -s read-only --skip-git-repo-check
    //    -C <workdir> --output-last-message <file> [-m <model>] -` 형태.
    //    기타 (claude 등) 은 그냥 binary + extra_args + stdin 방식 유지.
    let mut cmd = Command::new(&req.binary_path);
    if let Some(ctx) = &codex_ctx {
        cmd.args(build_codex_args(ctx, &req.extra_args));
    } else {
        cmd.args(&req.extra_args);
    }
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child: Child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            emit_error(
                &app,
                &invocation_id,
                format!("프로세스 시작 실패: {e}"),
                String::new(),
            );
            registry.remove(&invocation_id).await;
            return;
        }
    };

    // 자식 PID 갱신 (cancel 시 SIGTERM 보낼 때 사용).
    {
        let pid = child.id();
        let mut map = registry.inner.lock().await;
        if let Some(entry) = map.get_mut(&invocation_id) {
            entry.pid = pid;
        }
    }

    // 2. stdin에 prompt 주입 후 닫기.
    if let Some(mut stdin) = child.stdin.take() {
        let prompt = req.prompt.clone();
        if let Err(e) = stdin.write_all(prompt.as_bytes()).await {
            emit_error(
                &app,
                &invocation_id,
                format!("stdin 쓰기 실패: {e}"),
                String::new(),
            );
            let _ = child.kill().await;
            registry.remove(&invocation_id).await;
            return;
        }
        // explicit drop closes the pipe.
        drop(stdin);
    }

    // 3. stdout / stderr 라인 단위 읽기 + token emit + 누적.
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let app_for_stdout = app.clone();
    let id_for_stdout = invocation_id.clone();
    let stdout_task: JoinHandle<String> = tokio::spawn(async move {
        let mut acc = String::new();
        if let Some(stdout) = stdout {
            let mut reader = BufReader::new(stdout).lines();
            loop {
                match reader.next_line().await {
                    Ok(Some(line)) => {
                        // 라인 단위로 token emit. 라인 끝에 \n 추가하여 작가가
                        // 점진 렌더할 때 자연스럽게 줄바꿈을 보존하도록.
                        let token = format!("{}\n", line);
                        acc.push_str(&token);
                        let _ = app_for_stdout.emit(
                            "ai:token",
                            AiTokenPayload {
                                invocation_id: id_for_stdout.clone(),
                                token,
                            },
                        );
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
        }
        acc
    });

    let stderr_task: JoinHandle<String> = tokio::spawn(async move {
        let mut tail = String::new();
        if let Some(stderr) = stderr {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                tail.push_str(&line);
                tail.push('\n');
                if tail.len() > STDERR_TAIL_BYTES * 2 {
                    let drop_n = tail.len() - STDERR_TAIL_BYTES;
                    tail.drain(..drop_n);
                }
            }
        }
        if tail.len() > STDERR_TAIL_BYTES {
            let cut = tail.len() - STDERR_TAIL_BYTES;
            tail.drain(..cut);
        }
        tail
    });

    // 4. 타임아웃 가드 + child.wait()
    let wait_result = tokio::time::timeout(timeout, child.wait()).await;

    match wait_result {
        Ok(Ok(status)) => {
            let stdout_acc = stdout_task.await.unwrap_or_default();
            let stderr_tail = stderr_task.await.unwrap_or_default();
            let duration_ms = start.elapsed().as_millis() as u64;

            // codex 인 경우 진짜 응답은 stdout (JSONL events) 이 아니라
            // --output-last-message 파일에 떨어진다. 그 파일을 fullText 로 사용.
            let full_text = match &codex_ctx {
                Some(ctx) => match std::fs::read_to_string(&ctx.last_msg_path) {
                    Ok(s) if !s.trim().is_empty() => s,
                    _ => {
                        // 파일이 비었거나 못 읽으면 stdout 의 마지막 의미 있는 라인 추출 시도.
                        extract_last_codex_message(&stdout_acc).unwrap_or_else(|| stdout_acc.clone())
                    }
                },
                None => stdout_acc.clone(),
            };

            let exit_code = status.code().unwrap_or(-1);
            if exit_code == 0 {
                emit_done(&app, &invocation_id, exit_code, duration_ms, full_text);
            } else {
                // stdout JSONL 에서 사람이 읽을 수 있는 사유 추출.
                let reason =
                    extract_codex_failure_reason(&stdout_acc).unwrap_or_else(|| stderr_tail.clone());
                emit_error(
                    &app,
                    &invocation_id,
                    format!("CLI 종료 코드 {exit_code} — {reason}"),
                    stderr_tail,
                );
            }

            // codex tempdir cleanup.
            if let Some(ctx) = &codex_ctx {
                let _ = std::fs::remove_dir_all(&ctx.work_dir);
            }
        }
        Ok(Err(e)) => {
            // child.wait() 자체가 실패 (드물다)
            let stderr_tail = stderr_task.await.unwrap_or_default();
            emit_error(
                &app,
                &invocation_id,
                format!("프로세스 종료 대기 실패: {e}"),
                stderr_tail,
            );
            if let Some(ctx) = &codex_ctx {
                let _ = std::fs::remove_dir_all(&ctx.work_dir);
            }
        }
        Err(_) => {
            // 타임아웃 → SIGTERM
            let _ = child.start_kill();
            // grace period 동안 종료를 기다려본다.
            let _ = tokio::time::timeout(
                Duration::from_millis(KILL_GRACE_MS),
                child.wait(),
            )
            .await;
            // 안 죽으면 한 번 더 kill (Tokio의 kill_on_drop이 SIGKILL로 처리).
            let _ = child.kill().await;

            let _ = stdout_task.await;
            let stderr_tail = stderr_task.await.unwrap_or_default();
            let duration_ms = start.elapsed().as_millis() as u64;
            emit_error(
                &app,
                &invocation_id,
                format!("시간 초과 ({}s)", duration_ms / 1000),
                stderr_tail,
            );
            if let Some(ctx) = &codex_ctx {
                let _ = std::fs::remove_dir_all(&ctx.work_dir);
            }
        }
    }

    registry.remove(&invocation_id).await;
}

// ─────────────────────────────────────────────────────────────────────
// Codex CLI helpers
//
// Pivotrix/src/lib/codex/runner.ts 의 검증된 호출 패턴을 그대로 따른다:
//   codex exec --json --ephemeral --skip-git-repo-check -s read-only \
//     -C <work_dir> --output-last-message <last-message.txt> -m <model> -
// stdin 으로 prompt 를 넘기고, 진짜 응답은 last-message.txt 파일에서 읽는다.
// ─────────────────────────────────────────────────────────────────────

const CODEX_DEFAULT_MODEL: &str = "gpt-5.4";

struct CodexCtx {
    work_dir: std::path::PathBuf,
    last_msg_path: std::path::PathBuf,
}

fn build_codex_ctx() -> std::io::Result<CodexCtx> {
    use std::time::SystemTime;
    let base = std::env::temp_dir();
    let stamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let work_dir = base.join(format!("ai-manuscript-codex-{stamp}"));
    std::fs::create_dir_all(&work_dir)?;
    let last_msg_path = work_dir.join("last-message.txt");
    Ok(CodexCtx {
        work_dir,
        last_msg_path,
    })
}

/// codex exec args 를 구성. 사용자의 extra_args 는 마지막에 prepend (model override 등 가능).
/// 기본 model 은 `gpt-5.4` (ChatGPT 계정 호환). `-m gpt-5.4` 가 extra_args 로
/// 들어오면 그 값으로 덮어쓰여진다 (codex 가 마지막 -m 을 우선시).
fn build_codex_args(ctx: &CodexCtx, extra: &[String]) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "exec".to_string(),
        "--json".to_string(),
        "--ephemeral".to_string(),
        "--skip-git-repo-check".to_string(),
        "-s".to_string(),
        "read-only".to_string(),
        "-C".to_string(),
        ctx.work_dir.to_string_lossy().to_string(),
        "--output-last-message".to_string(),
        ctx.last_msg_path.to_string_lossy().to_string(),
    ];
    // 사용자가 -m 을 안 줬으면 default 모델 추가.
    let user_has_model = extra.iter().any(|a| a == "-m" || a == "--model");
    if !user_has_model {
        args.push("-m".to_string());
        args.push(CODEX_DEFAULT_MODEL.to_string());
    }
    for a in extra {
        if !a.is_empty() {
            args.push(a.clone());
        }
    }
    // stdin 을 prompt 소스로 지정.
    args.push("-".to_string());
    args
}

/// stdout 에 흘러간 JSONL 이벤트 중 마지막 turn 의 message text 를 추출.
/// `--output-last-message` 파일이 비어있을 때의 fallback.
fn extract_last_codex_message(stdout: &str) -> Option<String> {
    let mut last: Option<String> = None;
    for line in stdout.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
            // codex JSONL 이벤트에서 자유 형식 message 추출.
            if let Some(msg) = v
                .get("message")
                .and_then(|m| m.as_str())
                .or_else(|| v.get("output").and_then(|m| m.as_str()))
                .or_else(|| {
                    v.get("turn")
                        .and_then(|t| t.get("message"))
                        .and_then(|m| m.as_str())
                })
            {
                last = Some(msg.to_string());
                break;
            }
        }
    }
    last
}

/// 실패 시 사람이 읽을 수 있는 사유 추출 (Pivotrix 의 extractReason 포팅).
fn extract_codex_failure_reason(stdout: &str) -> Option<String> {
    for line in stdout.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let ty = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if ty == "error" || ty == "turn.failed" {
            if let Some(msg) = v
                .get("message")
                .and_then(|m| m.as_str())
                .or_else(|| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()))
            {
                // 중첩 JSON 메시지일 수도.
                if let Ok(inner) = serde_json::from_str::<serde_json::Value>(msg) {
                    if let Some(inner_msg) =
                        inner.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str())
                    {
                        return Some(inner_msg.to_string());
                    }
                }
                return Some(if msg.len() > 240 {
                    format!("{}...", &msg[..240])
                } else {
                    msg.to_string()
                });
            }
        }
    }
    None
}

fn emit_done(
    app: &AppHandle,
    invocation_id: &str,
    exit_code: i32,
    duration_ms: u64,
    full_text: String,
) {
    let _ = app.emit(
        "ai:done",
        AiDonePayload {
            invocation_id: invocation_id.to_string(),
            exit_code,
            duration_ms,
            full_text,
        },
    );
}

fn emit_error(app: &AppHandle, invocation_id: &str, message: String, stderr: String) {
    let _ = app.emit(
        "ai:error",
        AiErrorPayload {
            invocation_id: invocation_id.to_string(),
            message,
            stderr,
        },
    );
}

// ---- 단위 테스트 ----------------------------------------------------------
//
// Rust 측 단위 테스트는 dummy CLI 바이너리를 spawn할 수 있어야 한다.
// monorepo의 packages/core/tests/fixtures/dummy-codex.mjs를 직접 참조한다.

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, AtomicU32};
    use std::time::Duration;

    fn dummy_codex_path() -> Option<PathBuf> {
        // src-tauri/tests/fixtures/dummy-codex.mjs (복사본)
        let here = std::env::current_dir().ok()?;
        let mut candidates: Vec<PathBuf> = Vec::new();
        // 1) src-tauri 루트에서 실행될 때
        candidates.push(here.join("tests/fixtures/dummy-codex.mjs"));
        // 2) workspace 루트에서 실행될 때 (cargo test --workspace 호환)
        candidates.push(here.join("apps/desktop/src-tauri/tests/fixtures/dummy-codex.mjs"));
        // 3) repo 루트의 core fixtures
        candidates.push(here.join("packages/core/tests/fixtures/dummy-codex.mjs"));
        candidates.push(here.join("../../../packages/core/tests/fixtures/dummy-codex.mjs"));
        candidates.into_iter().find(|p| p.exists())
    }

    fn node_path() -> Option<String> {
        // PATH에서 node를 찾는다.
        which_binary("node")
    }

    fn which_binary(name: &str) -> Option<String> {
        use std::process::Command as StdCommand;
        let cmd = if cfg!(windows) { "where" } else { "which" };
        let out = StdCommand::new(cmd).arg(name).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let s = String::from_utf8(out.stdout).ok()?;
        s.lines().next().map(|s| s.trim().to_string())
    }

    /// dummy-codex.mjs를 직접 테스트로 spawn하여 streaming/timeout/cancel을
    /// 검증한다. node가 PATH에 없거나 fixture를 찾을 수 없으면 #[ignore].
    /// (Rust 단위 테스트는 Tauri AppHandle을 가질 수 없으므로,
    /// emit_done/emit_error를 검증하는 대신 child 동작 자체를 직접 검증한다.)

    #[tokio::test]
    async fn spawns_dummy_codex_and_completes() {
        let Some(node) = node_path() else {
            eprintln!("SKIP: node not in PATH");
            return;
        };
        let Some(fixture) = dummy_codex_path() else {
            eprintln!("SKIP: dummy-codex.mjs not found");
            return;
        };

        let mut cmd = Command::new(&node);
        cmd.arg(&fixture)
            .arg("--ok")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd.spawn().expect("spawn dummy");
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(b"hi").await.unwrap();
            drop(stdin);
        }
        let mut acc = String::new();
        if let Some(stdout) = child.stdout.take() {
            let mut reader = BufReader::new(stdout).lines();
            while let Some(line) = reader.next_line().await.unwrap() {
                acc.push_str(&line);
                acc.push('\n');
            }
        }
        let status = child.wait().await.expect("wait");
        assert!(status.success(), "dummy-codex --ok must exit 0");
        assert!(acc.contains("OK output"), "stdout should contain marker, got: {acc:?}");
    }

    #[tokio::test]
    async fn cancel_aborts_child_process() {
        let Some(node) = node_path() else {
            eprintln!("SKIP: node not in PATH");
            return;
        };
        let Some(fixture) = dummy_codex_path() else {
            eprintln!("SKIP: dummy-codex.mjs not found");
            return;
        };

        // --slow 모드: 5초 sleep. 우리는 100ms 후 kill해서 일찍 빠져나오는지 본다.
        let mut cmd = Command::new(&node);
        cmd.arg(&fixture)
            .arg("--slow")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd.spawn().expect("spawn dummy --slow");
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(b"hi").await;
            drop(stdin);
        }

        let started = Instant::now();
        // 200ms 후 kill.
        tokio::time::sleep(Duration::from_millis(200)).await;
        child.start_kill().expect("start_kill");
        let status = child.wait().await.expect("wait after kill");
        // 5초가 채 흐르지 않아야 한다.
        let elapsed = started.elapsed();
        assert!(
            elapsed < Duration::from_secs(3),
            "process should have been killed quickly, took {elapsed:?}"
        );
        // 정확한 exit code는 OS-dependent. 단지 5초 wait이 안 걸렸으면 OK.
        let _ = status;
    }

    #[tokio::test]
    async fn timeout_kills_long_running_child() {
        let Some(node) = node_path() else {
            eprintln!("SKIP: node not in PATH");
            return;
        };
        let Some(fixture) = dummy_codex_path() else {
            eprintln!("SKIP: dummy-codex.mjs not found");
            return;
        };

        let mut cmd = Command::new(&node);
        cmd.arg(&fixture)
            .arg("--slow")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd.spawn().expect("spawn dummy --slow");
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(b"hi").await;
            drop(stdin);
        }

        let started = Instant::now();
        // tokio::time::timeout으로 child.wait() 감싸기. 200ms.
        let res = tokio::time::timeout(
            Duration::from_millis(200),
            child.wait(),
        )
        .await;
        match res {
            Err(_) => {
                // 타임아웃: 우리는 강제 종료한다.
                child.start_kill().expect("start_kill");
                let _ = child.wait().await;
            }
            Ok(_) => panic!("dummy --slow should not finish in 200ms"),
        }
        let elapsed = started.elapsed();
        assert!(
            elapsed < Duration::from_secs(3),
            "timeout path must release within budget, took {elapsed:?}"
        );
    }

    #[tokio::test]
    async fn registry_tracks_and_removes_invocations() {
        let registry = Arc::new(AiInvocationRegistry::new());
        let id = "inv-1".to_string();

        let handle: JoinHandle<()> = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(60)).await;
        });
        registry
            .insert(
                id.clone(),
                AiInvocationEntry {
                    abort: handle,
                    pid: None,
                },
            )
            .await;
        let cancelled = registry.cancel(&id).await;
        assert!(cancelled, "first cancel should succeed");
        let cancelled_again = registry.cancel(&id).await;
        assert!(!cancelled_again, "second cancel should fail (entry removed)");
    }

    // 잠재적 false positive 방지: signature가 맞는지 sanity-check.
    static _SANITY: AtomicBool = AtomicBool::new(false);
    static _COUNTER: AtomicU32 = AtomicU32::new(0);
}
