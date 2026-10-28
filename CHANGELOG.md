# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Outline tab: headings of the document nested by level, click or Enter reveals the heading through a navigation channel (`navigation.revealLine` / `topLine`), and the visible section is highlighted (#26).
- Explorer tab: lazy-loaded folder tree with arrow-key navigation, Enter/Space to open, the open document highlighted and revealed, and expanded folders remembered for the session; `browse` use case that reports unreadable folders (#24).
- App shell: resizable sidebar with Explorer/Favourites/Outline tabs, viewport header with Edit toggle and mode/layout switches, status bar, welcome screen with recents, toasts, light/dark theme following the system (#23, #28).

- i18n infrastructure: English and Spanish dictionaries, pure translator with system-language detection, and a reactive `i18n` store that switches language live

- Command registry: command ids, per-OS accelerators (`Mod+Shift+S` syntax with matching, display and Tauri formatting) and enable/check state
- `watch_file` command: watches the open file and emits a debounced `file-changed` event when it is modified, replaced or removed
- File commands `path_exists`, `rename_path`, `trash_path`, `copy_into` and `reveal_path`: rename/move without overwriting, system trash, copy under a free name, reveal in the file manager
- Tauri adapters for every port, `set_document_state` (macOS proxy icon and edited dot), `load_preferences`/`save_preferences`, and `createContainer` as the single wiring point (Tauri or in-memory)
- Document use cases (open, save, save as, new, close, quit confirmation, external reload) tested with the in-memory doubles
- Application use cases for preferences (load, save, update) and workspace (folder, favourites, recents, rename, move, trash)
- `render_markdown` command: GFM, footnotes, alerts, highlight, front matter, math markup for KaTeX and `data-sourcepos` via comrak
- Project scaffold (Tauri 2 + SvelteKit)
- CI workflow: lint, typecheck, tests and build on macOS, Windows and Linux
- Initial documentation: README, LICENSE, CHANGELOG, CONTRIBUTING and ARCHITECTURE
- Slide splitting by top-level `---` (code blocks and front matter aware) and `slideAtLine`
- Document statistics (words, characters, lines, reading time) ignoring Markdown syntax, front matter and code
- Pure workspace rules (open folder, favourites, rename and delete tracking) and path helpers
- Recent files list and validated user preferences (domain)
- Document entity: content, path, dirty flag, preserved line ending, encoding and BOM, with pure edit/save/reload operations
- Document outline domain rule: headings with level, text, GitHub-style slug and source line
- `read_file` / `write_file` commands: UTF-8, UTF-16 (BOM) and windows-1252 detection, binary refusal and atomic saves
- App icons for macOS (.icns), Windows (.ico), Linux (PNG) and the favicon, generated from the rendered icon
- `list_dir` command: one-level folder listing (documents and folders only, no hidden entries, natural sort, `hasChildren` for folders)
- Mutation testing with StrykerJS (`npm run test:mutation`) and cargo-mutants (`npm run test:mutation:rust`), with a manual workflow
- In-memory test doubles for every port (`createMemoryServices()`) and a reusable `FileSystem` contract suite

[Unreleased]: https://github.com/jgestal/dotmd-viewer/commits/main
