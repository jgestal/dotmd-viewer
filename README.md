<p align="center">
  <img src="assets/icon.png" width="128" alt="SimpleDotMD icon">
</p>

# SimpleDotMD — Markdown Viewer & Editor

[![CI](https://github.com/jgestal/simpledotmd/actions/workflows/ci.yml/badge.svg)](https://github.com/jgestal/simpledotmd/actions/workflows/ci.yml)

A simple, cross-platform Markdown viewer, with optional editing, for macOS, Windows and Linux.
The little sibling of [DotMD](https://github.com/jgestal/dotmd).

**[Leer en español](docs/README.es.md)**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/readme-reading-dark.png">
  <img alt="SimpleDotMD reading Welcome.md with the Explorer open" src="docs/screenshots/readme-reading-light.png">
</picture>

SimpleDotMD opens every document in a read-only preview and switches to editing only when you ask.
It renders GitHub-flavoured Markdown, maths with KaTeX and diagrams with Mermaid, and shows each document as a
continuous page, as paginated A4 or Letter sheets, or as slides. It is built with Tauri 2, Rust and SvelteKit.

## Features

**Reading layouts**

- **Continuous**: the whole document as one scrolling page.
- **Pages**: A4 or Letter sheets on a grey desk, with page numbers, headings kept with the next block and manual
  page breaks (`\pagebreak`).
- **Slides**: the document split into slides at each top-level `---`, with arrow, space, Home and End navigation and
  a full-screen Present mode.

**Editing**

- Documents open read-only. **Edit** (`Cmd+E` / `Ctrl+E`) turns editing on, and the view modes are:
  - **Preview**: WYSIWYG editing; untouched Markdown stays byte for byte.
  - **Code**: CodeMirror 6 with Markdown highlighting, undo and redo, find and replace.
  - **Split**: code and preview side by side, with a draggable divider and synchronised scrolling.
- Unsaved changes are flagged, and closing a window or quitting asks to save, discard or cancel.

**Markdown**

- GitHub-flavoured Markdown: tables, task lists, strikethrough, footnotes and alerts (`> [!NOTE]`), plus `==highlights==`.
- Maths with KaTeX, diagrams with Mermaid and syntax highlighting for code blocks.
- YAML front matter, shown as document properties.
- Local images, resolved against the document's folder.

**Files and navigation**

- A collapsible, resizable sidebar with **Explorer** (folder tree), **Favourites** and **Outline** (headings) tabs.
- Open files from Finder or Explorer, by double-click, drag and drop, or from the command line. A second launch
  hands its files to the window already open.
- Drag files and folders in the Explorer to move them, or drag them out of the app into other applications.
- Context menu for open, rename (`F2`), move to trash and reveal in Finder, Explorer or your file manager.
- Recent files, in the Dock menu, **File › Open Recent** and the Windows Jump List.
- Automatic reload when the open file changes on disk.
- Text encodings (UTF-8, UTF-16, windows-1252) and line endings are detected and kept on save.

**Export and print**

- Print (`Cmd+P` / `Ctrl+P`) and **Export to PDF** (`Cmd+Shift+E` / `Ctrl+Shift+E`), written by the system's own web
  engine. Only the document is printed, in the light palette, with maths and diagrams rendered.

**Desktop integration**

- Native menus that follow each system: the macOS menu bar, or a window menu bar with Alt mnemonics on Windows and
  Linux.
- **Settings** (`Cmd+,` / `Ctrl+,`) for language, theme, default page size and zoom.
- Interface in English and Spanish, following the system language unless you choose one.
- Light, dark, sepia and night (pure black) themes, following the system unless you choose one. Switch from View ▸ Theme, the button in the header, or `Cmd+Alt+T` / `Ctrl+Alt+T` to cycle.

## Screenshots

<p align="center">
  <img alt="Split view: the Markdown source beside the rendered preview" src="docs/screenshots/readme-split.png">
</p>

<p align="center">
  <img alt="Pages layout: A4 sheets with page numbers" src="docs/screenshots/readme-pages.png">
</p>

<p align="center">
  <img alt="Slides layout with the slide counter and Present button" src="docs/screenshots/readme-slides.png">
</p>

<p align="center">
  <img alt="Settings dialog with language, theme, page size and zoom" src="docs/screenshots/readme-settings.png">
</p>

## Keyboard shortcuts

`Mod` is `⌘` (Cmd) on macOS and `Ctrl` on Windows and Linux. Each shortcut is also listed in the app under
**Help › Keyboard Shortcuts**.

| Command                        | macOS | Windows / Linux |
| ------------------------------ | ----- | --------------- |
| File › New                     | `⌘N`  | `Ctrl+N`        |
| File › Open…                   | `⌘O`  | `Ctrl+O`        |
| File › Open Folder…            | `⌘⇧O` | `Ctrl+Shift+O`  |
| File › Save                    | `⌘S`  | `Ctrl+S`        |
| File › Save As…                | `⌘⇧S` | `Ctrl+Shift+S`  |
| File › Export to PDF…          | `⌘⇧E` | `Ctrl+Shift+E`  |
| File › Print…                  | `⌘P`  | `Ctrl+P`        |
| File › Close                   | `⌘W`  | `Ctrl+W`        |
| Edit › Find…                   | `⌘F`  | `Ctrl+F`        |
| Edit › Find and Replace…       | `⌘⌥F` | `Ctrl+Alt+F`    |
| View › Edit                    | `⌘E`  | `Ctrl+E`        |
| View › Preview                 | `⌘1`  | `Ctrl+1`        |
| View › Code                    | `⌘2`  | `Ctrl+2`        |
| View › Split                   | `⌘3`  | `Ctrl+3`        |
| View › Continuous              | `⌘⌥1` | `Ctrl+Alt+1`    |
| View › Pages                   | `⌘⌥2` | `Ctrl+Alt+2`    |
| View › Slides                  | `⌘⌥3` | `Ctrl+Alt+3`    |
| View › Show Sidebar            | `⌘\`  | `Ctrl+\`        |
| View › Explorer                | `⌘⇧1` | `Ctrl+Shift+1`  |
| View › Favourites              | `⌘⇧2` | `Ctrl+Shift+2`  |
| View › Outline                 | `⌘⇧3` | `Ctrl+Shift+3`  |
| View › Zoom In                 | `⌘=`  | `Ctrl+=`        |
| View › Zoom Out                | `⌘-`  | `Ctrl+-`        |
| View › Actual Size             | `⌘0`  | `Ctrl+0`        |
| View › Enter Full Screen       | `⌃⌘F` | `F11`           |
| Application › Settings…        | `⌘,`  | `Ctrl+,`        |
| Application › Quit SimpleDotMD | `⌘Q`  | —               |

## Installing

Download the installer for your system from the [releases page](https://github.com/jgestal/simpledotmd/releases).
The builds are not code-signed yet, so your system asks you to confirm the first time you open them.
See [Opening unsigned builds](#opening-unsigned-builds) below.

### macOS

Open the `.dmg` and drag SimpleDotMD to Applications.
To make it the default app for Markdown: select a `.md` file in Finder, press `Cmd+I`, pick SimpleDotMD under
**Open with** and click **Change All...**. The app is registered as an alternate handler, so installing it never
changes your current default.

### Windows

Run the `.exe` (per-user install, no administrator rights needed) or the `.msi`. The installer registers the `.md`,
`.markdown`, `.mdown` and `.mkd` extensions and creates a Start menu shortcut; WebView2 is installed if it is missing.
To make it the default: right-click a `.md` file, **Open with > Choose another app**, select SimpleDotMD and
tick **Always use this app** (or **Settings > Apps > Default apps**).

### Linux

- Debian/Ubuntu: `sudo apt install ./simpledotmd_*.deb`
- Fedora/openSUSE: `sudo dnf install ./simpledotmd-*.rpm`
- Any distribution: `chmod +x DotMD*.AppImage && ./DotMD*.AppImage`

The `.deb` and `.rpm` add a menu entry and the Markdown MIME types, so SimpleDotMD shows up in **Open With** in
your file manager. To make it the default for Markdown:

```sh
xdg-mime default simpledotmd.desktop text/markdown text/x-markdown
```

If the window stays blank on some Wayland/NVIDIA setups, start the app with `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

## Opening unsigned builds

Until the builds are signed, each system shows a warning the first time you run SimpleDotMD. The app is safe to open;
the warning only means the publisher is not verified.

| System  | What you see                                                                                           | What to do                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS   | A message that the app cannot be opened because its developer cannot be verified.                      | Try to open the app once. Then go to **System Settings > Privacy & Security**, scroll to the message about SimpleDotMD and click **Open Anyway**. On older macOS versions you can also right-click the app and choose **Open**. |
| Windows | **Windows protected your PC** (SmartScreen).                                                           | Click **More info**, then **Run anyway**.                                                                                                                                                                                       |
| Linux   | Usually nothing for the `.deb` and `.rpm` packages. An AppImage will not start until it is executable. | Run `chmod +x` on the AppImage, then start it.                                                                                                                                                                                  |

## Building from source

Prerequisites:

- [Node.js](https://nodejs.org/) 22 or newer
- [Rust](https://rustup.rs/) stable
- The [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system

```sh
npm install
npm run tauri dev     # run the app with hot reload
npm run tauri build   # build the installers for your platform
```

`npm run build` only builds the web frontend into `build/`. In a plain browser, `npm run dev` opens an in-memory demo
workspace, which is what the screenshots above were taken from.

## Tests

```sh
npm test                    # Vitest: unit, use-case and architecture tests
npm run test:coverage       # Vitest with coverage; 90 % minimum for domain and application
npm run test:rust           # cargo test for the Rust backend
npm run test:mutation       # StrykerJS over domain and application, report in reports/mutation/
npm run test:mutation:rust  # cargo-mutants over the Rust backend, report in reports/
```

The other checks are `npm run check` (types), `npm run lint`, `npm run format:check`, `npm run lint:rust` and
`cargo fmt --check` in `src-tauri`. CI runs them on every pull request, together with a build on macOS, Windows and
Linux.

Mutation testing must score at least 85 %. It is a manual workflow (**Mutation testing** in GitHub Actions), and the
Rust target needs `cargo install cargo-mutants` once.

`npm run test:e2e` runs WebDriver smoke tests (tauri-driver) against a debug build; CI runs them on Linux, plus a start-up smoke test on macOS. The Windows job is not blocking yet: msedgedriver cannot attach to WebView2 on the GitHub runner.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): branches, commits, pull requests and the definition of done
- [ARCHITECTURE.md](ARCHITECTURE.md): layers, dependency rules and testing strategy
- [CHANGELOG.md](CHANGELOG.md): release history
- [docs/platforms.md](docs/platforms.md): what each operating system provides and how the app uses it
- [docs/releasing.md](docs/releasing.md): how a release is cut and how to add the signing secrets
- [Releases](https://github.com/jgestal/simpledotmd/releases): installers for each version

## Credits

Made by **Juan Gestal** — juan@gestal.es — https://gestal.es

Built with Tauri, SvelteKit, Milkdown, CodeMirror, markdown-it, KaTeX, Mermaid and highlight.js.

## License

[MIT](LICENSE)
