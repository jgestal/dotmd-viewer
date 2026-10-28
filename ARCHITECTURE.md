# DotMD Viewer architecture

DotMD Viewer is a Tauri 2 app: a Rust backend (files, rendering, OS integration, CLI) and a Svelte 5
frontend. The frontend follows **Clean Architecture**: business rules sit in the middle, frameworks at the
edges, and dependencies point inwards only.

Parts that are not built yet are marked *planned*, with the ticket that delivers them (see [PLAN.md](PLAN.md)).

```
            ┌────────────────────────── presentation ─────────────────────────┐
            │  components/*.svelte · routes/ · commands · menu                 │
            │                 ┌────────── application ──────────┐              │
            │                 │  documents · workspace · files   │              │
            │                 │        ┌──── domain ────┐       │              │
            │                 │        │ documents       │       │              │
            │                 │        │ workspace       │       │              │
            │                 │        └─────────────────┘       │              │
            │                 └────────── ports ─────────────────┘              │
            └──── container.ts wires ports to infrastructure ───────────────────┘
                  infrastructure/tauri (real)   ·   infrastructure/memory (tests)
```

## Layers

| Layer | Folder | May import | Contents |
|---|---|---|---|
| **Domain** | `src/lib/domain/` | nothing outside itself | Pure rules: documents (line endings, modes, dirty state), workspace (folders, favorites), statistics, outline, slides, preferences validation, `AppError`. |
| **Ports** | `src/lib/ports/` | nothing (types only) | Interfaces the application needs: `FileSystem`, `Dialogs`, `FileWatcher`, `MarkdownRenderer`, `Exporter`, `Notifier`, `Translate`. |
| **Application** | `src/lib/application/` | domain, ports | Use cases: open, save, save as, close with changes, external reload; folders and favorites; rename, move and trash; recent files and preferences. They receive their dependencies as arguments. |
| **Infrastructure** | `src/lib/infrastructure/` | ports, domain | `tauri/`: adapters over Rust commands and Tauri plugins. `memory/`: in-memory doubles with scripted answers for tests. |
| **Presentation** | `src/lib/presentation/`, `src/routes/` | everything | Svelte components and stores, the command registry (shortcuts and menu), and UI-only behavior. |
| **Composition root** | `src/lib/container.ts` | everything | The only place that picks adapters and builds the use cases (dependency injection). |

Status: the layers are in place as folders; their contents are built by the tickets in epics E1 to E6.

## Dependency rule

The rule is enforced by a test, `src/lib/__tests__/architecture.test.ts` (*planned, T03*). It checks that:

- the domain imports nothing;
- the application imports only the domain and the ports;
- the ports contain only types;
- no module outside `infrastructure/` calls a Rust command (`invoke`).

## Patterns

- **Ports and adapters** for every external effect (files, dialogs, watcher, rendering, export), so use
  cases can be tested with in-memory doubles.
- **Dependency injection** through factory functions (`createDocuments(deps)`) wired in `container.ts`.
- **Command registry**: one command definition feeds keyboard shortcuts and the native menu.
- **Centralized errors**: adapters turn backend failures into `AppError` (`domain/errors.ts`), and use
  cases report them through `Notifier`.

## Rust backend (`src-tauri/src`)

Commands stay thin. The logic lives in plain functions that tests call directly, often with temporary
folders.

| Module | Responsibility | Status |
|---|---|---|
| `lib.rs`, `main.rs` | App setup, plugins, command registration. | Scaffold (T01) |
| `fs.rs` | Read and write text with encoding detection (UTF-8/16, Latin-1), atomic save, directory listing filtered to `.md`, `.markdown` and `.txt`. | *Planned (T13, T14)* |
| `markdown.rs` | comrak rendering with GFM, notes, front matter and source line mapping. | *Planned (T15)* |
| `watch.rs` | File watching with `notify`, emitting change events for live reload. | *Planned (T16)* |
| `os.rs` | Rename, move, trash, and reveal in Finder or Explorer. | *Planned (T17)* |
| `cli.rs` | Command-line arguments, single instance, and opening files from the OS. | *Planned (T18)* |

## Frontend libraries

Markdown is rendered by the backend. The frontend adds KaTeX for math, Mermaid for diagrams (loaded
lazily), highlight.js for code, and DOMPurify to sanitize the HTML before it is shown. The code editor is
CodeMirror 6; the editable preview is Milkdown (loaded lazily). These arrive with epic E5.

## Testing strategy

| Level | Where | Tool | Command | Status |
|---|---|---|---|---|
| **Unit** | `src/lib/**/__tests__/` | Vitest | `npm test` | *Planned (T03)* |
| **Use cases** | `src/lib/application/` tests, using in-memory adapters | Vitest | `npm test` | *Planned (T19, T20)* |
| **Architecture** | `src/lib/__tests__/architecture.test.ts` | Vitest | `npm test` | *Planned (T03)* |
| **Rust** | `#[cfg(test)]` modules in `src-tauri/src` | `cargo test` | `npm run test:rust` | *Planned (T13 to T18)* |
| **Mutation** | StrykerJS for TypeScript, cargo-mutants for Rust | StrykerJS, cargo-mutants | `npm run test:mutation` | *Planned (T04)* |

Targets: coverage of at least 90 % in `domain` and `application`, and a mutation score of at least 85 % in
the same layers. Surviving mutants are either killed by a new test or justified in writing. Mutation
testing runs locally before a release, and can be started manually from a `workflow_dispatch` job; it is
not part of every pull request.

## Adding a feature

1. Put the rule in `domain/` as a pure function, with a unit test.
2. If it needs the outside world, add or extend a **port**, then implement it in `infrastructure/tauri`
   and in `infrastructure/memory` for tests.
3. Write the use case in `application/`, taking its dependencies as arguments, and test it with the
   in-memory doubles.
4. Wire it in `container.ts` and expose it to the components through a facade or a command.
