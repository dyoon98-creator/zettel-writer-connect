// 타입 에러 — 명령에서 반환되어 프론트로 직렬화된다.

use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("path is not utf-8")]
    NonUtf8Path,

    #[error("watcher error: {0}")]
    Watcher(String),

    #[error("watcher not found: {0}")]
    WatcherNotFound(u64),

    #[error("invalid argument: {0}")]
    Invalid(String),

    #[error("internal error: {0}")]
    Other(String),
}

impl AppError {
    pub fn other<E: std::fmt::Display>(e: E) -> Self {
        AppError::Other(e.to_string())
    }
}

// Tauri는 명령 에러를 Serialize 가능해야 한다.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = std::result::Result<T, AppError>;
