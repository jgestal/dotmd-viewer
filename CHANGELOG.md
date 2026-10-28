# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `render_markdown` command: GFM, footnotes, alerts, highlight, front matter, math markup for KaTeX and `data-sourcepos` via comrak
- Project scaffold (Tauri 2 + SvelteKit)
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

[Unreleased]: https://github.com/jgestal/dotmd-viewer/commits/main
