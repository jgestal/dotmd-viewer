# Mutation testing

Mutation testing changes the code on purpose (a `>` becomes `>=`, a function returns a default
value…) and checks that some test fails. A mutant no test notices points at behaviour the tests do
not pin down. Each surviving mutant is either killed with a sharper test or explained here.

## TypeScript (StrykerJS)

_To be written._

## Rust (cargo-mutants)

Run it from the repository root:

```sh
npm run test:mutation:rust
```

The configuration is `src-tauri/.cargo/mutants.toml`; results go to `reports/mutants.out/`
(ignored by git). cargo-mutants copies `src-tauri` into a temporary folder for every build job and
builds there, so the copies need their own target directory: if your shell sets
`CARGO_TARGET_DIR`, unset it for the run (with `-j 2` or more, jobs sharing one target directory
would overwrite each other's mutated builds). Point `TMPDIR` at a disk with a few GB free.

### Results

Last run on macOS (arm64), cargo-mutants 27.1.0, `--no-shuffle -j 2`:

| Run                                           | Mutants | Caught | Missed | Timeouts | Unviable |
| --------------------------------------------- | ------: | -----: | -----: | -------: | -------: |
| Before this pass (only `main`/`run` excluded) |     451 |     94 |     70 |        5 |      282 |
| After (tests added, exclusions below)         |     372 |    103 |      0 |        5 |      264 |

Score after the pass: 103 of the 108 viable mutants caught by a failing test (95 %) and the other 5
by a hang, so no mutant goes unnoticed. Before it, 99 of 169 (59 %). cargo-mutants exits with
code 3 when there are timeouts, as here.

_Unviable_ mutants do not compile (for example `AppResult::new()`, which does not exist) and say
nothing about the tests. A _timeout_ means the mutant made a test hang: the suite did notice it.
All five timeouts are mutants that turn a loop into an endless one:

- `file_ops::exists` always `true`, and `delete !` in `free_name`: `free_name` never finds a free
  name.
- `!=` → `==` in `folders::natural_key`: the chunk loop never advances.
- `>` → `==` / `<` on the timeout check of `printing::wait_for_pdf`: waiting never gives up.

### Tests added for the survivors

- `files`: a file of exactly 20 MiB is read (the size limit is `>`, and it is 20 × 1024 × 1024, not
  a smaller product); `parent_directory` (extracted from `write_atomically` and reused by the
  watcher) maps a bare file name to `.`.
- `file_ops`: renaming into a missing folder reports that folder; a move the system refuses (a
  folder into itself) keeps the system's reason instead of being treated as a cross-device move;
  `move_across_devices` copies the file and removes the original, and refuses folders.
- `preferences_file`: a preferences path that cannot be read (a folder) is an error, not "nothing
  saved yet".
- `printing`: an existing PDF is only accepted after its size held for one poll.

### Exclusions

Each one is code `cargo test` cannot exercise on the host, or an equivalent mutant. No behaviour
was changed to make a mutant die; the only production edit is extracting `parent_directory` so it
can be tested without touching the current folder.

**Whole files** (`exclude_globs`):

| File                        | Why                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.rs`, `src/lib.rs` | `main` calls `run`, which registers plugins and commands and starts the Tauri event loop; `show_window_if_frontend_stalls` acts on the live window. Needs a display and a running app. |
| `src/window_state.rs`       | NSWindow calls (proxy icon, edited dot, title bar appearance) on the main thread of a running app; the non-macOS versions are empty.                                                   |
| `src/printing/wkwebview.rs` | Drives `NSPrintOperation` on a live WKWebView.                                                                                                                                         |
| `src/printing/webview2.rs`  | Windows only: not compiled on macOS, so every mutant would "survive".                                                                                                                  |
| `src/printing/webkitgtk.rs` | Linux only, same reason.                                                                                                                                                               |

**Functions** (`exclude_re`):

| Mutants                                                                          | Why                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finder_services::{register, handle, file_urls}`                                 | Need AppKit's main thread, a running app and an `NSPasteboard` from Finder. The pure part, `requests_for`, is tested and mutated.                                                                    |
| `open_requests::{deliver, on_second_instance, bring_forward, take_pending_open}` | Need an `AppHandle` (managed state, events, the main window). The queue (`OpenRequests::offer/take`) and the argument parsing are tested and mutated.                                                |
| `os_recents::platform::{add, clear}`                                             | Call the OS recent-documents list (AppKit, Win32, GTK) on the main thread. `file_url` and `wide_path` are tested and mutated.                                                                        |
| `quit::{hold_exit, quit_app}`                                                    | Need an `AppHandle`; the decision, `should_hold_exit`, is tested and mutated.                                                                                                                        |
| `>` → `>=` in `printing::wait_for_pdf` (timeout check)                           | Equivalent: the elapsed time is never exactly the timeout, so both behave the same.                                                                                                                  |
| `CrossesDevices` guard → `false` in `file_ops::rename`                           | Only a real move to another volume returns `CrossesDevices`, which a unit test cannot set up portably. `move_across_devices` is tested directly, and the guard's `true` and `!=` mutants are caught. |

**Attributes** (`#[cfg_attr(test, mutants::skip)]`, from the `mutants` dev-dependency): the
non-Unix `files::keep_permissions` and the Windows `folders::is_hidden_by_system`. They share their
name with the copy compiled on macOS, so a name pattern would also skip the copy that is tested;
the attribute marks exactly the copy that is not built here.
