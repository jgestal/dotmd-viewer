//! Moving things around: rename/move, trash, copy into a folder under a free name, and showing
//! an item in the system file manager. Error kinds match the in-memory FileSystem double.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{AppError, AppResult, ErrorKind};

fn require_existing(path: &Path) -> AppResult<()> {
    path.symlink_metadata()
        .map(drop)
        .map_err(|error| AppError::io(error, path))
}

fn require_folder(path: &Path) -> AppResult<()> {
    if path.is_dir() {
        Ok(())
    } else {
        Err(AppError::new(ErrorKind::NotFound, "No such folder").with_path(path))
    }
}

pub fn exists(path: &Path) -> bool {
    path.symlink_metadata().is_ok()
}

/// What `path` is on disk: `"file"` (anything that is not a folder), `"folder"` or `"missing"`.
/// Symlinks are followed, so a link to a folder is a folder.
pub fn kind(path: &Path) -> &'static str {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => "folder",
        Ok(_) => "file",
        Err(_) => "missing",
    }
}

/// True when both paths resolve to the same item, e.g. `a.md` and `A.md` on a case-insensitive disk.
fn is_same_item(a: &Path, b: &Path) -> bool {
    matches!((fs::canonicalize(a), fs::canonicalize(b)), (Ok(a), Ok(b)) if a == b)
}

/// Renames or moves a file or folder; never overwrites.
pub fn rename(from: &Path, to: &Path) -> AppResult<()> {
    require_existing(from)?;
    if exists(to) && !is_same_item(from, to) {
        return Err(AppError::new(ErrorKind::AlreadyExists, "Already exists").with_path(to));
    }
    if let Some(parent) = to.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        require_folder(parent)?;
    }
    match fs::rename(from, to) {
        Err(error) if error.kind() == io::ErrorKind::CrossesDevices => {
            move_across_devices(from, to)
        }
        result => result.map_err(|error| AppError::io(error, from)),
    }
}

fn move_across_devices(from: &Path, to: &Path) -> AppResult<()> {
    if from.is_dir() {
        return Err(AppError::new(
            ErrorKind::Unsupported,
            "Moving a folder to another drive is not supported",
        )
        .with_path(from));
    }
    fs::copy(from, to).map_err(|error| AppError::io(error, to))?;
    fs::remove_file(from).map_err(|error| AppError::io(error, from))
}

/// Sends a file or folder to the system trash / recycle bin.
pub fn trash(path: &Path) -> AppResult<()> {
    require_existing(path)?;
    ::trash::delete(path)
        .map_err(|error| AppError::new(ErrorKind::Io, error.to_string()).with_path(path))
}

/// First of `name`, `name-1`, `name-2`, … that does not exist in `directory`. The extension is
/// kept (`img-1.png`); a leading dot belongs to the stem (`.env-1`).
pub fn free_name(directory: &Path, file_name: &str, exists: impl Fn(&Path) -> bool) -> String {
    let (stem, extension) = match file_name.rfind('.') {
        Some(dot) if dot > 0 => file_name.split_at(dot),
        _ => (file_name, ""),
    };
    (0u32..)
        .map(|n| match n {
            0 => file_name.to_owned(),
            _ => format!("{stem}-{n}{extension}"),
        })
        .find(|candidate| !exists(&directory.join(candidate)))
        .expect("an unbounded sequence has a free name")
}

/// Copies a file into `directory` under a free name and returns the new path.
pub fn copy_file_into(source: &Path, directory: &Path) -> AppResult<PathBuf> {
    if !source.is_file() {
        return Err(AppError::new(ErrorKind::NotFound, "No such file").with_path(source));
    }
    require_folder(directory)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| AppError::invalid_input("Path has no file name").with_path(source))?
        .to_string_lossy();
    let target = directory.join(free_name(directory, &file_name, exists));
    fs::copy(source, &target).map_err(|error| AppError::io(error, &target))?;
    Ok(target)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    MacOs,
    Windows,
    Linux,
}

impl Platform {
    pub const CURRENT: Platform = if cfg!(target_os = "macos") {
        Platform::MacOs
    } else if cfg!(windows) {
        Platform::Windows
    } else {
        Platform::Linux
    };
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandLine {
    pub program: &'static str,
    pub args: Vec<String>,
}

fn command_line(program: &'static str, args: Vec<String>) -> CommandLine {
    CommandLine { program, args }
}

/// Percent-encodes a path for a `file://` URI, keeping `/` and the unreserved characters.
fn file_uri(path: &Path) -> String {
    let encoded: String = path
        .to_string_lossy()
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                char::from(byte).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect();
    format!("file://{encoded}")
}

/// The commands that show `path` in the file manager, in order of preference; the first one
/// that can be started wins.
pub fn reveal_commands(platform: Platform, path: &Path) -> Vec<CommandLine> {
    let text = path.to_string_lossy().into_owned();
    match platform {
        Platform::MacOs => vec![command_line("open", vec!["-R".into(), text])],
        Platform::Windows => vec![command_line("explorer", vec![format!("/select,{text}")])],
        Platform::Linux => {
            let parent = path.parent().unwrap_or(path).to_string_lossy().into_owned();
            vec![
                command_line(
                    "dbus-send",
                    vec![
                        "--session".into(),
                        "--dest=org.freedesktop.FileManager1".into(),
                        "--type=method_call".into(),
                        "/org/freedesktop/FileManager1".into(),
                        "org.freedesktop.FileManager1.ShowItems".into(),
                        format!("array:string:{}", file_uri(path)),
                        "string:".into(),
                    ],
                ),
                command_line("xdg-open", vec![parent]),
            ]
        }
    }
}

/// Shows the item in Finder / Explorer / the file manager without waiting for it.
pub fn reveal(path: &Path) -> AppResult<()> {
    require_existing(path)?;
    let mut last_error = None;
    for line in reveal_commands(Platform::CURRENT, path) {
        match Command::new(line.program).args(&line.args).spawn() {
            Ok(_) => return Ok(()),
            Err(error) => last_error = Some(error),
        }
    }
    let error = last_error.unwrap_or_else(|| io::Error::from(io::ErrorKind::Unsupported));
    Err(AppError::io(error, path))
}

#[tauri::command]
pub async fn path_exists(path: String) -> AppResult<bool> {
    Ok(exists(Path::new(&path)))
}

#[tauri::command]
pub async fn path_kind(path: String) -> AppResult<&'static str> {
    Ok(kind(Path::new(&path)))
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> AppResult<()> {
    rename(Path::new(&from), Path::new(&to))
}

#[tauri::command]
pub async fn trash_path(path: String) -> AppResult<()> {
    trash(Path::new(&path))
}

#[tauri::command]
pub async fn copy_into(source: String, directory: String) -> AppResult<String> {
    copy_file_into(Path::new(&source), Path::new(&directory))
        .map(|target| target.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn reveal_path(path: String) -> AppResult<()> {
    reveal(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use tempfile::TempDir;

    fn kind_of<T: std::fmt::Debug>(result: AppResult<T>) -> ErrorKind {
        result.unwrap_err().kind
    }

    #[test]
    fn exists_reports_files_folders_and_missing_paths() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "x").unwrap();
        assert!(exists(&file));
        assert!(exists(dir.path()));
        assert!(!exists(&dir.path().join("missing.md")));
    }

    #[test]
    fn kind_tells_files_folders_and_missing_paths_apart() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "x").unwrap();
        assert_eq!(kind(&file), "file");
        assert_eq!(kind(dir.path()), "folder");
        assert_eq!(kind(&dir.path().join("missing.md")), "missing");
    }

    #[test]
    fn rename_moves_a_file_within_a_folder() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        let to = dir.path().join("b.md");
        fs::write(&from, "text").unwrap();
        rename(&from, &to).unwrap();
        assert!(!from.exists());
        assert_eq!(fs::read_to_string(&to).unwrap(), "text");
    }

    #[test]
    fn rename_moves_a_file_to_another_folder() {
        let dir = TempDir::new().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        let from = dir.path().join("a.md");
        fs::write(&from, "text").unwrap();
        rename(&from, &sub.join("a.md")).unwrap();
        assert_eq!(fs::read_to_string(sub.join("a.md")).unwrap(), "text");
    }

    #[test]
    fn rename_moves_a_folder_with_its_content() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("docs");
        fs::create_dir_all(from.join("deep")).unwrap();
        fs::write(from.join("deep/n.md"), "n").unwrap();
        let to = dir.path().join("renamed");
        rename(&from, &to).unwrap();
        assert!(!from.exists());
        assert_eq!(fs::read_to_string(to.join("deep/n.md")).unwrap(), "n");
    }

    #[test]
    fn rename_refuses_to_overwrite_a_file() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        let to = dir.path().join("b.md");
        fs::write(&from, "a").unwrap();
        fs::write(&to, "b").unwrap();
        let error = rename(&from, &to).unwrap_err();
        assert_eq!(error.kind, ErrorKind::AlreadyExists);
        assert_eq!(error.path.as_deref(), to.to_str());
        assert_eq!(fs::read_to_string(&to).unwrap(), "b");
        assert_eq!(fs::read_to_string(&from).unwrap(), "a");
    }

    #[test]
    fn rename_refuses_to_overwrite_a_folder() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        let to = dir.path().join("folder");
        fs::write(&from, "a").unwrap();
        fs::create_dir(&to).unwrap();
        assert_eq!(kind_of(rename(&from, &to)), ErrorKind::AlreadyExists);
    }

    #[test]
    fn rename_reports_a_missing_source_as_not_found() {
        let dir = TempDir::new().unwrap();
        let result = rename(&dir.path().join("nope.md"), &dir.path().join("b.md"));
        assert_eq!(kind_of(result), ErrorKind::NotFound);
    }

    #[test]
    fn rename_reports_a_missing_target_folder_as_not_found() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        fs::write(&from, "a").unwrap();
        let result = rename(&from, &dir.path().join("missing/a.md"));
        assert_eq!(kind_of(result), ErrorKind::NotFound);
        assert!(from.exists());
    }

    #[test]
    fn rename_to_the_same_path_is_a_no_op() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        fs::write(&from, "a").unwrap();
        let result = rename(&from, &from);
        assert!(result.is_ok());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn rename_allows_a_case_only_change() {
        let dir = TempDir::new().unwrap();
        let from = dir.path().join("a.md");
        let to = dir.path().join("A.md");
        fs::write(&from, "a").unwrap();
        rename(&from, &to).unwrap();
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["A.md"]);
    }

    #[test]
    fn trash_reports_a_missing_path_as_not_found() {
        let dir = TempDir::new().unwrap();
        assert_eq!(
            kind_of(trash(&dir.path().join("nope.md"))),
            ErrorKind::NotFound
        );
    }

    #[test]
    fn free_name_keeps_the_name_when_it_is_free() {
        let name = free_name(Path::new("/d"), "img.png", |_| false);
        assert_eq!(name, "img.png");
    }

    #[test]
    fn free_name_counts_up_and_keeps_the_extension() {
        let taken: HashSet<PathBuf> = ["img.png", "img-1.png"]
            .iter()
            .map(|name| Path::new("/d").join(name))
            .collect();
        let name = free_name(Path::new("/d"), "img.png", |path| taken.contains(path));
        assert_eq!(name, "img-2.png");
    }

    #[test]
    fn free_name_handles_names_without_extension_and_dotfiles() {
        let always_first_taken =
            |name: &'static str| move |path: &Path| path == Path::new("/d").join(name);
        assert_eq!(
            free_name(Path::new("/d"), "README", always_first_taken("README")),
            "README-1"
        );
        assert_eq!(
            free_name(Path::new("/d"), ".env", always_first_taken(".env")),
            ".env-1"
        );
        assert_eq!(
            free_name(Path::new("/d"), "a.tar.gz", always_first_taken("a.tar.gz")),
            "a.tar-1.gz"
        );
    }

    #[test]
    fn copy_file_into_uses_free_names_in_sequence() {
        let dir = TempDir::new().unwrap();
        let source = dir.path().join("img.png");
        fs::write(&source, "pixels").unwrap();
        let target = dir.path().join("assets");
        fs::create_dir(&target).unwrap();

        let copies: Vec<_> = (0..3)
            .map(|_| copy_file_into(&source, &target).unwrap())
            .collect();

        assert_eq!(
            copies,
            [
                target.join("img.png"),
                target.join("img-1.png"),
                target.join("img-2.png")
            ]
        );
        assert_eq!(fs::read_to_string(&copies[2]).unwrap(), "pixels");
        assert!(source.exists());
    }

    #[test]
    fn copy_file_into_reports_a_missing_source_as_not_found() {
        let dir = TempDir::new().unwrap();
        let result = copy_file_into(&dir.path().join("nope.png"), dir.path());
        assert_eq!(kind_of(result), ErrorKind::NotFound);
    }

    #[test]
    fn copy_file_into_rejects_a_folder_as_source() {
        let dir = TempDir::new().unwrap();
        assert_eq!(
            kind_of(copy_file_into(dir.path(), dir.path())),
            ErrorKind::NotFound
        );
    }

    #[test]
    fn copy_file_into_reports_a_missing_directory_as_not_found() {
        let dir = TempDir::new().unwrap();
        let source = dir.path().join("img.png");
        fs::write(&source, "x").unwrap();
        let result = copy_file_into(&source, &dir.path().join("missing"));
        assert_eq!(kind_of(result), ErrorKind::NotFound);
    }

    #[test]
    fn reveal_reports_a_missing_path_as_not_found() {
        let dir = TempDir::new().unwrap();
        assert_eq!(
            kind_of(reveal(&dir.path().join("nope.md"))),
            ErrorKind::NotFound
        );
    }

    #[test]
    fn reveal_selects_the_item_in_finder_on_macos() {
        let lines = reveal_commands(Platform::MacOs, Path::new("/a/b c.md"));
        assert_eq!(
            lines,
            [command_line("open", vec!["-R".into(), "/a/b c.md".into()])]
        );
    }

    #[test]
    fn reveal_selects_the_item_in_explorer_on_windows() {
        let lines = reveal_commands(Platform::Windows, Path::new(r"C:\a\b c.md"));
        assert_eq!(
            lines,
            [command_line(
                "explorer",
                vec![r"/select,C:\a\b c.md".into()]
            )]
        );
    }

    #[test]
    fn reveal_tries_the_file_manager_service_then_opens_the_parent_on_linux() {
        let lines = reveal_commands(Platform::Linux, Path::new("/a/b c.md"));
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].program, "dbus-send");
        assert!(
            lines[0]
                .args
                .contains(&"array:string:file:///a/b%20c.md".to_string())
        );
        assert_eq!(lines[1], command_line("xdg-open", vec!["/a".into()]));
    }

    #[test]
    fn file_uri_encodes_unicode_and_reserved_characters() {
        assert_eq!(file_uri(Path::new("/a/é#.md")), "file:///a/%C3%A9%23.md");
    }
}
