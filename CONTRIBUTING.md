# Contributing to SimpleDotMD

Thanks for your interest in SimpleDotMD. This guide explains how work is organized and what a change
needs before it can be merged.

## Workflow

- Work is tracked as GitHub issues, one per ticket (`T01`, `T02`, …), grouped into one milestone per epic.
  The full plan lives in [PLAN.md](PLAN.md).
- Create one branch per ticket from `main`, named `tNN-short-name` (for example `t06-docs`).
- Make one pull request per ticket against `main`. Its title is `TNN · <ticket title>` and its body
  includes a summary, `Closes #NN`, and how the change was verified.
- Pull requests are reviewed before merging. Do not merge your own pull request.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) and reference the issue:

```text
feat: add Markdown rendering with comrak (#15)
docs: add README, CHANGELOG and CONTRIBUTING (#6)
```

Common types are `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci` and `chore`.

## Definition of done

A ticket is done when:

- The acceptance criteria in its issue are met.
- New tests are added and pass.
- Lint and typecheck are clean.
- The architecture test passes.
- The diff has been reviewed.
- `CHANGELOG.md` is updated under `## [Unreleased]`.

## Before opening a pull request

Run these commands from the repository root:

```sh
npm run check                 # typecheck with svelte-check
npm run lint                  # ESLint and Prettier
npm test                      # Vitest
npm run test:rust             # cargo test
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

The mutation tests (`npm run test:mutation`) are run locally before a release rather than on every pull
request.

## End-to-end tests

`npm run test:e2e` drives a debug build (`npx tauri build --debug --no-bundle`) through `tauri-driver` and
WebdriverIO. It needs `cargo install tauri-driver --locked`, plus `webkit2gtk-driver` on Linux or, on Windows, an
msedgedriver that matches the installed WebView2 runtime (pass its path in `NATIVE_WEBDRIVER`). macOS has no WebDriver
for WKWebView.

Two Windows details, both handled in `e2e/wdio.conf.ts` and `.github/workflows/e2e.yml`:

- Run the tests from a terminal that is **not elevated**. Since WebView2 Runtime 150, an app running as administrator
  ignores `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, which is how msedgedriver turns on the remote debugging port, and
  the session fails with `DevToolsActivePort file doesn't exist`
  ([WebView2Feedback#5645](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645)). GitHub's Windows runners are
  elevated, so CI runs the tests at medium integrity with `gsudo --integrity Medium`.
- msedgedriver turns every entry of `args` into a browser switch (`--c:\path\to\file.md`), which the app ignores. On
  Windows the config hands each scenario's file or folder to the running app as a second launch instead, the same
  path a double-click in File Explorer takes. The app itself has no test-only switches.

## Code style

- Keep functions small and names clear. Avoid duplication and dead code.
- TypeScript runs in `strict` mode. Format code with Prettier and Rust code with `cargo fmt`.
- Match the style of the code around your change.

## Architecture rules

The frontend follows Clean Architecture. Source dependencies point inwards only: presentation uses the
application layer, which uses the domain and the ports.

- `domain` is pure and imports nothing outside itself.
- `application` (use cases) may import only `domain` and `ports`.
- `ports` contain interfaces and types only.
- `infrastructure` implements the ports, with Tauri adapters and in-memory test doubles.
- `src/lib/container.ts` is the only place that wires adapters to use cases.
- Only `infrastructure/tauri` may call Rust commands.

The architecture test enforces these rules. See [ARCHITECTURE.md](ARCHITECTURE.md) for details.
