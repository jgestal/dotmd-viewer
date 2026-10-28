//! Folder listing for the sidebar tree: one level at a time, only what the viewer can show.

use std::fs::{self, DirEntry};
use std::io;
use std::path::Path;

use serde::Serialize;
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

use crate::error::{AppError, AppResult};

const DOCUMENT_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
const IGNORED_FOLDERS: [&str; 1] = ["node_modules"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    // Declared first so folders sort before files.
    Folder,
    File,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    /// Only for folders: whether it holds at least one visible document or subfolder.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_children: Option<bool>,
}

/// Lists the visible documents and folders directly inside `dir`, folders first, in natural order.
pub fn list_entries(dir: &Path) -> AppResult<Vec<Entry>> {
    let reader = fs::read_dir(dir).map_err(|error| read_dir_error(error, dir))?;
    let mut entries: Vec<Entry> = reader
        .filter_map(Result::ok)
        .filter_map(|dir_entry| to_entry(&dir_entry))
        .collect();
    entries.sort_by_cached_key(|entry| (entry.kind, natural_key(&entry.name), entry.name.clone()));
    Ok(entries)
}

fn read_dir_error(error: io::Error, dir: &Path) -> AppError {
    // Listing a regular file fails with a platform-specific kind; report it as bad input.
    if dir.is_file() {
        return AppError::invalid_input("Not a directory").with_path(dir);
    }
    AppError::io(error, dir)
}

fn to_entry(dir_entry: &DirEntry) -> Option<Entry> {
    let kind = visible_kind(dir_entry)?;
    let path = dir_entry.path();
    let has_children = (kind == EntryKind::Folder).then(|| has_visible_children(&path));
    Some(Entry {
        name: dir_entry.file_name().to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
        kind,
        has_children,
    })
}

/// The kind of a visible entry, or `None` if it is hidden, unsupported or cannot be read.
/// Symlinks are followed, so a broken link has no kind and is skipped.
fn visible_kind(dir_entry: &DirEntry) -> Option<EntryKind> {
    let name = dir_entry.file_name();
    let name = name.to_string_lossy();
    if name.starts_with('.') || is_hidden_by_system(dir_entry) {
        return None;
    }
    let file_type = fs::metadata(dir_entry.path()).ok()?.file_type();
    if file_type.is_dir() {
        (!IGNORED_FOLDERS.contains(&name.as_ref())).then_some(EntryKind::Folder)
    } else if file_type.is_file() {
        has_document_extension(&name).then_some(EntryKind::File)
    } else {
        None
    }
}

fn has_document_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            DOCUMENT_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
}

#[cfg(windows)]
fn is_hidden_by_system(dir_entry: &DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    dir_entry
        .metadata()
        .is_ok_and(|metadata| metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0)
}

#[cfg(not(windows))]
fn is_hidden_by_system(_dir_entry: &DirEntry) -> bool {
    false
}

/// Cheap check that stops at the first visible document or subfolder.
fn has_visible_children(dir: &Path) -> bool {
    fs::read_dir(dir).is_ok_and(|reader| {
        reader
            .filter_map(Result::ok)
            .any(|dir_entry| visible_kind(&dir_entry).is_some())
    })
}

/// One run of a name: digits compare by value, text compares as folded text.
#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Chunk {
    // (digit count without leading zeros, digits): longer numbers are bigger.
    Number(usize, String),
    Text(String),
}

fn natural_key(name: &str) -> Vec<Chunk> {
    let folded: String = name
        .nfd()
        .filter(|character| !is_combining_mark(*character))
        .flat_map(char::to_lowercase)
        .collect();
    let mut chunks = Vec::new();
    let mut rest = folded.as_str();
    while let Some(first) = rest.chars().next() {
        let is_digit = first.is_ascii_digit();
        let end = rest
            .find(|character: char| character.is_ascii_digit() != is_digit)
            .unwrap_or(rest.len());
        let (run, tail) = rest.split_at(end);
        chunks.push(if is_digit {
            let digits = run.trim_start_matches('0');
            Chunk::Number(digits.len(), digits.to_owned())
        } else {
            Chunk::Text(run.to_owned())
        });
        rest = tail;
    }
    chunks
}

#[tauri::command]
pub async fn list_dir(path: String) -> AppResult<Vec<Entry>> {
    list_entries(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorKind;
    use tempfile::TempDir;

    fn touch(dir: &TempDir, relative: &str) {
        let path = dir.path().join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    fn mkdir(dir: &TempDir, relative: &str) {
        fs::create_dir_all(dir.path().join(relative)).unwrap();
    }

    fn names(dir: &TempDir) -> Vec<String> {
        list_entries(dir.path())
            .unwrap()
            .into_iter()
            .map(|entry| entry.name)
            .collect()
    }

    fn first_has_children(dir: &TempDir) -> Option<bool> {
        list_entries(dir.path()).unwrap()[0].has_children
    }

    #[test]
    fn keeps_only_documents_and_folders() {
        let dir = TempDir::new().unwrap();
        for file in ["a.md", "b.markdown", "c.txt", "d.png", "e.rs", "noext"] {
            touch(&dir, file);
        }
        mkdir(&dir, "sub");
        assert_eq!(names(&dir), ["sub", "a.md", "b.markdown", "c.txt"]);
    }

    #[test]
    fn accepts_extensions_in_any_case() {
        let dir = TempDir::new().unwrap();
        for file in ["a.MD", "b.Markdown", "c.TXT"] {
            touch(&dir, file);
        }
        assert_eq!(names(&dir), ["a.MD", "b.Markdown", "c.TXT"]);
    }

    #[test]
    fn skips_hidden_entries_and_node_modules() {
        let dir = TempDir::new().unwrap();
        touch(&dir, ".secret.md");
        mkdir(&dir, ".git");
        mkdir(&dir, "node_modules");
        touch(&dir, "visible.md");
        assert_eq!(names(&dir), ["visible.md"]);
    }

    #[test]
    fn reports_name_path_and_kind() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "a.md");
        mkdir(&dir, "sub");
        assert_eq!(
            list_entries(dir.path()).unwrap(),
            [
                Entry {
                    name: "sub".into(),
                    path: dir.path().join("sub").to_string_lossy().into_owned(),
                    kind: EntryKind::Folder,
                    has_children: Some(false),
                },
                Entry {
                    name: "a.md".into(),
                    path: dir.path().join("a.md").to_string_lossy().into_owned(),
                    kind: EntryKind::File,
                    has_children: None,
                },
            ]
        );
    }

    #[test]
    fn serialises_in_camel_case_without_has_children_for_files() {
        let file = Entry {
            name: "a.md".into(),
            path: "/a.md".into(),
            kind: EntryKind::File,
            has_children: None,
        };
        let folder = Entry {
            kind: EntryKind::Folder,
            has_children: Some(true),
            ..file.clone()
        };
        assert_eq!(
            serde_json::to_value(file).unwrap(),
            serde_json::json!({ "name": "a.md", "path": "/a.md", "kind": "file" })
        );
        assert_eq!(
            serde_json::to_value(folder).unwrap(),
            serde_json::json!({
                "name": "a.md", "path": "/a.md", "kind": "folder", "hasChildren": true
            })
        );
    }

    #[test]
    fn folder_with_a_document_has_children() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "docs/readme.md");
        assert_eq!(first_has_children(&dir), Some(true));
    }

    #[test]
    fn folder_with_a_subfolder_has_children() {
        let dir = TempDir::new().unwrap();
        mkdir(&dir, "docs/inner");
        assert_eq!(first_has_children(&dir), Some(true));
    }

    #[test]
    fn folder_with_only_other_files_has_no_children() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "images/logo.png");
        touch(&dir, "images/.hidden.md");
        mkdir(&dir, "images/.git");
        mkdir(&dir, "images/node_modules");
        assert_eq!(first_has_children(&dir), Some(false));
    }

    #[test]
    fn empty_folder_has_no_children() {
        let dir = TempDir::new().unwrap();
        mkdir(&dir, "empty");
        assert_eq!(first_has_children(&dir), Some(false));
    }

    #[test]
    fn lists_only_one_level() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "a/b/deep.md");
        assert_eq!(names(&dir), ["a"]);
    }

    #[test]
    fn puts_folders_before_files() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "a.md");
        mkdir(&dir, "z");
        assert_eq!(names(&dir), ["z", "a.md"]);
    }

    #[test]
    fn sorts_numbers_by_value() {
        let dir = TempDir::new().unwrap();
        for file in ["file10.md", "file2.md", "file1.md", "file02.md"] {
            touch(&dir, file);
        }
        assert_eq!(
            names(&dir),
            ["file1.md", "file02.md", "file2.md", "file10.md"]
        );
    }

    #[test]
    fn sorts_ignoring_case() {
        let dir = TempDir::new().unwrap();
        for file in ["b.md", "A.md", "C.md"] {
            touch(&dir, file);
        }
        assert_eq!(names(&dir), ["A.md", "b.md", "C.md"]);
    }

    #[test]
    fn sorts_accented_names_next_to_their_plain_form() {
        let dir = TempDir::new().unwrap();
        for file in ["arbol.md", "Árbol.md", "azul.md", "zeta.md"] {
            touch(&dir, file);
        }
        assert_eq!(names(&dir), ["arbol.md", "Árbol.md", "azul.md", "zeta.md"]);
    }

    #[test]
    fn natural_key_compares_digit_runs_by_value() {
        assert!(natural_key("a9") < natural_key("a10"));
        assert!(natural_key("a007") == natural_key("a7"));
        assert!(natural_key("a") < natural_key("a1"));
    }

    #[test]
    fn missing_directory_is_not_found() {
        let dir = TempDir::new().unwrap();
        let error = list_entries(&dir.path().join("nope")).unwrap_err();
        assert_eq!(error.kind, ErrorKind::NotFound);
    }

    #[test]
    fn a_file_instead_of_a_directory_is_invalid_input() {
        let dir = TempDir::new().unwrap();
        touch(&dir, "a.md");
        let error = list_entries(&dir.path().join("a.md")).unwrap_err();
        assert_eq!(error.kind, ErrorKind::InvalidInput);
    }

    #[cfg(unix)]
    mod symlinks {
        use super::*;
        use std::os::unix::fs::symlink;

        #[test]
        fn follows_links_to_files_and_folders_and_skips_broken_ones() {
            let dir = TempDir::new().unwrap();
            touch(&dir, "real.md");
            touch(&dir, "target/inner.md");
            symlink(dir.path().join("real.md"), dir.path().join("link.md")).unwrap();
            symlink(dir.path().join("target"), dir.path().join("linked")).unwrap();
            symlink(dir.path().join("gone.md"), dir.path().join("broken.md")).unwrap();

            let entries = list_entries(dir.path()).unwrap();
            let summary: Vec<_> = entries
                .iter()
                .map(|entry| (entry.name.as_str(), entry.kind, entry.has_children))
                .collect();
            assert_eq!(
                summary,
                [
                    ("linked", EntryKind::Folder, Some(true)),
                    ("target", EntryKind::Folder, Some(true)),
                    ("link.md", EntryKind::File, None),
                    ("real.md", EntryKind::File, None),
                ]
            );
        }
    }
}
