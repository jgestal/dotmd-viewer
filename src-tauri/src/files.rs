//! Reading and writing text files with the encodings a Markdown file is likely to have, and
//! saving them atomically. Line endings are the frontend's job and are never touched here.

use std::fs;
use std::io::Write;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use encoding_rs::{UTF_16BE, UTF_16LE, WINDOWS_1252};
use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

use crate::error::{AppError, AppResult, ErrorKind};

const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];
const UTF16LE_BOM: [u8; 2] = [0xFF, 0xFE];
const UTF16BE_BOM: [u8; 2] = [0xFE, 0xFF];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Encoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-16le")]
    Utf16Le,
    #[serde(rename = "utf-16be")]
    Utf16Be,
    #[serde(rename = "windows-1252")]
    Windows1252,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile {
    pub content: String,
    pub encoding: Encoding,
    pub has_bom: bool,
}

fn text_file(content: String, encoding: Encoding, has_bom: bool) -> TextFile {
    TextFile {
        content,
        encoding,
        has_bom,
    }
}

fn binary_error(path: &Path) -> AppError {
    AppError::new(
        ErrorKind::Unsupported,
        "This looks like a binary file, not a text file",
    )
    .with_path(path)
}

fn decode_utf16(bytes: &[u8], encoding: Encoding, path: &Path) -> AppResult<TextFile> {
    let decoder = if encoding == Encoding::Utf16Le {
        UTF_16LE
    } else {
        UTF_16BE
    };
    let content = decoder
        .decode_without_bom_handling_and_without_replacement(bytes)
        .ok_or_else(|| AppError::invalid_input("Invalid UTF-16 data").with_path(path))?;
    Ok(text_file(content.into_owned(), encoding, true))
}

fn decode_8bit(bytes: &[u8], path: &Path) -> AppResult<TextFile> {
    let (body, has_bom) = match bytes.strip_prefix(&UTF8_BOM) {
        Some(rest) => (rest, true),
        None => (bytes, false),
    };
    let file = match std::str::from_utf8(body) {
        Ok(text) => text_file(text.to_owned(), Encoding::Utf8, has_bom),
        Err(_) => {
            let (text, _) = WINDOWS_1252.decode_without_bom_handling(bytes);
            text_file(text.into_owned(), Encoding::Windows1252, false)
        }
    };
    if file.content.contains('\0') {
        return Err(binary_error(path));
    }
    Ok(file)
}

fn decode(bytes: &[u8], path: &Path) -> AppResult<TextFile> {
    if let Some(rest) = bytes.strip_prefix(&UTF16LE_BOM) {
        decode_utf16(rest, Encoding::Utf16Le, path)
    } else if let Some(rest) = bytes.strip_prefix(&UTF16BE_BOM) {
        decode_utf16(rest, Encoding::Utf16Be, path)
    } else {
        decode_8bit(bytes, path)
    }
}

pub fn read_text(path: &Path) -> AppResult<TextFile> {
    let size = fs::metadata(path)
        .map_err(|error| AppError::io(error, path))?
        .len();
    if size > MAX_FILE_BYTES {
        return Err(
            AppError::new(ErrorKind::Unsupported, "The file is larger than 20 MB").with_path(path),
        );
    }
    let bytes = fs::read(path).map_err(|error| AppError::io(error, path))?;
    decode(&bytes, path)
}

/// The file's bytes as standard base64, or `None` when it is larger than `max_bytes`: an image
/// is embedded in an exported page, so a huge one is left out rather than read.
pub fn read_base64(path: &Path, max_bytes: u64) -> AppResult<Option<String>> {
    let size = fs::metadata(path)
        .map_err(|error| AppError::io(error, path))?
        .len();
    if size > max_bytes {
        return Ok(None);
    }
    let bytes = fs::read(path).map_err(|error| AppError::io(error, path))?;
    Ok(Some(STANDARD.encode(bytes)))
}

fn encode_utf16(content: &str, to_bytes: fn(u16) -> [u8; 2]) -> Vec<u8> {
    content.encode_utf16().flat_map(to_bytes).collect()
}

fn encode_windows_1252(content: &str) -> AppResult<Vec<u8>> {
    let (bytes, _, had_unmappable) = WINDOWS_1252.encode(content);
    if had_unmappable {
        let offender = content
            .chars()
            .find(|c| WINDOWS_1252.encode(c.encode_utf8(&mut [0; 4])).2)
            .unwrap_or('?');
        return Err(AppError::invalid_input(format!(
            "The character '{offender}' cannot be saved as windows-1252"
        )));
    }
    Ok(bytes.into_owned())
}

fn encode(content: &str, encoding: Encoding, has_bom: bool) -> AppResult<Vec<u8>> {
    let (bom, body): (&[u8], Vec<u8>) = match encoding {
        Encoding::Utf8 => (&UTF8_BOM, content.as_bytes().to_vec()),
        Encoding::Utf16Le => (&UTF16LE_BOM, encode_utf16(content, u16::to_le_bytes)),
        Encoding::Utf16Be => (&UTF16BE_BOM, encode_utf16(content, u16::to_be_bytes)),
        Encoding::Windows1252 => (&[], encode_windows_1252(content)?),
    };
    // UTF-16 without a BOM could not be read back, so it always gets one.
    let write_bom = has_bom || matches!(encoding, Encoding::Utf16Le | Encoding::Utf16Be);
    Ok(if write_bom {
        [bom, &body].concat()
    } else {
        body
    })
}

#[cfg(unix)]
fn keep_permissions(path: &Path, temp: &NamedTempFile) -> AppResult<()> {
    if let Ok(metadata) = fs::metadata(path) {
        temp.as_file()
            .set_permissions(metadata.permissions())
            .map_err(|error| AppError::io(error, path))?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn keep_permissions(_path: &Path, _temp: &NamedTempFile) -> AppResult<()> {
    Ok(())
}

pub fn write_atomically(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let directory = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    };
    let io_error = |error| AppError::io(error, path);
    let mut temp = NamedTempFile::new_in(directory).map_err(io_error)?;
    temp.write_all(bytes).map_err(io_error)?;
    temp.as_file().sync_all().map_err(io_error)?;
    keep_permissions(path, &temp)?;
    temp.persist(path).map_err(|error| io_error(error.error))?;
    Ok(())
}

pub fn write_text(path: &Path, content: &str, encoding: Encoding, has_bom: bool) -> AppResult<()> {
    let bytes = encode(content, encoding, has_bom).map_err(|error| error.with_path(path))?;
    write_atomically(path, &bytes)
}

#[tauri::command]
pub async fn read_file(path: String) -> AppResult<TextFile> {
    read_text(Path::new(&path))
}

#[tauri::command]
pub async fn read_file_base64(path: String, max_bytes: u64) -> AppResult<Option<String>> {
    read_base64(Path::new(&path), max_bytes)
}

#[tauri::command]
pub async fn write_file(
    path: String,
    content: String,
    encoding: Encoding,
    has_bom: bool,
) -> AppResult<()> {
    write_text(Path::new(&path), &content, encoding, has_bom)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn file_with(dir: &TempDir, bytes: &[u8]) -> std::path::PathBuf {
        let path = dir.path().join("note.md");
        fs::write(&path, bytes).unwrap();
        path
    }

    fn round_trip(content: &str, encoding: Encoding, has_bom: bool) -> TextFile {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("note.md");
        write_text(&path, content, encoding, has_bom).unwrap();
        read_text(&path).unwrap()
    }

    #[test]
    fn utf8_round_trips_with_and_without_bom() {
        for has_bom in [false, true] {
            let file = round_trip("# Título ✓\n", Encoding::Utf8, has_bom);
            assert_eq!(
                file,
                text_file("# Título ✓\n".into(), Encoding::Utf8, has_bom)
            );
        }
    }

    #[test]
    fn utf16_round_trips_for_both_byte_orders() {
        for encoding in [Encoding::Utf16Le, Encoding::Utf16Be] {
            let file = round_trip("héllo 😀\r\n", encoding, true);
            assert_eq!(file, text_file("héllo 😀\r\n".into(), encoding, true));
        }
    }

    #[test]
    fn utf16_is_always_written_with_a_bom() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a.md");
        write_text(&path, "a", Encoding::Utf16Le, false).unwrap();
        assert_eq!(fs::read(&path).unwrap(), [0xFF, 0xFE, b'a', 0]);
        write_text(&path, "a", Encoding::Utf16Be, false).unwrap();
        assert_eq!(fs::read(&path).unwrap(), [0xFE, 0xFF, 0, b'a']);
    }

    #[test]
    fn windows_1252_round_trips_accents() {
        let file = round_trip("ñandú café €", Encoding::Windows1252, false);
        assert_eq!(
            file,
            text_file("ñandú café €".into(), Encoding::Windows1252, false)
        );
    }

    #[test]
    fn windows_1252_ignores_the_bom_flag() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a.md");
        write_text(&path, "é", Encoding::Windows1252, true).unwrap();
        assert_eq!(fs::read(&path).unwrap(), [0xE9]);
    }

    #[test]
    fn invalid_utf8_falls_back_to_windows_1252() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, &[0xF1, b'a', 0xE9]);
        assert_eq!(
            read_text(&path).unwrap(),
            text_file("ñaé".into(), Encoding::Windows1252, false)
        );
    }

    #[test]
    fn utf8_bom_is_stripped_and_reported() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, &[0xEF, 0xBB, 0xBF, b'h', b'i']);
        assert_eq!(
            read_text(&path).unwrap(),
            text_file("hi".into(), Encoding::Utf8, true)
        );
    }

    #[test]
    fn read_base64_encodes_the_bytes() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, &[0, 1, 2, 255]);
        assert_eq!(read_base64(&path, 10).unwrap(), Some("AAEC/w==".into()));
    }

    #[test]
    fn read_base64_accepts_a_file_exactly_at_the_limit() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, b"abc");
        assert_eq!(read_base64(&path, 3).unwrap(), Some("YWJj".into()));
    }

    #[test]
    fn read_base64_skips_a_file_over_the_limit() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, b"abcd");
        assert_eq!(read_base64(&path, 3).unwrap(), None);
    }

    #[test]
    fn read_base64_reports_a_missing_file_with_its_path() {
        let dir = TempDir::new().unwrap();
        let error = read_base64(&dir.path().join("none.png"), 10).unwrap_err();
        assert_eq!(error.kind, ErrorKind::NotFound);
    }

    #[test]
    fn nul_bytes_mean_a_binary_file() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, b"ab\0cd");
        assert_eq!(read_text(&path).unwrap_err().kind, ErrorKind::Unsupported);
    }

    #[test]
    fn files_over_the_size_limit_are_refused() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("big.md");
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_FILE_BYTES + 1)
            .unwrap();
        let error = read_text(&path).unwrap_err();
        assert_eq!(error.kind, ErrorKind::Unsupported);
        assert!(error.message.contains("20 MB"));
    }

    #[test]
    fn invalid_utf16_is_reported() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, &[0xFF, 0xFE, 0x00, 0xD8]);
        assert_eq!(read_text(&path).unwrap_err().kind, ErrorKind::InvalidInput);
    }

    #[test]
    fn missing_file_is_not_found_with_its_path() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("missing.md");
        let error = read_text(&path).unwrap_err();
        assert_eq!(error.kind, ErrorKind::NotFound);
        assert_eq!(error.path.as_deref(), Some(path.to_str().unwrap()));
    }

    #[test]
    fn unencodable_character_is_reported_instead_of_replaced() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a.md");
        let error = write_text(&path, "ok é 😀 ✓", Encoding::Windows1252, false).unwrap_err();
        assert_eq!(error.kind, ErrorKind::InvalidInput);
        assert!(error.message.contains('😀'));
        assert!(!path.exists());
    }

    #[test]
    fn write_into_missing_directory_is_not_found() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nope").join("a.md");
        let error = write_text(&path, "x", Encoding::Utf8, false).unwrap_err();
        assert_eq!(error.kind, ErrorKind::NotFound);
    }

    #[test]
    fn write_replaces_existing_content() {
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, b"old old old");
        write_text(&path, "new", Encoding::Utf8, false).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
    }

    #[test]
    fn write_leaves_no_temp_files_behind() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a.md");
        write_text(&path, "x", Encoding::Utf8, false).unwrap();
        let _ = write_text(&path, "😀", Encoding::Windows1252, false);
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["a.md"]);
    }

    #[cfg(unix)]
    #[test]
    fn write_keeps_the_permissions_of_the_existing_file() {
        use std::os::unix::fs::PermissionsExt;
        let dir = TempDir::new().unwrap();
        let path = file_with(&dir, b"old");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap();
        write_text(&path, "new", Encoding::Utf8, false).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o640);
    }

    #[test]
    fn encoding_serialises_to_the_names_the_frontend_uses() {
        let names = [
            Encoding::Utf8,
            Encoding::Utf16Le,
            Encoding::Utf16Be,
            Encoding::Windows1252,
        ]
        .map(|encoding| serde_json::to_value(encoding).unwrap());
        assert_eq!(
            names,
            ["utf-8", "utf-16le", "utf-16be", "windows-1252"].map(serde_json::Value::from)
        );
    }
}
