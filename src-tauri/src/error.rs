//! The one error type every command returns. It reaches the frontend as
//! `{ "kind": "notFound", "message": "…", "path": "…" }`, so the TypeScript side can match on
//! `kind` and show `message` without parsing strings.

use std::io;
use std::path::Path;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    NotFound,
    PermissionDenied,
    AlreadyExists,
    InvalidInput,
    Unsupported,
    Io,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            path: None,
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InvalidInput, message)
    }

    pub fn with_path(mut self, path: &Path) -> Self {
        self.path = Some(path.to_string_lossy().into_owned());
        self
    }

    /// Wraps an I/O error and records the path it happened on.
    pub fn io(error: io::Error, path: &Path) -> Self {
        Self::from(error).with_path(path)
    }
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        let kind = match error.kind() {
            io::ErrorKind::NotFound => ErrorKind::NotFound,
            io::ErrorKind::PermissionDenied => ErrorKind::PermissionDenied,
            io::ErrorKind::AlreadyExists => ErrorKind::AlreadyExists,
            io::ErrorKind::InvalidInput | io::ErrorKind::InvalidData => ErrorKind::InvalidInput,
            io::ErrorKind::Unsupported => ErrorKind::Unsupported,
            _ => ErrorKind::Io,
        };
        Self::new(kind, error.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.path {
            Some(path) => write!(f, "{}: {}", self.message, path),
            None => f.write_str(&self.message),
        }
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_io_error_kinds() {
        let cases = [
            (io::ErrorKind::NotFound, ErrorKind::NotFound),
            (io::ErrorKind::PermissionDenied, ErrorKind::PermissionDenied),
            (io::ErrorKind::AlreadyExists, ErrorKind::AlreadyExists),
            (io::ErrorKind::InvalidInput, ErrorKind::InvalidInput),
            (io::ErrorKind::InvalidData, ErrorKind::InvalidInput),
            (io::ErrorKind::Unsupported, ErrorKind::Unsupported),
            (io::ErrorKind::Interrupted, ErrorKind::Io),
        ];
        for (io_kind, expected) in cases {
            assert_eq!(
                AppError::from(io::Error::new(io_kind, "boom")).kind,
                expected
            );
        }
    }

    #[test]
    fn records_the_path() {
        let error = AppError::io(
            io::Error::from(io::ErrorKind::NotFound),
            Path::new("/a/b.md"),
        );
        assert_eq!(error.path.as_deref(), Some("/a/b.md"));
        assert!(error.to_string().ends_with(": /a/b.md"));
    }

    #[test]
    fn serialises_for_the_frontend() {
        let json = serde_json::to_value(AppError::invalid_input("bad")).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "kind": "invalidInput", "message": "bad" })
        );

        let with_path = AppError::invalid_input("bad").with_path(Path::new("x.md"));
        assert_eq!(serde_json::to_value(with_path).unwrap()["path"], "x.md");
    }

    #[test]
    fn displays_the_message_alone_without_a_path() {
        assert_eq!(AppError::invalid_input("bad").to_string(), "bad");
    }
}
