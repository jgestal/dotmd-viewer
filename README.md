# DotMD Viewer

A simple, cross-platform Markdown viewer — with optional editing — for macOS, Windows and Linux.
The little sibling of [DotMD](https://github.com/jgestal/dotmd).

DotMD Viewer opens every document in a read-only preview and only switches to editing when you ask for it.
It renders GitHub-flavored Markdown (tables, task lists, footnotes), LaTeX math with KaTeX and Mermaid
diagrams, with syntax highlighting and YAML front matter. Documents can be read as a continuous page, as
paginated A4 or Letter pages, or as slides separated by `---`, and exported to PDF. It is built with
Tauri 2 and Rust and runs on macOS, Windows and Linux.

> **Status: work in progress.** The project is being built ticket by ticket. See [PLAN.md](PLAN.md) for the
> roadmap and [PROMPT.md](PROMPT.md) for the full scope.

## Planned features

- Viewer first: read-only preview, with an **Edit** mode (⌘/Ctrl+E) offering code, split and editable preview views
- Collapsible sidebar with Explorer, Favorites and Outline tabs
- Layouts: continuous, pages (A4/Letter) and slides (fullscreen, arrow-key navigation)
- GFM, KaTeX, Mermaid, syntax highlighting and YAML front matter
- Status bar with word, character and line counts, reading time, cursor position, mode, encoding and line endings
- Export to PDF and printing
- Open files from the Finder or Explorer, by double-click, drag and drop, or from the command line; single instance
- Recent files, automatic reload when a file changes on disk, and a warning for unsaved changes
- Light and dark themes that follow the system
- Interface in English and Spanish

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

## Tests

```sh
npm test                    # Vitest: unit, use-case and architecture tests
npm run test:rust           # cargo test for the Rust backend
npm run test:mutation       # StrykerJS over domain and application, report in reports/mutation/
npm run test:mutation:rust  # cargo-mutants over the Rust backend, report in reports/
```

Mutation testing must score at least 85 %. The Rust target needs `cargo install cargo-mutants` once.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): branches, commits, pull requests and the definition of done
- [ARCHITECTURE.md](ARCHITECTURE.md): layers, dependency rules and testing strategy
- [CHANGELOG.md](CHANGELOG.md): release history

## Credits

Made by **Juan Gestal** — [juan@gestal.es](mailto:juan@gestal.es) — [www.gestal.es](https://www.gestal.es)

## License

[MIT](LICENSE)
