# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Native menus with each platform's conventions: macOS app and Window menus; menu bar in the window with Alt mnemonics on Windows and Linux; Settings, Quit/Exit and About where each desktop expects them; `*name - DotMD Viewer` titles on Windows/Linux; F11 full screen; Open Recent and Clear Recents (#38, #91). See docs/platforms.md.
- Code editor: CodeMirror 6 with Markdown highlighting (code block languages loaded lazily), undo/redo, find and replace (`Mod+F`, `Mod+Alt+F`) with a translated panel, soft wrapping, bracket matching and pairing, themed from the app tokens; syncs with the document and honours the navigation channel (#31).
- Drag and drop: a Markdown file dropped on the window opens, a folder loads into the Explorer, a translucent overlay shows whether the drop will be accepted, and unsupported types or skipped extras are reported; `FileSystem.kind` (`path_kind` command) decides file or folder (#41).
- Context menu in the Explorer and Favourites: open, rename in place (F2), move to trash, show in Finder / Explorer / File Manager, copy path and add/remove favourite, with the context-menu key and Shift+F10; native menu through a `ContextMenu` port and an in-app fallback in browser mode; the open document follows a rename (#39).
- Pages layout: A4 / Letter sheets with 20 mm margins on a grey desk, page numbers, headings kept with the next block, `\pagebreak` manual breaks, automatic fit-to-width zoom times the user zoom, and a floating A4/Letter switch; the render pipeline is shared with the continuous view (#34).
- Slides layout: 16:9 stage scaled to fit, arrows/space/Home/End navigation, "n / total" counter, full-screen Present mode with auto-hiding cursor, current slide remembered per document (#35).
- Preview: sanitised (DOMPurify) continuous rendering with KaTeX, highlight.js, lazy Mermaid, internal anchors, external links in the browser and links to other `.md` files in the app; browser-mode markdown-it renderer; document typography with light/dark and alerts (#29).
- Outline tab: headings of the document nested by level, click or Enter reveals the heading through a navigation channel (`navigation.revealLine` / `topLine`), and the visible section is highlighted (#26).
- Explorer tab: lazy-loaded folder tree with arrow-key navigation, Enter/Space to open, the open document highlighted and revealed, and expanded folders remembered for the session; `browse` use case that reports unreadable folders (#24).
- Favourites tab: list with file/folder icons, open on click, remove, missing items dimmed, Alt+Up/Down reordering, and a star toggle in the viewport header (#25).
- App shell: resizable sidebar with Explorer/Favourites/Outline tabs, viewport header with Edit toggle and mode/layout switches, status bar, welcome screen with recents, toasts, light/dark theme following the system (#23, #28).

- i18n infrastructure: English and Spanish dictionaries, pure translator with system-language detection, and a reactive `i18n` store that switches language live

- Command registry: command ids, per-OS accelerators (`Mod+Shift+S` syntax with matching, display and Tauri formatting) and enable/check state
- `watch_file` command: watches the open file and emits a debounced `file-changed` event when it is modified, replaced or removed
- File commands `path_exists`, `rename_path`, `trash_path`, `copy_into` and `reveal_path`: rename/move without overwriting, system trash, copy under a free name, reveal in the file manager
- Tauri adapters for every port, `set_document_state` (macOS proxy icon and edited dot), `load_preferences`/`save_preferences`, and `createContainer` as the single wiring point (Tauri or in-memory)
- Document use cases (open, save, save as, new, close, quit confirmation, external reload) tested with the in-memory doubles
- Application use cases for preferences (load, save, update) and workspace (folder, favourites, recents, rename, move, trash)
- Window size, position and maximised state are remembered (`tauri-plugin-window-state`); the window starts hidden and is shown once the app has started, so it never flashes or jumps (#45)
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
- Status bar: words, characters, lines, reading time, cursor position, mode, encoding (with BOM) and line ending, with statistics debounced while typing (#27)

[Unreleased]: https://github.com/jgestal/dotmd-viewer/commits/main
