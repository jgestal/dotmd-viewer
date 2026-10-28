# Contributing to DotMD Viewer

Thanks for your interest in DotMD Viewer. This guide explains how work is organized and what a change
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
